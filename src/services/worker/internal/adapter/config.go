package adapter

// MatchRule defines when an adapter should be triggered.
type MatchRule struct {
	Source   string `json:"source"`
	ToolName string `json:"toolName,omitempty"`
	Priority int    `json:"priority,omitempty"`
}

// ExtractRule defines how to extract data from the tool result.
type ExtractRule struct {
	Path string `json:"path"`
	Type string `json:"type"` // "array" or "object"
}

// FieldMapping defines a single field mapping with various strategies.
type FieldMapping struct {
	Field      string                  `json:"field,omitempty"`
	Value      any                     `json:"value,omitempty"`
	Template   string                  `json:"template,omitempty"`
	Vars       map[string]FieldMapping `json:"vars,omitempty"`
	Coalesce   []FieldMapping          `json:"coalesce,omitempty"`
	Fallback   *FieldMapping           `json:"fallback,omitempty"`
	Default    any                     `json:"default,omitempty"`
	Transform  string                  `json:"transform,omitempty"`
}

// ArtifactMapping defines how to map extracted data to an artifact.Resource.
type ArtifactMapping struct {
	ID          string                 `json:"id,omitempty"`
	Kind        FieldMapping           `json:"kind"`
	Title       FieldMapping           `json:"title,omitempty"`
	Summary     FieldMapping           `json:"summary,omitempty"`
	FetchMode   FieldMapping           `json:"fetchMode"`
	Display     FieldMapping           `json:"display,omitempty"`
	Descriptor  DescriptorMapping      `json:"descriptor,omitempty"`
	Version     FieldMapping           `json:"version,omitempty"`
	Labels      FieldMapping           `json:"labels,omitempty"`
	MimeType    FieldMapping           `json:"mimeType,omitempty"`
	Capabilities FieldMapping          `json:"capabilities,omitempty"`
}

// DescriptorMapping wraps the _mapping key for descriptor fields.
type DescriptorMapping struct {
	Mapping map[string]FieldMapping `json:"_mapping,omitempty"`
}

// Config is a single adapter configuration.
type Config struct {
	ID       string          `json:"id"`
	Name     string          `json:"name,omitempty"`
	Version  string          `json:"version,omitempty"`
	Enabled  bool            `json:"enabled,omitempty"`
	Match    MatchRule       `json:"match"`
	Extract  ExtractRule     `json:"extract"`
	Artifact ArtifactMapping `json:"artifact"`
}

// ConfigFile is the top-level wrapper for a platform's adapter configs.
type ConfigFile struct {
	System   string   `json:"system"`
	Version  string   `json:"version,omitempty"`
	Adapters []Config `json:"adapters"`
}
