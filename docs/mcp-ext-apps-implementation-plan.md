# MCP Ext-Apps 最小可用实现计划

## Context

当前 Arkloop 的 MCP 实现支持基础协议的 `EmbeddedResource`（`type: "resource"` 内联在 tool result content 数组中）。但 MCP ext-apps 规范定义了不同的机制：Server 通过 `resources/list` 预声明 UI resources，Tool 通过 `_meta.ui.resourceUri` 关联 UI resource，Host 通过 `resources/read` 获取 HTML 内容并在 iframe 中渲染。

本计划实现 ext-apps 的最小可用路径：**resources/read 获取 HTML + 标准 resource 传输链路 + 现有 iframe 渲染**，不包含 iframe 内的 postMessage JSON-RPC 通信（`ui/initialize`、`tools/call` 等）。

## 架构概述

标准 resource 传输链路：

```
MCP Executor
  └─ ReadResource(ui://dashboard) 获取 HTML
     └─ ContentAttachment{MimeType: "text/html;profile=mcp-app", Data: htmlBytes}
        │
Agent Loop: toolResultFromExecution
  ├─ image/* → ContentPart{Type: "image", ...}
  └─ 非 image → ContentPart{Type: "resource", Resource: &ResourceRef{...}, Data: htmlBytes}
     │
SSE Event: StreamToolResult.ToDataJSON
  ├─ result: {output, error}
  └─ resources: [{uri, mime_type, text, size}]  ← collectResourceParts
     │
Frontend: agent-ui/arkloop-adapter.ts
  └─ tool-result → tool-output-available chunk (携带 resources 数组)
     │
Frontend: agentEventProcessing.ts
  └─ extractArtifacts(result) 从 result.resources 提取 HTML resource
     │
Frontend: PreviewResourceView / ArtifactIframe
  └─ isIframeMime("text/html;profile=mcp-app") → iframe 渲染
```

## Phase 1: MCP Client 扩展

### 1.1 扩展 Client 接口

文件：`src/services/worker/internal/mcp/pool.go:10`

在 `Client` 接口添加两个方法：

```go
ListResources(ctx context.Context, timeoutMs int) ([]Resource, error)
ReadResource(ctx context.Context, uri string, timeoutMs int) (ResourceContent, error)
```

### 1.2 定义 Resource 和 ResourceContent 结构

文件：`src/services/worker/internal/mcp/stdio_client.go:22`

在 `Tool` 结构附近添加：

```go
type Resource struct {
    URI      string
    Name     string
    MimeType string
    Meta     map[string]any // _meta 原始数据
}

type ResourceContent struct {
    URI      string
    MimeType string
    Text     string
    Blob     []byte
    Meta     map[string]any // _meta 原始数据
}
```

### 1.3 StdioClient 实现

文件：`src/services/worker/internal/mcp/stdio_client.go`

在 `ListTools` 之后添加 `ListResources` 和 `ReadResource`：

- `ListResources`: 调用 `resources/list` JSON-RPC 方法，解析 `resources` 数组，提取 `uri`、`name`、`mimeType`、`_meta`
- `ReadResource`: 调用 `resources/read` JSON-RPC 方法（参数 `{uri: string}`），解析 `contents` 数组（取第一个），提取 `uri`、`mimeType`、`text`、`blob`（base64 decode）

参考 `ListTools` 的实现模式（`stdio_client.go:420-464`）。

**注意**：`ReadResource` 返回的 `ResourceContent.Text` 和 `Blob` 是互斥的——有 `text` 时用 `Text`，有 `blob` 时 base64 decode 后放 `Blob`。

### 1.4 HTTPClient 实现

文件：`src/services/worker/internal/mcp/http_client.go`

同样方式在 `ListTools`/`CallTool` 之后添加两个方法，参考 HTTP 传输的现有模式（`http_client.go:112-168`）。

### 1.5 Capability Negotiation（规范 MUST）

文件：`src/services/worker/internal/mcp/stdio_client.go:402` 和 `http_client.go:85`

规范要求 Client 在 `initialize` 时声明 ext-apps 扩展能力，否则 Server 可能不返回 `_meta.ui`：

```go
capabilities := map[string]any{
    "extensions": map[string]any{
        "io.modelcontextprotocol/ui": map[string]any{
            "mimeTypes": []string{"text/html;profile=mcp-app"},
        },
    },
}
```

替换现有的 `"capabilities": map[string]any{}`。

## Phase 2: Tool 元数据解析

### 2.1 扩展 Tool 结构支持 _meta

文件：`src/services/worker/internal/mcp/stdio_client.go:22`

在 `Tool` 结构添加 `Meta` 字段：

