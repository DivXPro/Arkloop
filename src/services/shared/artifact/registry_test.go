package artifact

import (
	"testing"
)

func TestRegistryExactMatch(t *testing.T) {
	r := NewRegistry()
	r.Register("foo.bar", KindConfig{Previewable: true, CardType: "thumbnail", DefaultDisplay: "inline"})

	cfg := r.Get("foo.bar")
	if !cfg.Previewable {
		t.Fatalf("expected previewable=true for exact match")
	}
	if cfg.CardType != "thumbnail" {
		t.Fatalf("expected cardType=thumbnail, got %s", cfg.CardType)
	}
}

func TestRegistryPrefixMatch(t *testing.T) {
	r := NewRegistry()
	r.RegisterPrefix("image.", KindConfig{Previewable: true, CardType: "thumbnail", DefaultDisplay: "inline"})

	cfg := r.Get("image.png")
	if !cfg.Previewable {
		t.Fatalf("expected previewable=true for prefix match")
	}
}

func TestRegistryExactOverridesPrefix(t *testing.T) {
	r := NewRegistry()
	r.RegisterPrefix("image.", KindConfig{Previewable: true, CardType: "thumbnail", DefaultDisplay: "inline"})
	r.Register("image.special", KindConfig{Previewable: false, CardType: "compact", DefaultDisplay: "inline"})

	cfg := r.Get("image.special")
	if cfg.Previewable {
		t.Fatalf("expected exact match to override prefix")
	}

	// other image kinds still use prefix
	cfg2 := r.Get("image.jpeg")
	if !cfg2.Previewable {
		t.Fatalf("expected prefix match for other image kinds")
	}
}

func TestRegistryDefaultFallback(t *testing.T) {
	r := NewRegistry()
	r.Register("known", KindConfig{Previewable: true, CardType: "thumbnail", DefaultDisplay: "inline"})

	cfg := r.Get("unknown")
	if cfg.Previewable {
		t.Fatalf("expected default fallback previewable=false")
	}
	if cfg.CardType != "compact" {
		t.Fatalf("expected default cardType=compact, got %s", cfg.CardType)
	}
}

func TestRegistrySetDefault(t *testing.T) {
	r := NewRegistry()
	r.SetDefault(KindConfig{Previewable: true, CardType: "detailed", DefaultDisplay: "collapsed"})

	cfg := r.Get("anything")
	if !cfg.Previewable {
		t.Fatalf("expected custom default previewable=true")
	}
	if cfg.DefaultDisplay != "collapsed" {
		t.Fatalf("expected custom default display=collapsed, got %s", cfg.DefaultDisplay)
	}
}

func TestDefaultRegistryBuiltin(t *testing.T) {
	// 验证 init 中注册的内置配置
	if !DefaultRegistry.Get("image.png").Previewable {
		t.Fatalf("expected image.png to be previewable")
	}
	if DefaultRegistry.Get("design.canvas").Previewable {
		t.Fatalf("expected design.canvas not to be previewable")
	}
	if DefaultRegistry.Get("document.markdown").CardType != "compact" {
		t.Fatalf("expected document.markdown cardType=compact")
	}
	if DefaultRegistry.Get("data.csv").CardType != "detailed" {
		t.Fatalf("expected data.csv cardType=detailed")
	}
}
