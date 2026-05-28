import { useState, useEffect } from 'react'
import type { ShowcaseItem } from './types'

const defaultShowcases: ShowcaseItem[] = [
  {
    id: 'ecommerce-main-image',
    title: '电商主图生成',
    description: '上传商品图片，AI 自动生成多场景、多风格的专业电商主图',
    imageUrl: '/showcase/ecommerce-main.svg',
    prompt: '/ecommerce-image-generator 我上传了商品图片，帮我生成电商主图',
    category: '电商',
  },
  {
    id: 'ecommerce-detail-image',
    title: '电商详情页图生成',
    description: '上传商品图片，AI 自动生成完整的电商详情页系列图片',
    imageUrl: '/showcase/ecommerce-detail.svg',
    prompt: '/ecommerce-image-generator 我上传了商品图片，帮我生成电商详情页图',
    category: '电商',
  },
  {
    id: 'visual-prompt-cookbook',
    title: 'AI 视觉提示词 Cookbook',
    description: '从 41 种预设风格中挑选，快速生成海报、Logo、社媒图片等专业提示词',
    imageUrl: '/showcase/visual-cookbook.svg',
    prompt: '/ai-visual-prompt-cookbook 帮我搜索视觉风格库，找几个适合品牌海报的参考模板看看',
    category: '设计',
  },
  {
    id: 'ecommerce-price-research',
    title: '电商价格调研',
    description: '自动浏览电商平台，分析商品价格、产品特性和品牌情况',
    imageUrl: '/showcase/ecommerce-research.svg',
    prompt: '/opencli-browser 从淘宝上调研防晒袖的市场情况，分析价格、产品特性和品牌的基本情况',
    category: '电商',
  },
  {
    id: 'x-to-xiaohongshu',
    title: 'X长文转小红书图文',
    description: '输入推特长文链接，自动提炼观点、生成读后感并配图，一站式转为小红书图文',
    imageUrl: '/showcase/x-to-xiaohongshu.svg',
    prompt: '/x-to-xiaohongshu 帮我把这篇推特长文转成小红书图文',
    category: '内容',
  },
]

export interface ShowcaseDataState {
  items: ShowcaseItem[]
  loading: boolean
  error: string | null
}

export function useShowcases(): ShowcaseDataState {
  const [items, setItems] = useState<ShowcaseItem[]>(defaultShowcases)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const endpoint = import.meta.env.VITE_SHOWCASE_API_URL
    if (!endpoint) return

    let cancelled = false
    setLoading(true)
    fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.showcases)) {
          setItems(data.showcases)
          setError(null)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { items, loading, error }
}