```go
type Tool struct {
    Name        string
    Title       *string
    Description *string
    InputSchema map[string]any
    Meta        map[string]any // _meta 原始数据
}
```

### 2.2 ListTools 解析 _meta

文件：`src/services/worker/internal/mcp/stdio_client.go:439-461` 和 `http_client.go:131-155`

在解析 tool 对象时，如果存在 `obj["_meta"]`，将其存入 `Tool.Meta`。

### 2.3 新增工具元数据解析辅助函数

文件：`src/services/worker/internal/mcp/executor.go`

添加函数：

```go
// extractToolResourceURI 从 Tool 的 _meta.ui.resourceUri 提取关联的 UI resource URI
// 兼容旧格式 _meta["ui/resourceUri"]（已弃用）和新格式 _meta.ui.resourceUri
func extractToolResourceURI(tool Tool) string {
    if tool.Meta == nil {
        return ""
    }
    metaUI, _ := tool.Meta["ui"].(map[string]any)
    if metaUI != nil {
        uri := strings.TrimSpace(asString(metaUI["resourceUri"]))
        if uri != "" {
            return uri
        }
    }
    // fallback to deprecated flat format
    return strings.TrimSpace(asString(tool.Meta["ui/resourceUri"]))
}

// isToolVisibleToModel 检查 tool 是否对 agent(model) 可见
// visibility 默认 ["model", "app"]；不含 "model" 的 tool 对 agent 隐藏
func isToolVisibleToModel(tool Tool) bool {
    if tool.Meta == nil {
        return true
    }
    metaUI, _ := tool.Meta["ui"].(map[string]any)
    if metaUI == nil {
        return true
    }
    rawVisibility, ok := metaUI["visibility"].([]any)
    if !ok || len(rawVisibility) == 0 {
        return true
    }
    for _, v := range rawVisibility {
        if strings.TrimSpace(asString(v)) == "model" {
            return true
        }
    }
    return false
}
```

复用现有的 `asString` 或 `stringFromAny` 辅助函数。

## Phase 3: Tool 注册层

### 3.1 扩展 AgentToolSpec

文件：`src/services/worker/internal/tools/spec.go:32`

添加 `ResourceURI` 字段：

```go
type AgentToolSpec struct {
    // ... 现有字段 ...
    ResourceURI string // MCP ext-apps 关联的 UI resource URI
}
```

### 3.2 Registry 解析 resourceUri 并传递

文件：`src/services/worker/internal/mcp/registry.go`

在 `DiscoverWithDiagnostics` 中：

1. `client.ListTools()` 获取工具列表
2. 对每个 tool，先检查 `isToolVisibleToModel(tool)`：
   - 如果返回 `false`（visibility 不含 `"model"`），跳过注册（不加入 AgentSpecs/LlmSpecs/Executors）
3. 对可见的 tool，调用 `extractToolResourceURI(tool)` 获取 resource URI
4. 将 resource URI 存入 `AgentToolSpec.ResourceURI`
5. 构建 `resourceURIs map[string]string`（internal name → ui:// URI）
6. 将 `resourceURIs` 传递给 `NewToolExecutor`

**注意**：internal name 是在解决命名冲突后确定的最终名称（`ensureUniqueToolName` 之后），resourceURIs 的 key 必须与 remoteMap 的 key 一致。

### 3.3 扩展 ToolExecutor 存储 resourceUri 映射

文件：`src/services/worker/internal/mcp/executor.go:20`

修改 `ToolExecutor` 结构：

```go
type ToolExecutor struct {
    server                   ServerConfig
    remoteToolNameByToolName map[string]string
    resourceURIByToolName    map[string]string // tool internal name -> ui:// URI
    pool                     *Pool
}
```

修改 `NewToolExecutor` 接收 resource URI 映射：

```go
func NewToolExecutor(server ServerConfig, remote map[string]string, resourceURIs map[string]string, pool *Pool) *ToolExecutor
```

### 3.4 Registry 更新 NewToolExecutor 调用

文件：`src/services/worker/internal/mcp/registry.go:210`

```go
executor := NewToolExecutor(server, remoteMap, resourceURIs, pool)
```

## Phase 4: 基础设施——新增缺失的类型和字段（关键，必须先做）

回退后的代码中以下类型/字段**完全不存在**，必须先定义，否则后续 Phase 无法编译。

### 4.1 扩展 ContentAttachment（tools 层）

文件：`src/services/worker/internal/tools/dispatch_executor.go:93`

当前结构：
```go
type ContentAttachment struct {
    MimeType      string
    Data          []byte
    AttachmentKey string
}
```

