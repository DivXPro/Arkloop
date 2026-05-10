package adapter

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
)

// resolveField extracts a nested value from data using dot-separated path.
// Supports array indices like "users.0.name".
func resolveField(data map[string]any, path string) (any, bool) {
	parts := strings.Split(path, ".")
	current := any(data)
	for _, part := range parts {
		if current == nil {
			return nil, false
		}
		switch v := current.(type) {
		case map[string]any:
			next, ok := v[part]
			if !ok {
				return nil, false
			}
			current = next
		case []any:
			idx, err := strconv.Atoi(part)
			if err != nil || idx < 0 || idx >= len(v) {
				return nil, false
			}
			current = v[idx]
		case map[any]any:
			next, ok := v[part]
			if !ok {
				return nil, false
			}
			current = next
		default:
			return nil, false
		}
	}
	return current, true
}

// isEmpty checks if a value is nil, empty string, or empty slice.
func isEmpty(v any) bool {
	if v == nil {
		return true
	}
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val) == ""
	case []any:
		return len(val) == 0
	default:
		return false
	}
}

// applyTransform applies a transform to a value.
func applyTransform(v any, transform string) any {
	if transform == "" || v == nil {
		return v
	}

	parts := strings.SplitN(transform, ":", 2)
	name := parts[0]
	arg := ""
	if len(parts) > 1 {
		arg = parts[1]
	}

	switch name {
	case "truncate":
		n, _ := strconv.Atoi(arg)
		if n <= 0 {
			n = 100
		}
		s := toString(v)
		if len(s) > n {
			return s[:n-3] + "..."
		}
		return s
	case "join":
		arr, ok := v.([]any)
		if !ok {
			return v
		}
		sep := arg
		if sep == "" {
			sep = ", "
		}
		var parts []string
		for _, item := range arr {
			parts = append(parts, toString(item))
		}
		return strings.Join(parts, sep)
	case "absolutize":
		s := toString(v)
		if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
			return s
		}
		base := arg
		if base == "" {
			return s
		}
		base = strings.TrimSuffix(base, "/")
		if !strings.HasPrefix(s, "/") {
			s = "/" + s
		}
		return base + s
	case "iso8601":
		s := toString(v)
		// Pass through if already ISO8601-ish
		return s
	case "markdown":
		// Stub: strip markdown syntax
		return toString(v)
	default:
		return v
	}
}

// toString converts any value to string.
func toString(v any) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(val)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// applyFieldMapping applies a single FieldMapping to source data and returns the resolved value.
func applyFieldMapping(data map[string]any, fm FieldMapping) any {
	// 1. Constant value
	if fm.Value != nil {
		return fm.Value
	}

	// 2. Template
	if fm.Template != "" {
		return applyTemplate(data, fm.Template, fm.Vars)
	}

	// 3. Coalesce
	if len(fm.Coalesce) > 0 {
		for _, candidate := range fm.Coalesce {
			v := applyFieldMapping(data, candidate)
			if !isEmpty(v) {
				if candidate.Transform != "" {
					return applyTransform(v, candidate.Transform)
				}
				return v
			}
		}
		return nil
	}

	// 4. Field extraction
	var result any
	if fm.Field != "" {
		v, ok := resolveField(data, fm.Field)
		if ok {
			result = v
		}
	}

	// 5. Fallback
	if isEmpty(result) && fm.Fallback != nil {
		result = applyFieldMapping(data, *fm.Fallback)
	}

	// 6. Default
	if isEmpty(result) && fm.Default != nil {
		result = fm.Default
	}

	// 7. Transform
	if result != nil && fm.Transform != "" {
		result = applyTransform(result, fm.Transform)
	}

	return result
}

// applyTemplate replaces {varName} placeholders using vars mappings.
func applyTemplate(data map[string]any, template string, vars map[string]FieldMapping) string {
	if vars == nil {
		return template
	}
	result := template
	for name, fm := range vars {
		v := applyFieldMapping(data, fm)
		placeholder := "{" + name + "}"
		result = strings.ReplaceAll(result, placeholder, toString(v))
	}
	return result
}

// extractData extracts data from the tool result based on the extract rule.
// For "array" type, returns []map[string]any.
// For "object" type, returns single-element []map[string]any.
func extractData(result map[string]any, rule ExtractRule) ([]map[string]any, error) {
	var data any = result

	if rule.Path != "" && rule.Path != "$" {
		v, ok := resolveField(result, strings.TrimPrefix(rule.Path, "$."))
		if !ok {
			return nil, fmt.Errorf("extract path %q not found", rule.Path)
		}
		data = v
	}

	switch rule.Type {
	case "array":
		arr, ok := data.([]any)
		if !ok {
			return nil, fmt.Errorf("extract path %q is not an array", rule.Path)
		}
		out := make([]map[string]any, 0, len(arr))
		for _, item := range arr {
			m, ok := item.(map[string]any)
			if ok {
				out = append(out, m)
			}
		}
		return out, nil
	case "object":
		m, ok := data.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("extract path %q is not an object", rule.Path)
		}
		return []map[string]any{m}, nil
	default:
		return nil, fmt.Errorf("unsupported extract type: %s", rule.Type)
	}
}

// buildDescriptor builds a descriptor map from mapping rules.
func buildDescriptor(data map[string]any, dm DescriptorMapping) map[string]any {
	if len(dm.Mapping) == 0 {
		return nil
	}
	result := make(map[string]any, len(dm.Mapping))
	for key, fm := range dm.Mapping {
		v := applyFieldMappingForDescriptor(data, fm)
		if v != nil {
			result[key] = v
		}
	}
	return result
}

// applyFieldMappingForDescriptor handles descriptor mapping (supports nested _mapping).
func applyFieldMappingForDescriptor(data map[string]any, fm FieldMapping) any {
	// Check if this is a nested mapping
	if len(fm.Vars) > 0 && fm.Template == "" {
		// This might be a nested descriptor with _mapping
		// In our structure, nested descriptors are represented as FieldMapping with nested _mapping
		// We handle this by checking if the FieldMapping has no direct field/value/template
		// but we still need to extract something
	}

	// For nested objects with _mapping, we need a different approach
	// Check if this FieldMapping represents a nested descriptor by looking at the ArtifactMapping structure
	// This is handled at the caller level via buildDescriptor

	v := applyFieldMapping(data, fm)
	return v
}

// stringSlice converts any to []string.
func stringSlice(v any) []string {
	if v == nil {
		return nil
	}
	switch val := v.(type) {
	case []string:
		return val
	case []any:
		out := make([]string, 0, len(val))
		for _, item := range val {
			s := toString(item)
			if s != "" {
				out = append(out, s)
			}
		}
		return out
	case string:
		if val == "" {
			return nil
		}
		return []string{val}
	default:
		return nil
	}
}

// stringPtr returns a pointer to a string value.
func stringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// toStringArray converts any value to a string slice for artifact fields.
func toStringArray(v any) []string {
	if v == nil {
		return nil
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Slice, reflect.Array:
		out := make([]string, 0, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			s := toString(rv.Index(i).Interface())
			if s != "" {
				out = append(out, s)
			}
		}
		return out
	case reflect.String:
		s := rv.String()
		if s == "" {
			return nil
		}
		return []string{s}
	default:
		s := toString(v)
		if s == "" {
			return nil
		}
		return []string{s}
	}
}
