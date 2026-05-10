import type { KindConfig } from '@arkloop/shared'

// 客户端 kind 注册表：精确匹配 + 前缀匹配 + 兜底默认值

const exact = new Map<string, KindConfig>()
const prefix = new Map<string, KindConfig>()

let defaultConfig: KindConfig = {
  inlineMode: 'link',
}

export function registerKind(kind: string, config: KindConfig): void {
  exact.set(kind, config)
}

export function registerKindPrefix(prefixStr: string, config: KindConfig): void {
  prefix.set(prefixStr, config)
}

export function getKindConfig(kind: string): KindConfig {
  if (exact.has(kind)) {
    return exact.get(kind)!
  }
  for (const [p, cfg] of prefix) {
    if (kind.startsWith(p)) {
      return cfg
    }
  }
  return defaultConfig
}

export function setDefaultKindConfig(config: KindConfig): void {
  defaultConfig = config
}

// --- 内置配置 ---

// 图像类：inline 直接展示图片
const img: KindConfig = { inlineMode: 'image' }
registerKindPrefix('image.', img)

// 设计类：inline 展示可预览的卡片
const design: KindConfig = { inlineMode: 'card-preview' }
registerKindPrefix('design.', design)

// 文档类：inline 展示可预览的卡片
const doc: KindConfig = { inlineMode: 'card-preview' }
registerKindPrefix('document.', doc)

// 代码类：inline 展示可预览的卡片
const code: KindConfig = { inlineMode: 'card-preview' }
registerKindPrefix('code.', code)

// 数据类：inline 展示可预览的卡片
const data: KindConfig = { inlineMode: 'card-preview' }
registerKindPrefix('data.', data)

// 社媒类：专用社媒卡片
const social: KindConfig = { inlineMode: 'social-card' }
registerKindPrefix('social.', social)

// 电商类：专用商品卡片
const ecommerce: KindConfig = { inlineMode: 'product-card' }
registerKindPrefix('ecommerce.', ecommerce)