**新增** `URI` 和 `Text` 字段：
```go
type ContentAttachment struct {
    MimeType      string
    Data          []byte
    AttachmentKey string
    URI           string  // MCP resource URI（如 ui://dashboard）
    Text          string  // 文本型 resource 的原始文本（如 HTML）
}
```

### 4.2 新增 PartTypeResource 和 ResourceRef（messagecontent 层）

文件：`src/services/shared/messagecontent/content.go`

在现有常量后**新增**：
```go
const PartTypeResource = "resource"
```

**新增** `ResourceRef` 类型：
```go
type ResourceRef struct {
    URI      string `json:"uri,omitempty"`
    MimeType string `json:"mime_type,omitempty"`
    Text     string `json:"text,omitempty"`
    BlobKey  string `json:"blob_key,omitempty"`
    Size     int64  `json:"size,omitempty"`
}
```

### 4.3 扩展 ContentPart（llm 层）

文件：`src/services/worker/internal/llm/contract.go`

在 `ContentPart` 结构**新增** `Resource` 字段：
```go
type ContentPart struct {
    Type        string
    Text        string
    Data        []byte
    Attachment  *messagecontent.AttachmentRef
    Resource    *messagecontent.ResourceRef  // 新增
    TrustSource string
    // ... 其他字段 ...
}
```

同时确保 `ContentPart.Kind()` 方法能正确识别 resource：
```go
func (p ContentPart) Kind() string {
    if p.Resource != nil {
        return messagecontent.PartTypeResource
    }
    // ... 现有逻辑 ...
}
```

### 4.4 扩展 messagecontent.Part 结构

文件：`src/services/shared/messagecontent/content.go`

`Part` 结构用于消息持久化（数据库存储 `content_json`），必须支持 resource：

```go
type Part struct {
    Type          string
    Text          string
    Attachment    *AttachmentRef
    ExtractedText string
    Resource      *ResourceRef `json:"resource,omitempty"`  // 新增
}
```

### 4.5 messagecontent 序列化/反序列化处理

文件：`src/services/shared/messagecontent/content.go`

以下函数需要新增 `PartTypeResource` 分支：

**`Normalize()`**：验证 resource part 的 `Resource` 字段非空
```go
case PartTypeResource:
    if p.Resource == nil {
        return fmt.Errorf("resource part requires resource ref")
    }
```

**`Projection()`**：resource part 投影为 `[Resource: uri]` 文本
```go
case PartTypeResource:
    if p.Resource != nil && p.Resource.URI != "" {
        out = append(out, fmt.Sprintf("[Resource: %s]", p.Resource.URI))
    } else {
        out = append(out, "[Resource]")
    }
```

**`PromptText()`**：resource part 对 LLM 无意义，返回空字符串
```go
case PartTypeResource:
    return ""
```

**JSON 序列化**：`Part` 结构添加 `Resource *ResourceRef \`json:"resource,omitempty"\`` 字段后，`json.Marshal`/`json.Unmarshal` 会自动处理（通过 `Parse()` 和 `Content.JSON()` 调用）。

**`cleanType()`**：通过 `p.Resource != nil` 检测 resource part
```go
func cleanType(part Part) string {
    if part.Resource != nil {
        return PartTypeResource
    }
    // ... 现有逻辑 ...
}
```

### 4.6 llm/contract.go contentPartFromJSONMap 添加 resource 分支

文件：`src/services/worker/internal/llm/contract.go:1083-1133`

`contentPartFromJSONMap` 解析 `content_json` 中的 part JSON 为 `ContentPart`。当前有 text/thinking/redacted_thinking/image/file 五个分支，需新增 resource：

```go
case messagecontent.PartTypeResource:
    resource, err := resourceRefFromJSON(raw["resource"])
    if err != nil {
        return ContentPart{}, err
    }
    return ContentPart{Type: messagecontent.PartTypeResource, Resource: resource}, nil
```

同时添加 `resourceRefFromJSON` 辅助函数（与 `attachmentRefFromJSON` 相邻）：

```go
func resourceRefFromJSON(raw any) (*messagecontent.ResourceRef, error) {
    obj, ok := raw.(map[string]any)
    if !ok {
        return nil, fmt.Errorf("resource is not an object")
    }
    return &messagecontent.ResourceRef{
        URI:      strings.TrimSpace(stringValue(obj["uri"])),
        MimeType: strings.TrimSpace(stringValue(obj["mime_type"])),
        Text:     stringValue(obj["text"]),
        BlobKey:  strings.TrimSpace(stringValue(obj["blob_key"])),
        Size:     int64(intValue(obj["size"])),
    }, nil
}
```

## Phase 5: Tool 执行增强

### 5.1 ToolExecutor.Execute 读取 UI Resource

文件：`src/services/worker/internal/mcp/executor.go:38`

