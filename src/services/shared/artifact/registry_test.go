package artifact

import (
	"testing"
)

func TestRegistryExactMatch(t *testing.T) {
	r := NewRegistry()
	r.Register("foo.bar", KindConfig{InlineMode: "image", Viewer: strPtr("gallery")})

	cfg := r.Get("foo.bar")
	if cfg.InlineMode != "image" {
		t.Fatalf("expected inlineMode=image for exact match, got %s", cfg.InlineMode)
	}
	if cfg.Viewer == nil || *cfg.Viewer != "gallery" {
		t.Fatalf("expected viewer=gallery for exact match")
	}
}

func TestRegistryPrefixMatch(t *testing.T) {
	r := NewRegistry()
	r.RegisterPrefix("image.", KindConfig{InlineMode: "image"})

	cfg := r.Get("image.png")
	if cfg.InlineMode != "image" {
		t.Fatalf("expected inlineMode=image for prefix match, got %s", cfg.InlineMode)
	}
}

func TestRegistryExactOverridesPrefix(t *testing.T) {
	r := NewRegistry()
	r.RegisterPrefix("image.", KindConfig{InlineMode: "image"})
	r.Register("image.special", KindConfig{InlineMode: "card-preview"})

	cfg := r.Get("image.special")
	if cfg.InlineMode != "card-preview" {
		t.Fatalf("expected exact match to override prefix, got %s", cfg.InlineMode)
	}

	// other image kinds still use prefix
	cfg2 := r.Get("image.jpeg")
	if cfg2.InlineMode != "image" {
		t.Fatalf("expected prefix match for other image kinds, got %s", cfg2.InlineMode)
	}
}

func TestRegistryDefaultFallback(t *testing.T) {
	r := NewRegistry()
	r.Register("known", KindConfig{InlineMode: "image"})

	cfg := r.Get("unknown")
	if cfg.InlineMode != "link" {
		t.Fatalf("expected default fallback inlineMode=link, got %s", cfg.InlineMode)
	}
}

func TestRegistrySetDefault(t *testing.T) {
	r := NewRegistry()
	r.SetDefault(KindConfig{InlineMode: "iframe", Viewer: strPtr("editor")})

	cfg := r.Get("anything")
	if cfg.InlineMode != "iframe" {
		t.Fatalf("expected custom default inlineMode=iframe, got %s", cfg.InlineMode)
	}
	if cfg.Viewer == nil || *cfg.Viewer != "editor" {
		t.Fatalf("expected custom default viewer=editor")
	}
}

func strPtr(s string) *string {
	return &s
}

func TestDefaultRegistryBuiltin(t *testing.T) {
	// 验证 init 中注册的内置配置
	if DefaultRegistry.Get("image.png").InlineMode != "image" {
		t.Fatalf("expected image.png inlineMode=image")
	}
	if DefaultRegistry.Get("design.canvas").InlineMode != "card-preview" {
		t.Fatalf("expected design.canvas inlineMode=card-preview")
	}
	if DefaultRegistry.Get("document.markdown").InlineMode != "card-preview" {
		t.Fatalf("expected document.markdown inlineMode=card-preview")
	}
	if DefaultRegistry.Get("data.csv").InlineMode != "card-preview" {
		t.Fatalf("expected data.csv inlineMode=card-preview")
	}
}
