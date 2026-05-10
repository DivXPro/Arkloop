package artifact

// Handle 轻量引用
type Handle struct {
	ID   string `json:"id"`
	Kind string `json:"kind"`
}

// Producer 来源信息
type Producer struct {
	Type     string  `json:"type"`
	ID       string  `json:"id"`
	RunID    *string `json:"runId,omitempty"`
	PluginID *string `json:"pluginId,omitempty"`
}

// Resource 完整资源描述，随消息传递
type Resource struct {
	ID           string         `json:"id"`
	Kind         string         `json:"kind"`
	Version      *string        `json:"version,omitempty"`
	Title        string         `json:"title"`
	Summary      *string        `json:"summary,omitempty"`
	Labels       []string       `json:"labels,omitempty"`
	MimeType     *string        `json:"mimeType,omitempty"`
	Producer     Producer       `json:"producer"`
	FetchMode    string         `json:"fetchMode"`
	Descriptor   map[string]any `json:"descriptor"`
	Capabilities []string       `json:"capabilities,omitempty"`
}