在 `client.CallTool()` 之后、`splitMCPContent()` 之前：

1. 检查 `e.resourceURIByToolName[toolName]` 是否有值
2. 如果有，用**原始 `ctx`**（不是 `callCtx`）调用 `client.ReadResource(ctx, resourceURI, timeoutMs)` 获取 HTML 内容
3. 如果读取成功，创建一个额外的 `ContentAttachment`：
   ```go
   tools.ContentAttachment{
       MimeType: resourceContent.MimeType, // text/html;profile=mcp-app
       Data:     []byte(resourceContent.Text),
       URI:      resourceContent.URI,
       Text:     resourceContent.Text,
   }
   ```
4. 将这个 attachment prepend 到 `attachments` 列表（确保它在 content 之前被处理）

**错误处理**：`ReadResource` 失败**不**应该导致 tool 执行失败。记录日志后继续，tool 的核心输出仍然有效。

**Context 选择**：必须使用原始 `ctx` 而不是 `callCtx`。`callCtx` 已经被 `CallTool` 的超时控制，如果 `CallTool` 耗时较长，`ReadResource` 会因为 context 超时而失败。原始 `ctx` 没有这个问题。

### 5.2 保留 EmbeddedResource 处理

文件：`src/services/worker/internal/mcp/executor.go:120`

`splitMCPContent` 继续处理 `type: "resource"` 的 EmbeddedResource（基础协议支持）。ext-apps 的 `ReadResource` 结果和基础协议的 `EmbeddedResource` 可以共存，都会变成 `ContentAttachment` 进入同一条链路。

## Phase 6: Agent Loop resource 处理（方案 B 核心）

### 6.1 修复 toolResultFromExecution 的 ContentAttachment 分类

文件：`src/services/worker/internal/agent/loop.go:3539-3575`

回退后的代码把所有 ContentAttachment 都当作 image 处理。需要区分 image 和 resource：

```go
for _, att := range result.ContentParts {
    mimeType := strings.TrimSpace(att.MimeType)

    // Image 类型
    if strings.HasPrefix(mimeType, "image/") {
        attachment := &messagecontent.AttachmentRef{
            MimeType: att.MimeType,
        }
        if key := strings.TrimSpace(att.AttachmentKey); key != "" {
            attachment.Key = key
        }
        contentParts = append(contentParts, llm.ContentPart{
            Type:       messagecontent.PartTypeImage,
            Data:       att.Data,
            Attachment: attachment,
        })
        continue
    }

    // Resource 类型：HTML/Markdown/SVG 或任意带 URI/Data 的 attachment
    if att.URI != "" || len(att.Data) > 0 {
        contentParts = append(contentParts, llm.ContentPart{
            Type: messagecontent.PartTypeResource,
            Data: att.Data,
            Resource: &messagecontent.ResourceRef{
                URI:      att.URI,
                MimeType: att.MimeType,
                Text:     att.Text,
            },
        })
    }
}
```

### 6.2 llm/contract.go 添加 collectResourceParts

文件：`src/services/worker/internal/llm/contract.go`

在 `StreamToolResult` 附近添加辅助函数：

```go
func collectResourceParts(parts []ContentPart) []map[string]any {
    result := make([]map[string]any, 0)
    for _, part := range parts {
        if part.Kind() != messagecontent.PartTypeResource || part.Resource == nil {
            continue
        }
        item := map[string]any{
            "mime_type": part.Resource.MimeType,
            "uri":       part.Resource.URI,
        }
        if part.Resource.Text != "" {
            item["text"] = part.Resource.Text
        } else if len(part.Data) > 0 {
            // 小内容直接内联，大内容只给 preview
            if len(part.Data) < 4096 {
                item["text"] = string(part.Data)
            } else {
                item["size"] = len(part.Data)
                previewLen := 512
                if len(part.Data) < previewLen {
                    previewLen = len(part.Data)
                }
                item["preview"] = string(part.Data[:previewLen])
            }
        }
        result = append(result, item)
    }
    return result
}
```

### 6.3 StreamToolResult.ToDataJSON 集成 collectResourceParts

文件：`src/services/worker/internal/llm/contract.go`

**注意**：回退后的 `ToDataJSON()` 输出 `tool_call_id`, `tool_name`, `result`, `error`, `usage`, `cost`。需要在**保留所有现有字段**的基础上**追加** `resources`：

