import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ReplayShell } from './ReplayShell'
import { getSharedThread, isApiError, type SharedThreadResponse } from '../api'
import { useLocale } from '../contexts/LocaleContext'

export function ReplayPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useLocale()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SharedThreadResponse | null>(null)
  const [notFound, setNotFound] = useState(false)

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const resp = await getSharedThread(token)
      setData(resp)
    } catch (err) {
      if (isApiError(err) && (err.status === 404 || err.status === 403)) {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [token])

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
    contentJson: msg.content_json ? {
      parts: msg.content_json.parts.map((part) => {
        if (part.type === 'text') return part
        if (part.type === 'image') {
          return {
            type: 'image' as const,
            attachment: {
              key: part.attachment.key,
              filename: part.attachment.filename,
              mediaType: part.attachment.mime_type,
              size: part.attachment.size,
            },
          }
        }
        return {
          type: 'file' as const,
          attachment: {
            key: part.attachment.key,
            filename: part.attachment.filename,
            mediaType: part.attachment.mime_type,
            size: part.attachment.size,
          },
          extractedText: part.extracted_text,
        }
      }),
    } : undefined,
    createdAt: msg.created_at,
    metadata: { createdAt: msg.created_at },
    parts: msg.content ? [{ type: 'text' as const, text: msg.content, state: 'done' as const }] : [],
  }))

  return (
    <ReplayShell
      token={token!}
      threadTitle={data?.thread?.title ?? null}
      messages={agentMessages}
    />
  )
}
