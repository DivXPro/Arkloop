package mcp

import (
	"context"
	"encoding/base64"
	"strings"
	"time"

	"arkloop/services/worker/internal/tools"
)

const (
	ErrorClassMcpTimeout       = "mcp.timeout"
	ErrorClassMcpDisconnected  = "mcp.disconnected"
	ErrorClassMcpRpcError      = "mcp.rpc_error"
	ErrorClassMcpProtocolError = "mcp.protocol_error"
	ErrorClassMcpToolError     = "mcp.tool_error"
)

type ToolExecutor struct {
	server                   ServerConfig
	remoteToolNameByToolName map[string]string
	resourceURIByToolName    map[string]string // tool internal name -> ui:// URI
	pool                     *Pool
}

func NewToolExecutor(server ServerConfig, remote map[string]string, resourceURIs map[string]string, pool *Pool) *ToolExecutor {
	toolMap := map[string]string{}
	for key, value := range remote {
		toolMap[key] = value
	}
	uriMap := map[string]string{}
	for key, value := range resourceURIs {
		uriMap[key] = value
	}
	return &ToolExecutor{
		server:                   server,
		remoteToolNameByToolName: toolMap,
		resourceURIByToolName:    uriMap,
		pool:                     pool,
	}
}

func (e *ToolExecutor) Execute(
	ctx context.Context,
	toolName string,
	args map[string]any,
	execCtx tools.ExecutionContext,
	_ string,
) tools.ExecutionResult {
	started := time.Now()

	remoteName := e.remoteToolNameByToolName[toolName]
	if remoteName == "" {
		return tools.ExecutionResult{
			Error: &tools.ExecutionError{
				ErrorClass: ErrorClassMcpProtocolError,
				Message:    "MCP tool not registered",
				Details:    map[string]any{"tool_name": toolName, "server_id": e.server.ServerID},
			},
			DurationMs: durationMs(started),
		}
	}

	timeoutMs := e.server.CallTimeoutMs
	if execCtx.TimeoutMs != nil && *execCtx.TimeoutMs > 0 {
		timeoutMs = *execCtx.TimeoutMs
	}

	pool := e.pool
	if pool == nil {
		pool = NewPool()
	}

	client, err := pool.Borrow(ctx, e.server)
	if err != nil {
		return tools.ExecutionResult{
			Error: &tools.ExecutionError{
				ErrorClass: ErrorClassMcpProtocolError,
				Message:    "MCP client borrow failed: " + err.Error(),
				Details:    map[string]any{"tool_name": toolName, "server_id": e.server.ServerID},
			},
			DurationMs: durationMs(started),
		}
	}

	callCtx := ctx
	if timeoutMs > 0 {
		timeout := time.Duration(timeoutMs) * time.Millisecond
		var cancel context.CancelFunc
		callCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	result, err := client.CallTool(callCtx, remoteName, args, timeoutMs)
	if err != nil {
		return tools.ExecutionResult{
			Error:      toExecutionError(err, toolName, e.server.ServerID),
			DurationMs: durationMs(started),
		}
	}

	if result.IsError {
		return tools.ExecutionResult{
			Error: &tools.ExecutionError{
				ErrorClass: ErrorClassMcpToolError,
				Message:    "MCP tool returned error",
				Details: map[string]any{
					"tool_name": toolName,
					"server_id": e.server.ServerID,
					"content":   result.Content,
				},
			},
			DurationMs: durationMs(started),
		}
	}

	content, attachments := splitMCPContent(result.Content)

	// MCP ext-apps: 如果 tool 关联了 UI resource，读取 HTML 内容
	resourceURI := e.resourceURIByToolName[toolName]
	if resourceURI != "" {
		resourceContent, err := client.ReadResource(ctx, resourceURI, timeoutMs)
		if err == nil && (resourceContent.Text != "" || len(resourceContent.Blob) > 0) {
			data := []byte(resourceContent.Text)
			if len(data) == 0 {
				data = resourceContent.Blob
			}
			attachments = append([]tools.ContentAttachment{{
				MimeType: resourceContent.MimeType,
				Data:     data,
				URI:      resourceContent.URI,
				Text:     resourceContent.Text,
			}}, attachments...)
		}
	}

	return tools.ExecutionResult{
		ResultJSON:   map[string]any{"content": content},
		ContentParts: attachments,
		DurationMs:   durationMs(started),
	}
}

func splitMCPContent(content []map[string]any) ([]map[string]any, []tools.ContentAttachment) {
	if len(content) == 0 {
		return content, nil
	}
	cleaned := make([]map[string]any, 0, len(content))
	attachments := make([]tools.ContentAttachment, 0)
	for _, item := range content {
		itemType := strings.TrimSpace(stringFromAny(item["type"]))
		if strings.EqualFold(itemType, "image") {
			next, attachment, ok := imageContentAttachment(item)
			cleaned = append(cleaned, next)
			if ok {
				attachments = append(attachments, attachment)
			}
			continue
		}
		if strings.EqualFold(itemType, "resource") {
			next, attachment, ok := resourceContentAttachment(item)
			cleaned = append(cleaned, next)
			if ok {
				attachments = append(attachments, attachment)
			}
			continue
		}
		cleaned = append(cleaned, item)
	}
	return cleaned, attachments
}

func imageContentAttachment(item map[string]any) (map[string]any, tools.ContentAttachment, bool) {
	mimeType := firstMCPString(item["mimeType"], item["mime_type"])
	if mimeType == "" {
		mimeType = "image/png"
	}
	dataText := strings.TrimSpace(stringFromAny(item["data"]))
	data, err := decodeMCPImageData(dataText)
	if err != nil || len(data) == 0 {
		return map[string]any{
			"type":     "image",
			"mimeType": mimeType,
			"error":    "invalid_image_data",
		}, tools.ContentAttachment{}, false
	}
	return map[string]any{
		"type":     "image",
		"mimeType": mimeType,
		"bytes":    len(data),
		"attached": true,
	}, tools.ContentAttachment{MimeType: mimeType, Data: data}, true
}

func resourceContentAttachment(item map[string]any) (map[string]any, tools.ContentAttachment, bool) {
	mimeType := firstMCPString(item["mimeType"], item["mime_type"])
	if mimeType == "" {
		mimeType = "text/html"
	}
	uri := strings.TrimSpace(stringFromAny(item["uri"]))
	text := strings.TrimSpace(stringFromAny(item["text"]))
	data := []byte(text)
	if len(data) == 0 {
		dataText := strings.TrimSpace(stringFromAny(item["data"]))
		if decoded, err := base64.StdEncoding.DecodeString(dataText); err == nil {
			data = decoded
		}
	}
	if uri == "" && len(data) == 0 {
		return map[string]any{
			"type":     "resource",
			"mimeType": mimeType,
			"error":    "invalid_resource_data",
		}, tools.ContentAttachment{}, false
	}
	return map[string]any{
		"type":     "resource",
		"mimeType": mimeType,
		"uri":      uri,
		"bytes":    len(data),
		"attached": true,
	}, tools.ContentAttachment{
		MimeType: mimeType,
		Data:     data,
		URI:      uri,
		Text:     text,
	}, true
}

func decodeMCPImageData(value string) ([]byte, error) {
	if index := strings.Index(value, ","); strings.HasPrefix(value, "data:") && index >= 0 {
		value = value[index+1:]
	}
	if data, err := base64.StdEncoding.DecodeString(value); err == nil {
		return data, nil
	}
	return base64.RawStdEncoding.DecodeString(value)
}

func firstMCPString(values ...any) string {
	for _, value := range values {
		if text := strings.TrimSpace(stringFromAny(value)); text != "" {
			return text
		}
	}
	return ""
}

func stringFromAny(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func toExecutionError(err error, toolName string, serverID string) *tools.ExecutionError {
	switch typed := err.(type) {
	case TimeoutError:
		return &tools.ExecutionError{
			ErrorClass: ErrorClassMcpTimeout,
			Message:    typed.Error(),
			Details:    map[string]any{"tool_name": toolName, "server_id": serverID},
		}
	case DisconnectedError:
		return &tools.ExecutionError{
			ErrorClass: ErrorClassMcpDisconnected,
			Message:    typed.Error(),
			Details:    map[string]any{"tool_name": toolName, "server_id": serverID},
		}
	case RpcError:
		details := map[string]any{"tool_name": toolName, "server_id": serverID}
		if typed.Code != nil {
			details["code"] = *typed.Code
		}
		if typed.Data != nil {
			details["data"] = typed.Data
		}
		return &tools.ExecutionError{
			ErrorClass: ErrorClassMcpRpcError,
			Message:    typed.Error(),
			Details:    details,
		}
	case AuthRequiredError:
		details := map[string]any{
			"tool_name":     toolName,
			"server_id":     serverID,
			"auth_required": true,
			"reason":        typed.Reason,
		}
		if typed.StatusCode > 0 {
			details["status_code"] = typed.StatusCode
		}
		return &tools.ExecutionError{
			ErrorClass: ErrorClassMcpProtocolError,
			Message:    typed.Error(),
			Details:    details,
		}
	case ProtocolError:
		return &tools.ExecutionError{
			ErrorClass: ErrorClassMcpProtocolError,
			Message:    typed.Error(),
			Details:    map[string]any{"tool_name": toolName, "server_id": serverID},
		}
	default:
		return &tools.ExecutionError{
			ErrorClass: ErrorClassMcpProtocolError,
			Message:    "MCP tool call failed",
			Details:    map[string]any{"tool_name": toolName, "server_id": serverID},
		}
	}
}

func durationMs(started time.Time) int {
	elapsed := time.Since(started)
	millis := int(elapsed / time.Millisecond)
	if millis < 0 {
		return 0
	}
	return millis
}

func mapKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

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
