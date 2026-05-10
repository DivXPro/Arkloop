import type { KindConfig } from '@arkloop/shared'

// 客户端 kind 注册表：精确匹配 + 前缀匹配 + 兜底默认值

const exact = new Map<string, KindConfig>()
const prefix = new Map<string, KindConfig>()

let defaultConfig: KindConfig = {
  previewable: false,
  cardType: 'compact',
  defaultDisplay: 'inline',
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

// 图像类：支持内联预览
const img: KindConfig = { previewable: true, cardType: 'thumbnail', defaultDisplay: 'inline' }
registerKindPrefix('image.', img)

// 设计类：不预览，紧凑卡片
const design: KindConfig = { previewable: false, cardType: 'compact', defaultDisplay: 'inline' }
registerKindPrefix('design.', design)

// 文档类：不预览，紧凑卡片
const doc: KindConfig = { previewable: false, cardType: 'compact', defaultDisplay: 'inline' }
registerKindPrefix('document.', doc)

// 代码类：不预览，紧凑卡片
const code: KindConfig = { previewable: false, cardType: 'compact', defaultDisplay: 'inline' }
registerKindPrefix('code.', code)

// 数据类：不预览，详细卡片
const data: KindConfig = { previewable: false, cardType: 'detailed', defaultDisplay: 'inline' }
registerKindPrefix('data.', data)
