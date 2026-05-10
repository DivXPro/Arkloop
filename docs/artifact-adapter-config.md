# Artifact Adapter Configuration

> 本文档定义外部系统（如 CLI 工具、MCP Server、第三方 API）通过 JSON 配置接入 Arkloop Artifact Protocol 的规范。

---

## 1. 背景与目标

Arkloop 的 Artifact Protocol 要求消息中的 artifact 必须携带标准字段（`id`, `kind`, `title`, `fetchMode`, `descriptor` 等）。然而，外部系统输出的数据格式各不相同：

- CLI 工具（如 scopai）输出 JSON 数组，字段名与 artifact 标准字段不一致
- MCP Server 返回的 `content` 数组中嵌套自定义结构
- 第三方 API 返回的数据需要字段映射和值转换

**目标**：提供一种声明式的 JSON 配置机制，让外部系统无需编写代码即可接入 Artifact Protocol。

---

## 2. 架构位置

```
外部系统输出
    │
    ▼
┌─────────────────┐
│  JSON Adapter   │  ← 本文档定义的转换引擎
│  (Worker 内)    │
└─────────────────┘
    │
    ▼
标准 ArtifactResource[]
    │
    ▼
写入 message.metadata.artifacts
    │
    ▼
前端 InlineArtifactCard / Panel 渲染
```

---

## 3. 配置文件格式

配置文件为 JSON，一个平台/系统对应一个文件。

### 3.1 文件位置

| 存储方式 | 适用场景 | 路径/Key |
|----------|----------|----------|
| **本地文件** | 开发环境、自托管部署 | `~/.arkloop/adapters/*.json`（可通过 `ARKLOOP_ADAPTER_CONFIG_DIR` 覆盖） |
| **数据库** | SaaS/多租户生产环境 | `platform_settings` 表 `key = "adapter_configs"`，值为 JSON 数组 |

> Arkloop 现有配置系统通过 `config.Store` 读取 `platform_settings` / `project_settings` 表。适配器配置复用该机制，生产环境推荐数据库存储；本地开发可用文件目录便于快速迭代。

### 3.2 顶层结构

每个平台一个文件，顶层描述系统信息，`adapters` 数组存放具体的适配器配置：

```json
{
  "system": "scopai",
  "version": "1.0.0",
  "adapters": [
    {
      "id": "scopai-posts-v1",
      "name": "Scopai Search Posts",
      "enabled": true,
      "match": {
        "source": "tool-result",
        "toolName": "mcp__scopai__search_posts",
        "priority": 100
      },
      "extract": {
        "path": "$.posts",
        "type": "array"
      },
      "artifact": {
        "kind": { "value": "social.post" },
        "title": { "coalesce": [{ "field": "title" }, { "field": "content", "transform": "truncate:60" }] },
        "fetchMode": { "value": "inline-json" },
        "display": { "value": "inline" },
        "descriptor": {
          "_mapping": {
            "platform": { "field": "platform_id" },
            "url": { "field": "url" },
            "publishedAt": { "field": "published_at" },
            "author": {
              "_mapping": {
                "name": { "field": "author_name" }
              }
            },
            "cover": { "field": "cover_url" },
            "metrics": {
              "_mapping": {
                "likes": { "field": "like_count", "default": 0 },
                "comments": { "field": "comment_count", "default": 0 }
              }
            }
          }
        }
      }
    }
  ]
}
```

### 3.3 字段说明

**ConfigFile（顶层）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `system` | string | 是 | 系统/平台标识，如 `scopai`、`weibo`、`taobao` |
| `version` | string | 否 | 配置文件整体版本号 |
| `adapters` | array | 是 | 该平台的适配器配置列表 |

**Adapter（数组元素）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 配置唯一标识 |
| `name` | string | 否 | 人类可读名称 |
| `enabled` | bool | 否 | 是否启用，默认 `true` |
| `match` | object | 是 | 触发匹配条件 |
| `match.source` | string | 是 | 数据源类型：`tool-result` / `mcp-content` / `http-response` |
| `match.toolName` | string | 条件 | 当 `source` 为 `tool-result` 时必填 |
| `match.priority` | int | 否 | 匹配优先级，数值越高越优先，默认 0 |
| `extract` | object | 是 | 数据提取规则 |
| `extract.path` | string | 是 | JSONPath 提取路径 |
| `extract.type` | string | 是 | 提取结果类型：`array` / `object` |
| `artifact` | object | 是 | Artifact 字段映射定义 |

