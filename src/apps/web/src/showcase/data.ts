import { useState, useEffect } from 'react'
import type { ShowcaseItem } from './types'

const defaultShowcases: ShowcaseItem[] = [
  {
    id: 'ecommerce-main-image',
    title: '电商主图生成',
    description: '上传商品图片，AI 自动生成多场景、多风格的专业电商主图',
    imageUrl: '/showcase/ecommerce-main.svg',
    prompt: '/ecommerce-image-generator 帮我生成电商主图',
    category: '电商',
  },
  {
    id: 'ecommerce-detail-image',
    title: '电商详情页图生成',
    description: '上传商品图片，AI 自动生成完整的电商详情页系列图片',
    imageUrl: '/showcase/ecommerce-detail.svg',
    prompt: '/ecommerce-image-generator 帮我生成电商详情页图',
    category: '电商',
  },
  {
    id: 'visual-prompt-cookbook',
    title: 'AI 视觉提示词 Cookbook',
    description: '从 41 种预设风格中挑选，快速生成海报、Logo、社媒图片等专业提示词',
    imageUrl: '/showcase/visual-cookbook.svg',
    prompt: '/ai-visual-prompt-cookbook 帮我设计一张海报',
    category: '设计',
  },
  {
    id: 'kimi-webbridge',
    title: 'Kimi WebBridge',
    description: '控制真实浏览器，支持导航、点击、输入、截图、表单填写等自动化操作',
    imageUrl: '/showcase/kimi-webbridge.svg',
    prompt: '/kimi-webbridge 帮我到小红书上搜索宠物猫信息看看大家最近关注什么哪些话题',
    category: '工具',
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
