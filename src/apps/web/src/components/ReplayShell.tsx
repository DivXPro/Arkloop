import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import type { AgentMessage } from '../agent-ui'
import { useReplayEngine } from '../hooks/useReplayEngine'
import { MessageList } from './MessageList'
import { ChatSkeleton } from './ChatSkeleton'
import { useLocale } from '../contexts/LocaleContext'

interface ReplayShellProps {
  token: string
  threadTitle: string | null
  messages: AgentMessage[]
}

export function ReplayShell({ token, threadTitle, messages }: ReplayShellProps) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { visibleMessages, isComplete } = useReplayEngine(messages)
  const [isRestarting, setIsRestarting] = useState(false)

  const handleRestart = useCallback(() => {
    setIsRestarting(true)
    setTimeout(() => setIsRestarting(false), 50)
  }, [])

  const handleBack = useCallback(() => {
    navigate(`/s/${token}`)
  }, [navigate, token])

  if (messages.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-[var(--c-bg-page)]">
        <div className="flex items-center px-5 py-3" style={{ borderBottom: '0.5px solid var(--c-border-subtle)' }}>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--c-text-secondary)' }}
          >
            <ArrowLeft size={16} />
            {t.sharePageLogin}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm" style={{ color: 'var(--c-text-muted)' }}>{t.sharePageNotFound}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--c-bg-page)]">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '0.5px solid var(--c-border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--c-text-secondary)' }}
          >
            <ArrowLeft size={16} />
            <span>{t.sharePageLogin}</span>
          </button>
          {threadTitle && (
            <>
              <span style={{ color: 'var(--c-border)' }}>|</span>
              <span className="text-sm font-medium truncate max-w-[400px]" style={{ color: 'var(--c-text-primary)' }}>
                {threadTitle}
              </span>
            </>
          )}
        </div>
        {isComplete && (
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-[var(--c-bg-sub)]"
            style={{ color: 'var(--c-text-secondary)' }}
          >
            <RotateCcw size={14} />
            {t.replayRestart}
          </button>
        )}
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        <div
          style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 80px' }}
          className="flex w-full flex-col gap-6"
        >
          {isRestarting ? (
            <ChatSkeleton />
          ) : (
            <MessageList
              lastTurnRef={{ current: null }}
              lastUserPromptRef={{ current: null }}
              lastTurnStartIdx={visibleMessages.length}
              messagesOverride={visibleMessages}
              handleRetryUserMessage={() => {}}
              handleEditMessage={() => {}}
              handleFork={() => Promise.resolve()}
              handleArtifactAction={() => {}}
              openDocumentPanel={() => {}}
              openResourcePanel={() => {}}
              openCodePanel={() => {}}
              openAgentPanel={() => {}}
              showRunDetailButton={false}
              sourcePanelMessageId={null}
              setRunDetailPanelRunId={() => {}}
              currentRunCopHeaderOverride={() => undefined}
              clearUserEnterAnimation={() => {}}
            />
          )}

          {isComplete && (
            <div className="flex justify-center pt-8">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-colors hover:opacity-90"
                style={{ background: 'var(--c-bg-sub)', color: 'var(--c-text-secondary)', border: '0.5px solid var(--c-border-subtle)' }}
              >
                <RotateCcw size={16} />
                {t.replayRestart}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-center py-3"
        style={{ borderTop: '0.5px solid var(--c-border-subtle)' }}
      >
        <span className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
          {t.sharePagePoweredBy}
        </span>
      </div>
    </div>
  )
}