---

## 4. 映射语法

每个字段映射支持以下语法：

### 4.1 `field` — 字段提取

从源数据中提取指定路径的字段值。

```json
{
  "title": { "field": "content.title" }
}
```

支持嵌套路径（`.` 分隔）和数组索引：

```json
{
  "author": { "field": "users.0.name" },
  "tags": { "field": "meta.tags" }
}
```

### 4.2 `value` — 常量值

直接指定固定值。

```json
{
  "kind": { "value": "social.post" },
  "fetchMode": { "value": "inline-json" }
}
```

### 4.3 `template` — 字符串模板

使用 `{varName}` 占位符拼接字符串，`vars` 中定义每个变量的提取规则。

```json
{
  "title": {
    "template": "[{platform}] {author}: {summary}",
    "vars": {
      "platform": { "field": "source_platform" },
      "author": { "field": "author.name", "default": "Unknown" },
      "summary": { "field": "content.title", "fallback": "field:content.text" }
    }
  }
}
```

### 4.4 `coalesce` — 多字段依次回退

按顺序尝试多个字段，返回第一个非空值。

```json
{
  "title": {
    "coalesce": [
      { "field": "content.title" },
      { "field": "content.headline" },
      { "field": "content.text", "transform": "truncate:50" }
    ]
  }
}
```

### 4.5 `fallback` — 单字段回退

当主字段缺失或为空时，使用回退字段。简化的 `coalesce` 双字段写法。

```json
{
  "title": { "field": "content.title", "fallback": "field:content.text" }
}
```

> `fallback: "field:xxx"` 是 `fallback: { "field": "xxx" }` 的简写。

### 4.6 `default` — 默认值

当字段提取结果为 `null`、`undefined`、空字符串或缺失时，使用默认值。

```json
{
  "likes": { "field": "engagement.likes", "default": 0 },
  "language": { "field": "detected_lang", "default": "unknown" }
}
```

### 4.7 `transform` — 值转换（可选扩展）

对提取的值进行转换处理。

```json
{
  "publishedAt": { "field": "created_at", "transform": "iso8601" },
  "text": { "field": "content.body", "transform": "truncate:200" },
  "url": { "field": "link", "transform": "absolutize:https://example.com" }
}
```

内置转换函数：

| 转换函数 | 说明 | 示例 |
|----------|------|------|
| `iso8601` | 标准化为 ISO 8601 时间字符串 | `"2024-01-15"` → `"2024-01-15T00:00:00Z"` |
| `truncate:N` | 截断至 N 个字符 | `"hello world"` → `"hello..."` |
| `absolutize:base` | 将相对路径转为绝对 URL | `"/path"` → `"https://example.com/path"` |
| `join:sep` | 数组用分隔符连接 | `["a","b"]` → `"a, b"` |
| `markdown` | 提取 Markdown 中的纯文本 | `"**bold**"` → `"bold"` |

---

## 5. Descriptor 映射

`descriptor` 用于存储 artifact 特有的结构化数据，在映射定义中使用 `_mapping` 键。

```json
{
  "artifact": {
    "descriptor": {
      "_mapping": {
        "url": { "field": "permalink" },
        "author": {
          "_mapping": {
            "name": { "field": "author.name" },
            "avatar": { "field": "author.avatar_url" }
          }
        },
        "metrics": {
          "_mapping": {
            "likes": { "field": "stats.likes", "default": 0 },
            "comments": { "field": "stats.comments", "default": 0 }
          }
        }
      }
    }
  }
}
```

`_mapping` 中的规则与普通字段映射语法完全一致，支持嵌套对象。

---

## 6. 卡片模板字段契约

前端根据 `kindConfig.inlineMode` 选择渲染模板。各模板约定读取的 `descriptor` 字段如下：

### 6.1 `social-card` — 社媒卡片

适用 kind：`social.post` 等 `social.*`