```go
func (r StreamToolResult) ToDataJSON() map[string]any {
    toolName := CanonicalToolName(r.ToolName)
    if toolName == "" { toolName = r.ToolName }
    payload := map[string]any{
        "tool_call_id": r.ToolCallID,
        "tool_name":    toolName,
        "result":       r.ResultJSON,
    }
    if r.DisplayDescription != "" {
        payload["display_description"] = r.DisplayDescription
    }
    if r.Error != nil {
        payload["error"] = r.Error.ToJSON()
    }
    if r.Usage != nil {
        payload["usage"] = r.Usage.ToJSON()
    }
    if r.Cost != nil {
        payload["cost"] = r.Cost.ToJSON()
    }
    payload["resources"] = collectResourceParts(r.ContentParts)
    // 如需支持图片，同样添加 collectImageParts
    return payload
}
```

## Phase 6.5: Context Compact 处理 Resource Parts（关键，防止上下文溢出）

Context compact（`context_compact.go`）目前完全忽略 resource parts，导致：
1. **Token 估算偏低**：HTML 内容可能很大（数十 KB），但 `contextCompactImageTokens` 不计算 resource tokens
2. **Context overflow**：resource parts 不会被 strip/compact，旧消息中的 HTML 会无限累积

### 6.5.1 扩展 token 估算支持 resource

文件：`src/services/worker/internal/pipeline/context_compact_tiktoken.go:124-132`

将 `contextCompactImageTokens` 扩展为 `contextCompactMediaTokens`，同时计算 resource tokens：

```go
func contextCompactMediaTokens(m llm.Message) int {
    total := 0
    for _, part := range m.Content {
        switch part.Kind() {
        case messagecontent.PartTypeImage:
            total += contextCompactVisionTokensPerImage
        case messagecontent.PartTypeResource:
            total += contextCompactResourceTokens(part)
        }
    }
    return total
}

// contextCompactResourceTokens 估算 resource part 的 token 消耗
func contextCompactResourceTokens(part llm.ContentPart) int {
    text := ""
    if part.Resource != nil {
        text = part.Resource.Text
    }
    if text == "" && len(part.Data) > 0 {
        text = string(part.Data)
    }
    if text == "" {
        return 0
    }
    return approxTokensFromText(text)
}
```

**重命名调用点**：`context_compact.go:425` 的 `contextCompactImageTokens(msgs[i])` 改为 `contextCompactMediaTokens(msgs[i])`。

### 6.5.2 stripOlderImagePartsKeepingTail 同时处理 resource

文件：`src/services/worker/internal/pipeline/context_compact.go:1348-1379`

Resource parts 与 image 不同：**无条件替换为占位符**（没有 `keepRemaining` 概念）。HTML resource 是 UI 渲染用的，对 LLM 没有价值，全部 strip。

```go
func stripOlderImagePartsKeepingTail(msgs []llm.Message, keepImages int) ([]llm.Message, int) {
    if len(msgs) == 0 || keepImages < 0 {
        return msgs, 0
    }
    out := make([]llm.Message, len(msgs))
    copy(out, msgs)
    keepRemaining := keepImages
    stripped := 0
    for i := len(out) - 1; i >= 0; i-- {
        parts := append([]llm.ContentPart(nil), out[i].Content...)
        replaced := false
        for j := len(parts) - 1; j >= 0; j-- {
            switch parts[j].Kind() {
            case messagecontent.PartTypeImage:
                if keepRemaining > 0 {
                    keepRemaining--
                    continue
                }
                parts[j] = llm.ContentPart{
                    Type: messagecontent.PartTypeText,
                    Text: contextCompactImagePlaceholder(parts[j]),
                }
                stripped++
                replaced = true
            case messagecontent.PartTypeResource:
                // Resource parts: 无条件替换为占位符（不保留）
                parts[j] = llm.ContentPart{
                    Type: messagecontent.PartTypeText,
                    Text: contextCompactResourcePlaceholder(parts[j]),
                }
                stripped++
                replaced = true
            }
        }
        if replaced {
            out[i].Content = parts
        }
    }
    return out, stripped
}
```

### 6.5.3 新增 resource placeholder 函数

文件：`src/services/worker/internal/pipeline/context_compact.go:1381-1387` 之后

```go
func contextCompactResourcePlaceholder(part llm.ContentPart) string {
    tag := "[resource]"
    if part.Resource != nil {
        if uri := strings.TrimSpace(part.Resource.URI); uri != "" {
            tag = "[resource uri=" + strconv.Quote(uri) + "]"
        } else if mimeType := strings.TrimSpace(part.Resource.MimeType); mimeType != "" {
            tag = "[resource mime_type=" + strconv.Quote(mimeType) + "]"
        }
    }
    return tag
}
```

## Phase 7: 前端 resource 传输链路（方案 B 核心）

### 7.1 新增 ResourceEvent 和 ImageEvent 类型

文件：`src/apps/web/src/agent-ui/contract.ts`

**新增**以下类型（回退后不存在）：

