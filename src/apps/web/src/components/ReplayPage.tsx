import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ReplayShell } from './ReplayShell'
import { getReplay, isApiError, type GetReplayResponse } from '../api'
import { useLocale } from '../contexts/LocaleContext'

export function ReplayPage() {
  const { replayId } = useParams<{ replayId: string }>()
  const { t } = useLocale()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<GetReplayResponse | null>(null)
  const [notFound, setNotFound] = useState(false)

  const loadData = useCallback(async () => {
    if (!replayId) return
    setLoading(true)
    try {
      const resp = await getReplay(replayId)
      setData(resp)
    } catch (err) {
      if (isApiError(err) && (err.status === 404 || err.status === 403)) {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [replayId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--c-bg-page)]">
        <div className="text-sm" style={{ color: 'var(--c-text-muted)' }}>{t.loading}</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--c-bg-page)]">
        <div className="text-center">
          <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>{t.sharePageNotFound}</p>
        </div>
      </div>
    )
  }

  const messages = data?.messages ?? []

  const agentMessages = messages.map((msg) => ({
    id: msg.id,
    role: (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'assistant') as 'user' | 'assistant',
    content: msg.content,
    createdAt: msg.created_at,
    metadata: { createdAt: msg.created_at },
    parts: msg.content ? [{ type: 'text' as const, text: msg.content, state: 'done' as const }] : [],
  }))

  return (
    <ReplayShell
      threadTitle={data?.title ?? null}
      messages={agentMessages}
    />
  )
}