| descriptor 字段 | 类型 | 说明 |
|----------------|------|------|
| `cover` | string | 封面图 URL |
| `platform` | string | 平台名（如 xiaohongshu、weibo） |
| `author` | string / `{name, avatar}` | 作者信息 |
| `publishedAt` | string | 发布时间 |
| `metrics` | `{likes, comments, shares, collects}` | 结构化互动数据 |
| `metricsLabel` | string | 预设指标文本（兜底） |

**字段标准化**：不同平台的原始字段名不同，adapter 负责映射到统一的契约字段名。

```json
// 小红书
"metrics": {
  "_mapping": {
    "likes": { "field": "like_count" },
    "comments": { "field": "comment_count" },
    "shares": { "field": "share_count" },
    "collects": { "field": "collect_count" }
  }
}

// 微博
"metrics": {
  "_mapping": {
    "likes": { "field": "attitudes_count" },
    "comments": { "field": "comments_count" },
    "shares": { "field": "reposts_count" }
  }
}
```

### 6.2 `product-card` — 电商卡片

适用 kind：`ecommerce.product` 等 `ecommerce.*`

| descriptor 字段 | 类型 | 说明 |
|----------------|------|------|
| `image` | string | 商品主图 URL |
| `price` | number / string | 当前价格 |
| `originalPrice` | number / string | 原价（显示划线价） |
| `rating` | number | 评分（1-5） |
| `brand` | string | 品牌名 |
| `stock` | number | 库存数量 |
| `sales` | number | 销量 |

### 6.3 `card-preview` — 通用卡片

适用 kind：`design.*`、`document.*`、`code.*`、`data.*` 等

基于字段存在性自适应渲染，支持所有常见字段：`image`/`cover`/`thumbnail`、`platform`、`author`、`publishedAt`、`metrics`、`price`、`rating`、`tags` 等。

---

## 7. 完整示例：scopai 接入

### 7.1 scopai CLI 原始输出

```json
{
  "query": "AI trends",
  "total": 42,
  "posts": [
    {
      "id": "scopai_12345",
      "platform_id": "xiaohongshu",
      "published_at": "2024-01-15T08:30:00Z",
      "author_name": "AI Research Daily",
      "author_id": "ai_research",
      "cover_url": "https://cdn.example.com/image1.jpg",
      "title": null,
      "content": "Just published our latest findings on transformer architectures...",
      "url": "https://xiaohongshu.com/ai_research/12345",
      "like_count": 342,
      "comment_count": 56,
      "collect_count": 128,
      "share_count": 12
    }
  ]
}
```

### 7.2 Adapter 配置

`~/.arkloop/adapters/scopai.json`：