```ts
export type ResourceEvent = {
  mime_type: string
  uri?: string
  text?: string
  blob_key?: string
  size?: number
  preview?: string
}

export type ImageEvent = {
  mime_type: string
  blob_key?: string
  data_url?: string
}
```

以及 `AgentToolResultData` 包含 `resources` 和 `images`：

```ts
export type AgentToolResultData = {
  toolCallId: string
  toolName?: string
  output: unknown
  error?: AgentToolResultErrorData
  resources?: ResourceEvent[]
  images?: ImageEvent[]
}
```

以及 `tool-output-available` chunk 类型包含 `resources` 和 `images`：

```ts
| { type: 'tool-output-available'; toolCallId: string; output: unknown; preliminary?: boolean; resources?: ResourceEvent[]; images?: ImageEvent[] }
```

### 7.2 arkloop-adapter.ts 传递 resources

文件：`src/apps/web/src/agent-ui/arkloop-adapter.ts`

在 `agentEventToMessageChunks` 的 `tool-result` handler 中：

```ts
if (uiEvent.type === 'tool-result') {
    const data = uiEvent.data as {
        toolCallId: string
        output: unknown
        resources?: ResourceEvent[]
        images?: ImageEvent[]
        error?: { message?: string; errorClass?: string; code?: string }
    }
    if (data.error || uiEvent.errorCode) {
        chunks.push({
            type: 'tool-output-error',
            toolCallId: data.toolCallId,
            errorText: data.error?.message ?? uiEvent.errorCode ?? 'tool error',
        })
        return chunks
    }
    chunks.push({
        type: 'tool-output-available',
        toolCallId: data.toolCallId,
        output: data.output,
        resources: data.resources,
        images: data.images,
    })
    return chunks
}
```

### 7.3 extractArtifacts 扩展 resources 解析

文件：`src/apps/web/src/agentEventProcessing.ts`

**关键设计**：`extractArtifacts` 只返回 artifact 元数据（用于 UI 列表渲染），实际的 HTML 内容从 `tool-output-available` chunk 的 `resources` 数组获取。渲染组件（`ArtifactIframe`/`PreviewResourceView`）需要同时接收 `ArtifactRef` 和 `ResourceEvent[]` 来渲染。

扩展 `extractArtifacts` 从 `result.resources` 数组提取 HTML resource 为元数据：

```ts
export function extractArtifacts(result: unknown): ArtifactRef[] {
    if (!result || typeof result !== 'object') return []
    const artifacts: ArtifactRef[] = []

    // 1. 从 artifacts 数组提取（已有）
    const rawArtifacts = (result as { artifacts?: unknown[] }).artifacts
    if (Array.isArray(rawArtifacts)) {
        artifacts.push(...rawArtifacts
            .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
            .filter((item) => typeof item.key === 'string' && typeof item.filename === 'string')
            .map((item) => ({
                key: item.key as string,
                filename: item.filename as string,
                size: typeof item.size === 'number' ? item.size : 0,
                mime_type: typeof item.mime_type === 'string' ? item.mime_type : '',
                title: typeof item.title === 'string' ? item.title : undefined,
                display: item.display === 'inline' || item.display === 'panel'
                    ? item.display as 'inline' | 'panel'
                    : undefined,
            })))
    }

    // 2. 从 resources 数组提取 HTML/Markdown resource 为元数据
    const rawResources = (result as { resources?: unknown[] }).resources
    if (Array.isArray(rawResources)) {
        for (const res of rawResources) {
            if (!res || typeof res !== 'object') continue
            const r = res as Record<string, unknown>
            const mimeType = typeof r.mime_type === 'string' ? r.mime_type : ''
            if (mimeType.startsWith('text/html') || mimeType === 'text/markdown' || mimeType === 'image/svg+xml') {
                const uri = typeof r.uri === 'string' ? r.uri : ''
                const text = typeof r.text === 'string' ? r.text : ''
                const size = typeof r.size === 'number' ? r.size : new TextEncoder().encode(text).length
                artifacts.push({
                    key: uri || 'resource',
                    filename: uri ? `${uri.split('/').pop() || 'resource'}.html` : 'resource.html',
                    size,
                    mime_type: mimeType,
                    title: uri || undefined,
                    display: 'inline',
                })
            }
        }
    }

    return artifacts
}
```

**渲染时获取 HTML 内容**：组件通过 `ArtifactRef.key`（即 resource URI）在 `resources` 数组中查找对应的 `ResourceEvent`，然后使用 `ResourceEvent.text` 作为 iframe 的 `srcDoc` 内容。

### 7.4 pipeline/mw_input_loader.go 处理 PartTypeResource

