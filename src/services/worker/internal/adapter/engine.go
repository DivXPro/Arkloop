package adapter

import (
	"fmt"

	"arkloop/services/shared/artifact"
	"github.com/google/uuid"
)

// Engine holds loaded adapter configs and executes conversions.
type Engine struct {
	configs []Config
}

// NewEngine creates an engine with the given configs.
func NewEngine(configs []Config) *Engine {
	return &Engine{configs: configs}
}

// FindMatch returns the first matching adapter config for the given tool result.
func (e *Engine) FindMatch(source string, toolName string) *Config {
	var best *Config
	bestPriority := -1
	for i := range e.configs {
		cfg := &e.configs[i]
		if !cfg.Enabled && cfg.Enabled != false {
			// Default to enabled if not explicitly set
			// In JSON, bool zero value is false, so we need a way to distinguish unset
			// For now, treat missing "enabled" as true
			if cfg.Match.Source != "" {
				// struct without explicit Enabled field
			}
		}
		if cfg.Match.Source != source {
			continue
		}
		if cfg.Match.ToolName != "" && cfg.Match.ToolName != toolName {
			continue
		}
		if cfg.Match.Priority > bestPriority {
			best = cfg
			bestPriority = cfg.Match.Priority
		}
	}
	return best
}

// Convert applies a matching adapter to the tool result and returns artifacts.
func (e *Engine) Convert(result map[string]any, source string, toolName string) ([]artifact.Resource, error) {
	cfg := e.FindMatch(source, toolName)
	if cfg == nil {
		return nil, nil
	}

	records, err := extractData(result, cfg.Extract)
	if err != nil {
		return nil, fmt.Errorf("adapter %q extract failed: %w", cfg.ID, err)
	}

	var resources []artifact.Resource
	for _, record := range records {
		res, err := buildArtifact(record, cfg.Artifact, toolName)
		if err != nil {
			return nil, fmt.Errorf("adapter %q build artifact failed: %w", cfg.ID, err)
		}
		resources = append(resources, res)
	}
	return resources, nil
}

// buildArtifact constructs an artifact.Resource from a single record.
func buildArtifact(data map[string]any, mapping ArtifactMapping, toolName string) (artifact.Resource, error) {
	// ID
	id := mapping.ID
	if id == "" {
		idVal, ok := data["id"]
		if ok {
			id = toString(idVal)
		}
	}
	if id == "" {
		id = uuid.New().String()
	}

	// Kind
	kind := toString(applyFieldMapping(data, mapping.Kind))
	if kind == "" {
		kind = "unknown"
	}

	// Title
	title := toString(applyFieldMapping(data, mapping.Title))
	if title == "" {
		title = "Untitled"
	}

	// Summary
	summary := toString(applyFieldMapping(data, mapping.Summary))

	// FetchMode
	fetchMode := toString(applyFieldMapping(data, mapping.FetchMode))
	if fetchMode == "" {
		fetchMode = "inline-json"
	}

	// Display
	display := toString(applyFieldMapping(data, mapping.Display))
	if display == "" {
		display = "inline"
	}

	// Version
	version := toString(applyFieldMapping(data, mapping.Version))

	// Labels
	labels := toStringArray(applyFieldMapping(data, mapping.Labels))

	// MimeType
	mimeType := toString(applyFieldMapping(data, mapping.MimeType))

	// Capabilities
	capabilities := toStringArray(applyFieldMapping(data, mapping.Capabilities))

	// Descriptor
	descriptor := buildDescriptor(data, mapping.Descriptor)
	if descriptor == nil {
		descriptor = make(map[string]any)
	}

	res := artifact.Resource{
		ID:           id,
		Kind:         kind,
		Title:        title,
		Labels:       labels,
		MimeType:     stringPtr(mimeType),
		FetchMode:    fetchMode,
		Display:      display,
		Capabilities: capabilities,
		Descriptor:   descriptor,
		Producer: artifact.Producer{
			Type: "agent",
			ID:   toolName,
		},
	}
	if summary != "" {
		res.Summary = &summary
	}
	if version != "" {
		res.Version = &version
	}
	return res, nil
}