```json
{
  "system": "scopai",
  "version": "1.0.0",
  "adapters": [
    {
      "id": "scopai-posts-v1",
      "name": "Scopai Search Posts",
      "enabled": true,
      "match": {
        "source": "tool-result",
        "toolName": "mcp__scopai__search_posts",
        "priority": 100
      },
      "extract": {
        "path": "$.posts",
        "type": "array"
      },
      "artifact": {
        "id": { "field": "id" },
        "kind": { "value": "social.post" },
        "title": {
          "coalesce": [
            { "field": "title" },
            { "field": "content", "transform": "truncate:60" }
          ]
        },
        "summary": { "field": "content", "transform": "truncate:200" },
        "fetchMode": { "value": "inline-json" },
        "display": { "value": "inline" },
        "descriptor": {
          "_mapping": {
            "platform": { "field": "platform_id" },
            "url": { "field": "url" },
            "viewerUrl": { "field": "url" },
            "publishedAt": { "field": "published_at" },
            "author": {
              "_mapping": {
                "name": { "field": "author_name" },
                "id": { "field": "author_id" }
              }
            },
            "cover": { "field": "cover_url" },
            "metrics": {
              "_mapping": {
                "likes": { "field": "like_count", "default": 0 },
                "comments": { "field": "comment_count", "default": 0 },
                "collects": { "field": "collect_count", "default": 0 },
                "shares": { "field": "share_count", "default": 0 }
              }
            },
            "metricsLabel": {
              "template": "♥ {likes}  💬 {comments}  ⭐ {collects}  ↗ {shares}",
              "vars": {
                "likes": { "field": "like_count", "default": 0 },
                "comments": { "field": "comment_count", "default": 0 },
                "collects": { "field": "collect_count", "default": 0 },
                "shares": { "field": "share_count", "default": 0 }
              }
            }
          }
        }
      }
    },
    {
      "id": "scopai-posts-list-v1",
      "name": "Scopai List Posts",
      "enabled": true,
      "match": {
        "source": "tool-result",
        "toolName": "mcp__scopai__list_posts",
        "priority": 100
      },
      "extract": {
        "path": "$.posts",
        "type": "array"
      },
      "artifact": {
        "id": { "field": "id" },
        "kind": { "value": "social.post" },
        "title": {
          "coalesce": [
            { "field": "title" },
            { "field": "content", "transform": "truncate:60" }
          ]
        },
        "summary": { "field": "content", "transform": "truncate:200" },
        "fetchMode": { "value": "inline-json" },
        "display": { "value": "inline" },
        "descriptor": {
          "_mapping": {
            "platform": { "field": "platform_id" },
            "url": { "field": "url" },
            "viewerUrl": { "field": "url" },
            "publishedAt": { "field": "published_at" },
            "author": {
              "_mapping": {
                "name": { "field": "author_name" },
                "id": { "field": "author_id" }
              }
            },
            "cover": { "field": "cover_url" },
            "metrics": {
              "_mapping": {
                "likes": { "field": "like_count", "default": 0 },
                "comments": { "field": "comment_count", "default": 0 },
                "collects": { "field": "collect_count", "default": 0 },
                "shares": { "field": "share_count", "default": 0 }
              }
            },
            "metricsLabel": {
              "template": "♥ {likes}  💬 {comments}  ⭐ {collects}  ↗ {shares}",
              "vars": {
                "likes": { "field": "like_count", "default": 0 },
                "comments": { "field": "comment_count", "default": 0 },
                "collects": { "field": "collect_count", "default": 0 },
                "shares": { "field": "share_count", "default": 0 }
              }
            }
          }
        }
      }
    }
  ]
}
```

### 7.3 转换后的 Artifact

```json
{
  "id": "scopai_12345",
  "kind": "social.post",
  "title": "Just published our latest findings on transformer architectures...",
  "summary": "Just published our latest findings on transformer architectures...",
  "fetchMode": "inline-json",
  "display": "inline",
  "descriptor": {
    "platform": "xiaohongshu",
    "url": "https://xiaohongshu.com/ai_research/12345",
    "viewerUrl": "https://xiaohongshu.com/ai_research/12345",
    "publishedAt": "2024-01-15T08:30:00Z",
    "author": {
      "name": "AI Research Daily",
      "id": "ai_research"
    },
    "cover": "https://cdn.example.com/image1.jpg",
    "metrics": {
      "likes": 342,
      "comments": 56,
      "collects": 128,
      "shares": 12
    },
    "metricsLabel": "♥ 342  💬 56  ⭐ 128  ↗ 12"
  }
}
```

---

## 8. 前端渲染配合

### 8.1 Kind 注册

后端 `registry.go` 注册 kind → inlineMode 映射：

```go
func init() {
    // 图像类：inline 直接展示图片
    img := KindConfig{InlineMode: "image"}
    DefaultRegistry.RegisterPrefix("image.", img)

    // 设计/文档/代码/数据类：通用卡片
    design := KindConfig{InlineMode: "card-preview"}
    DefaultRegistry.RegisterPrefix("design.", design)
    DefaultRegistry.RegisterPrefix("document.", design)
    DefaultRegistry.RegisterPrefix("code.", design)
    DefaultRegistry.RegisterPrefix("data.", design)

    // 社媒类：专用社媒卡片
    social := KindConfig{InlineMode: "social-card"}
    DefaultRegistry.RegisterPrefix("social.", social)

    // 电商类：专用商品卡片
    ecommerce := KindConfig{InlineMode: "product-card"}
    DefaultRegistry.RegisterPrefix("ecommerce.", ecommerce)
}
```

### 8.2 前端组件结构

```
src/apps/web/src/components/
├── InlineArtifactCard.tsx          # 入口，按 inlineMode 分发
└── artifact-cards/
    ├── index.ts                    # 统一导出
    ├── GenericCard.tsx             # card-preview：通用卡片
    ├── SocialCard.tsx              # social-card：社媒专用卡片
    └── ProductCard.tsx             # product-card：电商专用卡片
```