文件：`src/services/worker/internal/pipeline/mw_input_loader.go`

`BuildMessagePartsWithOptions()` 重建 message parts 时，需要处理 `content_json` 中的 `PartTypeResource`：

```go
case messagecontent.PartTypeResource:
    if part.Resource == nil {
        return nil, fmt.Errorf("resource part requires resource ref")
    }
    // 内联小内容
    if part.Resource.Text != "" {
        resourceCopy := *part.Resource
        parts = append(parts, llm.ContentPart{
            Type:     messagecontent.PartTypeResource,
            Resource: &resourceCopy,
            Data:     []byte(part.Resource.Text),
        })
        continue
    }
    // 大内容从 S3 加载（BlobKey）
    if part.Resource.BlobKey != "" {
        if store == nil {
            return nil, fmt.Errorf("message attachment store not configured")
        }
        dataBytes, contentType, err := store.GetWithContentType(ctx, part.Resource.BlobKey)
        if err != nil {
            if objectstore.IsNotFound(err) {
                return nil, fmt.Errorf("resource blob not found")
            }
            return nil, err
        }
        resourceCopy := *part.Resource
        if strings.TrimSpace(contentType) != "" {
            resourceCopy.MimeType = contentType
        }
        parts = append(parts, llm.ContentPart{
            Type:     messagecontent.PartTypeResource,
            Resource: &resourceCopy,
            Data:     dataBytes,
        })
        continue
    }
    return nil, fmt.Errorf("resource part missing both text and blob_key")
```

### 7.5 扩展 isIframeMime

文件：`src/apps/web/src/components/resource-preview/mime.ts:86`

用前缀匹配代替精确匹配，兼容带 profile 参数或其他参数的 MIME type：

```ts
export function isIframeMime(mimeType: string): boolean {
  if (!mimeType) return false
  const base = mimeType.split(';')[0].trim().toLowerCase()
  return base === 'text/html' || base === 'image/svg+xml'
}
```

## Phase 8: 验证

### 8.1 编译测试

```bash
cd src/services/worker && go build ./...
cd src/services/worker && go test ./internal/mcp/...
cd src/apps/web && pnpm build
```

### 8.2 端到端测试

1. 配置一个返回 `_meta.ui.resourceUri` 的 MCP server
2. 触发 tool 调用
3. 验证 worker 是否调用了 `resources/read`
4. 验证 SSE event 的 `data.resources` 是否包含 HTML 内容
5. 验证前端 `extractArtifacts` 是否提取了 HTML artifact
6. 验证前端是否渲染了 iframe

## 关键文件清单

| 文件 | 改动 |
|------|------|
| `src/services/worker/internal/mcp/pool.go` | Client 接口扩展 ListResources/ReadResource |
| `src/services/worker/internal/mcp/stdio_client.go` | Resource/ResourceContent 类型，ListResources/ReadResource 实现，Tool.Meta，ListTools 解析 _meta，Initialize 声明 capabilities |
| `src/services/worker/internal/mcp/http_client.go` | ListResources/ReadResource 实现，ListTools 解析 _meta，Initialize 声明 capabilities |
| `src/services/worker/internal/mcp/executor.go` | extractToolResourceURI（含弃用格式兼容），isToolVisibleToModel，ToolExecutor.resourceURIByToolName，Execute 中 ReadResource（用原始 ctx） |
| `src/services/worker/internal/mcp/registry.go` | 解析 _meta（含 visibility 过滤），构建 resourceURIs map，更新 NewToolExecutor 调用 |
| `src/services/worker/internal/tools/spec.go` | AgentToolSpec.ResourceURI |
| `src/services/worker/internal/tools/dispatch_executor.go` | **新增 ContentAttachment.URI 和 ContentAttachment.Text 字段** |
| `src/services/shared/messagecontent/content.go` | **新增 PartTypeResource 常量、ResourceRef 类型、Part.Resource 字段；Normalize/Projection/PromptText/ToJSON/FromJSON/cleanType 处理 resource** |
| `src/services/worker/internal/llm/contract.go` | **ContentPart 新增 Resource 字段，Kind() 识别 resource，添加 collectResourceParts，ToDataJSON 追加 resources（保留原有字段）** |
| `src/services/worker/internal/agent/loop.go` | **修复 toolResultFromExecution：区分 image 和 resource ContentAttachment** |
| `src/services/worker/internal/pipeline/mw_input_loader.go` | **BuildMessagePartsWithOptions 处理 PartTypeResource（内联 text + BlobKey 加载）** |
| `src/apps/web/src/agent-ui/contract.ts` | **新增 ResourceEvent、ImageEvent、AgentToolResultData.resources/images、tool-output-available.resources/images** |
| `src/apps/web/src/agent-ui/arkloop-adapter.ts` | **恢复 tool-result handler 中 resources/images 的传递** |
| `src/apps/web/src/agentEventProcessing.ts` | **扩展 extractArtifacts 从 result.resources 提取 HTML resource 元数据** |
| `src/apps/web/src/components/resource-preview/mime.ts` | isIframeMime 用前缀匹配支持 profile=mcp-app |
| `src/services/worker/internal/pipeline/context_compact_tiktoken.go` | **contextCompactImageTokens 扩展为 contextCompactMediaTokens，支持 resource token 估算** |
| `src/services/worker/internal/pipeline/context_compact.go` | **stripOlderImagePartsKeepingTail 同时处理 resource parts（无条件替换为占位符）** |

