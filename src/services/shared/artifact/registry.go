package artifact

import "sync"

// KindConfig 定义某一 kind 的渲染与交互配置。
// 配置属于系统级（非消息字段），启动时注册，运行期只读。
// InlineMode 决定 inline 状态下的渲染方式；Viewer 指定打开时使用的 viewer（可选）。
type KindConfig struct {
	InlineMode string  `json:"inlineMode"`
	Viewer     *string `json:"viewer,omitempty"`
}

// Registry 维护 kind → KindConfig 的映射，支持精确匹配和前缀匹配。
type Registry struct {
	mu      sync.RWMutex
	exact    map[string]KindConfig
	prefix   map[string]KindConfig
	fallback KindConfig
}

// NewRegistry 创建一个空注册表。
func NewRegistry() *Registry {
	return &Registry{
		exact:    make(map[string]KindConfig),
		prefix:   make(map[string]KindConfig),
		fallback: KindConfig{
			InlineMode: "link",
		},
	}
}

// Register 注册一个 kind 的精确匹配配置。
func (r *Registry) Register(kind string, cfg KindConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.exact[kind] = cfg
}

// RegisterPrefix 注册一个前缀匹配配置（例如 "image." 匹配所有 image 子类型）。
func (r *Registry) RegisterPrefix(prefix string, cfg KindConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.prefix[prefix] = cfg
}

// Get 查询 kind 的配置，先精确匹配再前缀匹配，均未命中时返回 default。
func (r *Registry) Get(kind string) KindConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if cfg, ok := r.exact[kind]; ok {
		return cfg
	}
	for p, cfg := range r.prefix {
		if len(p) > 0 && len(kind) >= len(p) && kind[:len(p)] == p {
			return cfg
		}
	}
	return r.fallback
}

// SetDefault 修改未命中时的兜底配置。
func (r *Registry) SetDefault(cfg KindConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.fallback = cfg
}

// DefaultRegistry 是进程级单例，启动时由各模块写入内置配置。
var DefaultRegistry = NewRegistry()

func init() {
	// 图像类：inline 直接展示图片
	img := KindConfig{InlineMode: "image"}
	DefaultRegistry.RegisterPrefix("image.", img)

	// 设计类：inline 展示可预览的卡片
	design := KindConfig{InlineMode: "card-preview"}
	DefaultRegistry.RegisterPrefix("design.", design)

	// 文档类：inline 展示可预览的卡片
	doc := KindConfig{InlineMode: "card-preview"}
	DefaultRegistry.RegisterPrefix("document.", doc)

	// 代码类：inline 展示可预览的卡片
	code := KindConfig{InlineMode: "card-preview"}
	DefaultRegistry.RegisterPrefix("code.", code)

	// 数据类：inline 展示可预览的卡片
	data := KindConfig{InlineMode: "card-preview"}
	DefaultRegistry.RegisterPrefix("data.", data)

	// 精确匹配兜底
	unknown := KindConfig{InlineMode: "link"}
	DefaultRegistry.SetDefault(unknown)
}