### 8.3 渲染流程

```
artifact.kind = "social.post"
    │
    ▼
getKindConfig("social.post") → { inlineMode: "social-card" }
    │
    ▼
InlineArtifactCard 渲染标题行 + SocialCard 预览区
```

---

## 9. 方案对比

| 维度 | JSON Config Adapter（本文档） | JS Plugin Adapter | Go Plugin Adapter |
|------|------------------------------|-------------------|-------------------|
| **接入成本** | 低（写 JSON 配置） | 中（写 JS 代码） | 高（写 Go 代码 + 编译） |
| **灵活性** | 中（声明式映射） | 高（任意逻辑） | 高（任意逻辑） |
| **运行时安全** | 高（无用户代码） | 中（沙箱 JS） | 高（编译期检查） |
| **热更新** | 是（配置即时生效） | 是（动态加载） | 否（需重启 Worker） |
| **适用场景** | 字段映射、简单转换 | 复杂逻辑、外部调用 | 性能敏感、深度集成 |
| **维护方** | 系统管理员 / 运营 | 开发者 | 开发者 |

**建议**：
- 外部系统接入优先使用 **JSON Config Adapter**
- 需要复杂转换逻辑时升级到 **JS Plugin Adapter**
- 性能关键路径或需要访问内部 API 时使用 **Go Plugin Adapter**

---

## 10. 实现要点（Worker 侧）

### 10.1 配置加载

复用 Arkloop 现有 `config.Store` 接口，支持文件与数据库两种来源：

```go
// ConfigFile 顶层配置文件
type ConfigFile struct {
    System   string   `json:"system"`
    Version  string   `json:"version,omitempty"`
    Adapters []Config `json:"adapters"`
}

// Config 单个适配器配置
type Config struct {
    ID       string          `json:"id"`
    Name     string          `json:"name,omitempty"`
    Enabled  bool            `json:"enabled,omitempty"`
    Match    MatchRule       `json:"match"`
    Extract  ExtractRule     `json:"extract"`
    Artifact ArtifactMapping `json:"artifact"`
}

// Loader 统一配置加载接口
type Loader interface {
    LoadAll(ctx context.Context) ([]Config, error)
}

// FileLoader：开发环境从 ~/.arkloop/adapters/*.json 加载
// 支持三种格式：
//   1. ConfigFile 对象 { system, version, adapters: [...] }
//   2. Config 数组 [{...}, {...}]（向后兼容）
//   3. 单个 Config 对象 {...}（向后兼容）
type FileLoader struct{ Dir string }

// DBLoader：生产环境从 platform_settings 表加载
// key = "adapter_configs"，value = JSON 数组
type DBLoader struct {
    Store config.Store
}
```

环境变量控制加载方式：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `ARKLOOP_ADAPTER_CONFIG_DIR` | `~/.arkloop/adapters` | 文件目录路径，设为空字符串则禁用文件加载 |
| `ARKLOOP_ADAPTER_CONFIG_KEY` | `adapter_configs` | 数据库 settings 表的 key |

Worker 启动时优先尝试文件目录，若目录不存在或为空，则回退到数据库加载。

### 10.2 转换引擎

```go
// 在 extractArtifactsFromToolResult 中调用
func (e *Engine) Convert(result map[string]any, source string, toolName string) ([]artifact.Resource, error) {
    // 1. 用 JSONPath 提取源数据
    // 2. 遍历每条记录，应用字段映射
    // 3. 返回标准 ArtifactResource 数组
}
```

### 10.3 匹配优先级

1. 精确匹配 `toolName`
2. 按 `match.priority` 排序（数值越高越优先）
3. 同一 `toolName` 只允许一个适配器生效

---

## 11. 演进路线

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| P0 | 实现 JSON Config 基础引擎（field/value/template/fallback/default） | 已完成 |
| P1 | 支持 `coalesce`、`transform` 和嵌套 descriptor 映射 | 已完成 |
| P2 | 专用卡片模板（social-card、product-card） | 已完成 |
| P3 | 字段标准化（metrics 通用契约） | 已完成 |
| P4 | 支持从数据库/远程 URL 加载配置 | 中 |
| P5 | 提供配置校验 CLI 工具 | 中 |
| P6 | 内置常用外部系统配置模板 | 低 |