## 风险与注意事项

### 架构层

1. **Capability Negotiation 是规范 MUST**：如果 `initialize` 时不声明 `io.modelcontextprotocol/ui` 扩展能力，Server 可能不返回带 `_meta.ui` 的 tool，导致整个 ext-apps 链路静默失效。

2. **visibility 过滤不可遗漏**：`visibility: ["app"]` 的 tool 对 agent 隐藏。如果不过滤，app-only tool 会泄露给 agent，可能导致 agent 调用不可用的 tool。

3. **_meta 格式兼容**：同时支持 `_meta.ui.resourceUri`（新格式）和 `_meta["ui/resourceUri"]`（已弃用格式）。

### 数据链路层

4. **agent/loop.go 的 ContentAttachment 分类是方案 B 的核心**：回退后的代码将所有 attachment 都当作 image，必须修复。如果遗漏，HTML 会被 LLM 当作图片处理，导致无法渲染。

5. **messagecontent 序列化/反序列化必须完整**：`PartTypeResource` 需要在 `Normalize/Projection/PromptText/ToJSON/FromJSON/cleanType` 中全部处理。遗漏任一函数都会导致 resource part 在消息持久化/加载时丢失。

6. **pipeline/mw_input_loader.go 必须处理 PartTypeResource**：resume/replay 时从数据库加载历史消息，如果 `BuildMessagePartsWithOptions` 不支持 `PartTypeResource`，resource part 会丢失。

7. **ReadResource 必须使用原始 ctx**：不能用 `callCtx`（已被 CallTool 超时控制）。否则 CallTool 耗时较长时，ReadResource 会因 context 超时而失败。

8. **ToDataJSON 必须保留原有字段**：追加 `resources` 时不能删除 `tool_call_id`/`tool_name`/`usage`/`cost`，否则前端无法关联 tool result。

### 前端层

9. **前端 resource 链路缺一不可**：contract.ts 的类型定义、arkloop-adapter.ts 的传递、agentEventProcessing.ts 的提取，三个环节缺一不可。遗漏任一环节都会导致 HTML 无法到达渲染层。

10. **前端渲染组件需要同时接收 ArtifactRef 和 ResourceEvent[]**：`extractArtifacts` 只返回元数据，实际的 HTML text 从 `tool-output-available` chunk 的 `resources` 数组获取。渲染组件通过 `ArtifactRef.key`（即 URI）在 `resources` 数组中查找对应的 `text`。

11. **MIME type 匹配灵活性**：`text/html;profile=mcp-app` 包含 profile 参数，isIframeMime 必须用前缀匹配（`split(';')[0]`），不能用精确字符串匹配。

12. **size 计算用字节数**：JavaScript 中 `new TextEncoder().encode(text).length` 返回字节数，与 Go 后端 `len(string)` 一致。不能用 `text.length`（UTF-16 code units）。

### 兼容性

13. **resources/read 错误处理**：ReadResource 失败不应该影响 tool 的核心结果。记录日志后继续，tool 的核心输出仍然有效。

14. **与 EmbeddedResource 共存**：基础协议的 `EmbeddedResource`（`type: "resource"` 在 content 数组中）和 ext-apps 的 `resources/read` 可以共存。两者都会变成 ContentAttachment 进入同一条链路。

### Context Compact

15. **Resource parts 必须参与 token 估算**：HTML 内容可能很大（数十 KB），如果不计入 `contextCompactMediaTokens`，会导致 token 估算严重偏低，触发 context overflow。

16. **Resource parts 无条件 strip**：与 image 不同（可以保留最近 N 个），resource parts（HTML）对 LLM 没有语义价值，应**无条件**替换为占位符。如果遗漏，旧消息中的 HTML 会无限累积。

17. **contextCompactMediaTokens 的命名变更**：将 `contextCompactImageTokens` 改名为 `contextCompactMediaTokens`，所有调用点（`context_compact.go:425`）必须同步更新。
