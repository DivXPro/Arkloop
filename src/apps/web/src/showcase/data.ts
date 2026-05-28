import { useState, useEffect } from 'react'
import type { ShowcaseItem } from './types'

const defaultShowcases: ShowcaseItem[] = [
  {
    id: 'code-review',
    title: '代码审查助手',
    description: '上传代码文件，获取详细的代码审查建议',
    imageUrl: '/showcase/code-review.jpg',
    prompt: '请审查以下代码，找出潜在问题和改进建议，并给出具体的重构方案。',
    category: '编程',
  },
  {
    id: 'writing-helper',
    title: '写作助手',
    description: '帮你润色文章、生成大纲、翻译内容',
    imageUrl: '/showcase/writing.jpg',
    prompt: '请帮我润色以下文章，使其表达更流畅、更有说服力。',
    category: '写作',
  },
  {
    id: 'data-analysis',
    title: '数据分析助手',
    description: '分析数据表格，生成可视化建议',
    imageUrl: '/showcase/data-analysis.jpg',
    prompt: '请分析以下数据，找出关键趋势和异常点，并给出可视化建议。',
    category: '数据分析',
  },
  {
    id: 'bug-bounty',
    title: '漏洞挖掘助手',
    description: '分析代码安全漏洞，提供修复方案',
    imageUrl: '/showcase/security.jpg',
    prompt: '请分析以下代码中的安全漏洞，按严重程度排序并给出修复建议。',
    category: '安全',
  },
  {
    id: 'sql-optimizer',
    title: 'SQL 优化助手',
    description: '分析慢查询，给出优化建议',
    imageUrl: '/showcase/sql.jpg',
    prompt: '请分析以下 SQL 查询的性能瓶颈，给出优化方案和索引建议。',
    category: '数据库',
  },
  {
    id: 'api-design',
    title: 'API 设计助手',
    description: '帮你设计 RESTful API 接口',
    imageUrl: '/showcase/api.jpg',
    prompt: '请帮我设计一套 RESTful API 接口，包括路径、方法、请求体和响应格式。',
    category: '编程',
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

    setLoading(true)
    fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data?.showcases)) {
          setItems(data.showcases)
          setError(null)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => setLoading(false))
  }, [])

  return { items, loading, error }
}
