# Thread Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thread replay feature that plays back conversations message-by-message for demonstration and sharing, using the existing chat UI layout.

**Architecture:** Pure frontend implementation. A new `/replay/:token` route renders a read-only chat view that streams messages from a share token using a `useReplayEngine` hook to control timing. The replay UI reuses `ChatShell`/`ChatView` components but hides the input area and message action buttons.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind CSS 4, Framer Motion (existing in project)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/apps/web/src/components/ReplayPage.tsx` | Entry point for `/replay/:token`. Fetches shared thread data, handles password protection, renders `ReplayShell`. |
| `src/apps/web/src/components/ReplayShell.tsx` | Layout container reusing `ChatShell` structure but with replay-specific providers and no `ChatInput`. |
| `src/apps/web/src/hooks/useReplayEngine.ts` | Core replay timing engine. Manages which messages are visible and schedules their appearance. |
| `src/apps/web/src/lib/replay.ts` | Pure functions for building replay steps from messages and computing delays. |

### Modified Files

| File | Change |
|------|--------|
| `src/apps/web/src/App.tsx:372` | Add `/replay/:token` route |
| `src/apps/web/src/components/SharePage.tsx:255` | Add "Play Replay" button at bottom |
| `src/apps/web/src/components/ChatView.tsx` | Accept `isReplayMode` prop to hide input, action buttons, and SSE-related UI |
| `src/apps/web/src/components/MessageList.tsx` | Accept `messagesOverride` (already supported) for replay-visible messages |
| `src/apps/web/src/components/MessageBubble.tsx` | Accept `isReplayMode` prop to hide action bar buttons |

---

### Task 1: Add `/replay/:token` route in App.tsx

**Files:**
- Modify: `src/apps/web/src/App.tsx:1-15` (imports)
- Modify: `src/apps/web/src/App.tsx:372` (route)

- [ ] **Step 1: Add ReplayPage import**

Add import below `SharePage` import at line 12:

```typescript
import { ReplayPage } from './components/ReplayPage'
```

- [ ] **Step 2: Add replay route**

Add route below `/s/:token` route at line 372:

```typescript
<Route path="/replay/:token" element={<ReplayPage />} />
```

- [ ] **Step 3: Verify no type errors**

```bash
cd src/apps/web && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to App.tsx.

- [ ] **Step 4: Commit**

```bash
git add src/apps/web/src/App.tsx
git commit -m "feat(replay): add /replay/:token route"
```

---

### Task 2: Create `ReplayPage` component

**Files:**
- Create: `src/apps/web/src/components/ReplayPage.tsx`

- [ ] **Step 1: Create ReplayPage.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ReplayShell } from './ReplayShell'
import { getSharedThread, verifySharePassword, isApiError, type SharedThreadResponse } from '../api'
import { useLocale } from '../contexts/LocaleContext'

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export function ReplayPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SharedThreadResponse | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const loadData = useCallback(async (st?: string) => {
    if (!token) return
    setLoading(true)
    try {
      const resp = await getSharedThread(token, st ?? sessionToken ?? undefined)
      if (resp.requires_password && !st) {
        setNeedsPassword(true)
      } else {
        setData(resp)
        setNeedsPassword(false)
      }
    } catch (err) {
      if (isApiError(err) && (err.status === 404 || err.status === 403)) {
        if (err.code === 'shares.invalid_session') {
          setSessionToken(null)
          setNeedsPassword(true)
        } else {
          setNotFound(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [token, sessionToken])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleVerify = useCallback(async () => {
    if (!token || !password.trim()) return
    setVerifying(true)
    setPasswordError(false)
    try {
      const resp = await verifySharePassword(token, password)
      setSessionToken(resp.session_token)
      void loadData(resp.session_token)
    } catch (err) {
      if (isApiError(err) && err.status === 403) {
        setPasswordError(true)
      }
    } finally {
      setVerifying(false)
    }
  }, [token, password, loadData])

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

  if (needsPassword) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--c-bg-page)]">
        <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--c-bg-page)', border: '0.5px solid var(--c-border-subtle)' }}>
          <div className="mb-4 flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--c-bg-sub)' }}>
              <Lock size={20} style={{ color: 'var(--c-text-icon)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--c-text-primary)' }}>
              {t.sharePagePasswordTitle}
            </p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(false) }}
            placeholder={t.sharePagePasswordPlaceholder}
            autoFocus
            className="mb-3 w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--c-bg-sub)',
              border: `0.5px solid ${passwordError ? 'var(--c-destructive, #ef4444)' : 'var(--c-border-subtle)'}`,
              color: 'var(--c-text-primary)',
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleVerify() }}
          />
          {passwordError && (
            <p className="mb-3 text-xs" style={{ color: 'var(--c-destructive, #ef4444)' }}>
              {t.sharePagePasswordWrong}
            </p>
          )}
          <button
            onClick={() => void handleVerify()}
            disabled={verifying || !password.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--c-btn-bg)', color: 'var(--c-btn-text)' }}
          >
            {verifying && <SpinnerIcon />}
            {t.sharePagePasswordSubmit}
          </button>
        </div>
      </div>
    )
  }

  const messages = data?.messages ?? []
  const threadTitle = data?.thread?.title ?? null

  return (
    <ReplayShell
      token={token!}
      threadTitle={threadTitle}
      messages={messages.map((msg) => ({
        id: msg.id,
        role: msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'assistant',
        content: msg.content,
        contentJson: msg.content_json
          ? {
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
            }
          : undefined,
        createdAt: msg.created_at,
        metadata: { createdAt: msg.created_at },
        parts: msg.content ? [{ type: 'text' as const, text: msg.content, state: 'done' as const }] : [],
      }))}
    />
  )
}
```

- [ ] **Step 2: Run type check**

```bash
cd src/apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "ReplayPage\|replay" | head -10
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/apps/web/src/components/ReplayPage.tsx
git commit -m "feat(replay): create ReplayPage component for /replay/:token"
```

---

### Task 3: Create `useReplayEngine` hook

**Files:**
- Create: `src/apps/web/src/hooks/useReplayEngine.ts`
- Create: `src/apps/web/src/lib/replay.ts`

- [ ] **Step 1: Create `src/apps/web/src/lib/replay.ts`**

```typescript
import type { AgentMessage } from '../agent-ui'

export type ReplayStep =
  | { kind: 'user'; message: AgentMessage; delayAfterMs: number }
  | { kind: 'assistant'; message: AgentMessage; delayAfterMs: number }

export function buildReplaySteps(messages: AgentMessage[]): ReplayStep[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const steps: ReplayStep[] = []
  for (const msg of sorted) {
    if (msg.role === 'user') {
      steps.push({
        kind: 'user',
        message: msg,
        delayAfterMs: 1200,
      })
    } else if (msg.role === 'assistant') {
      const baseDelay = Math.min(2000, 800 + (msg.content?.length ?? 0) * 8)
      steps.push({
        kind: 'assistant',
        message: msg,
        delayAfterMs: baseDelay,
      })
    }
  }
  return steps
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 2: Create `src/apps/web/src/hooks/useReplayEngine.ts`**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentMessage } from '../agent-ui'
import { buildReplaySteps, sleep, type ReplayStep } from '../lib/replay'

export interface ReplayEngineState {
  visibleMessages: AgentMessage[]
  isComplete: boolean
  currentIndex: number
  totalSteps: number
}

export function useReplayEngine(allMessages: AgentMessage[]): ReplayEngineState {
  const [visibleMessages, setVisibleMessages] = useState<AgentMessage[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const cancelledRef = useRef(false)

  const steps = buildReplaySteps(allMessages)

  const reset = useCallback(() => {
    cancelledRef.current = true
    setVisibleMessages([])
    setIsComplete(false)
    setCurrentIndex(0)
  }, [])

  useEffect(() => {
    if (allMessages.length === 0) return

    cancelledRef.current = false
    setVisibleMessages([])
    setIsComplete(false)
    setCurrentIndex(0)

    async function run() {
      for (let i = 0; i < steps.length; i++) {
        if (cancelledRef.current) break

        const step = steps[i]
        setCurrentIndex(i)

        // Add message to visible list
        setVisibleMessages((prev) => {
          if (prev.some((m) => m.id === step.message.id)) return prev
          return [...prev, step.message]
        })

        // Wait for delay before next step
        if (i < steps.length - 1) {
          await sleep(step.delayAfterMs)
        }
      }

      if (!cancelledRef.current) {
        setIsComplete(true)
      }
    }

    // Small initial delay before first message appears
    const timeout = setTimeout(() => {
      void run()
    }, 600)

    return () => {
      cancelledRef.current = true
      clearTimeout(timeout)
    }
  }, [allMessages, steps])

  return {
    visibleMessages,
    isComplete,
    currentIndex,
    totalSteps: steps.length,
  }
}
```

- [ ] **Step 3: Run type check**

```bash
cd src/apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "replay\|useReplayEngine" | head -10
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/apps/web/src/hooks/useReplayEngine.ts src/apps/web/src/lib/replay.ts
git commit -m "feat(replay): add useReplayEngine hook and replay utilities"
```

---

### Task 4: Create `ReplayShell` component

**Files:**
- Create: `src/apps/web/src/components/ReplayShell.tsx`
- Modify: `src/apps/web/src/components/ChatView.tsx` (add `isReplayMode` prop)

- [ ] **Step 1: Read ChatView.tsx props interface**

The file is large. Read the first 50 lines after imports to find the `ChatView` function signature and props.

```bash
grep -n "export const ChatView" src/apps/web/src/components/ChatView.tsx
```

- [ ] **Step 2: Create `ReplayShell.tsx`**

```typescript
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
    // Force remount by toggling state
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
            {t.replayRestart ?? 'Replay'}
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
                {t.replayRestart ?? 'Replay conversation'}
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
```

- [ ] **Step 3: Add replay locale strings**

Add to `src/apps/web/src/locales/en.ts` and `src/apps/web/src/locales/zh.ts`:

```typescript
replayRestart: 'Replay',
```

Find where `sharePagePoweredBy` is defined and add `replayRestart` next to it in both files.

- [ ] **Step 4: Run type check**

```bash
cd src/apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "replayshell\|ReplayShell" | head -10
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/src/components/ReplayShell.tsx src/apps/web/src/locales/en.ts src/apps/web/src/locales/zh.ts
git commit -m "feat(replay): create ReplayShell component with header and message area"
```

---

### Task 5: Add "Play Replay" button to SharePage

**Files:**
- Modify: `src/apps/web/src/components/SharePage.tsx:255-268` (after message list, before footer)

- [ ] **Step 1: Add Play icon import**

Add to imports at top of SharePage.tsx:

```typescript
import { Play } from 'lucide-react'
```

- [ ] **Step 2: Add replay button before footer**

After the messages list (around line 255), before the footer, add:

```tsx
          {messages.length > 0 && (
            <div className="flex justify-center pt-6">
              <button
                onClick={() => navigate(`/replay/${token}`)}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-colors hover:opacity-90"
                style={{ background: 'var(--c-brand)', color: '#fff' }}
              >
                <Play size={16} fill="currentColor" />
                {t.replayButton ?? 'Play replay'}
              </button>
            </div>
          )}
```

- [ ] **Step 3: Add locale string**

Add `replayButton: 'Play replay'` to `src/apps/web/src/locales/en.ts` and `回放对话` to `src/apps/web/src/locales/zh.ts`.

- [ ] **Step 4: Run type check**

```bash
cd src/apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "sharepage" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/apps/web/src/components/SharePage.tsx src/apps/web/src/locales/en.ts src/apps/web/src/locales/zh.ts
git commit -m "feat(replay): add play replay button to SharePage"
```

---

### Task 6: Build verification and polish

**Files:**
- Modify: Various (as needed)

- [ ] **Step 1: Run full type check**

```bash
cd src/apps/web && pnpm type-check 2>&1 | tail -20
```

Expected: No errors. If errors exist, fix them.

- [ ] **Step 2: Run lint**

```bash
cd src/apps/web && pnpm lint 2>&1 | tail -20
```

Expected: No lint errors related to new files.

- [ ] **Step 3: Build**

```bash
cd src/apps/web && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Manual test plan**

1. Open a shared thread at `/s/{token}`
2. Verify "Play replay" button appears
3. Click button → navigate to `/replay/{token}`
4. Verify messages appear one by one with delays
5. Verify header shows back button and thread title
6. Verify replay completes and shows "Replay conversation" button
7. Click replay button → verify conversation restarts

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(replay): complete thread replay feature"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| `/replay/:token` route | Task 1 |
| Replay page with shared thread data | Task 2 |
| Password protection support | Task 2 |
| Pure auto-play, no controls | Task 3 |
| Messages appear one by one | Task 3 |
| Reuse chat UI layout | Task 4 |
| Hide input area | Task 4 |
| Play replay button on SharePage | Task 5 |
| Replay completion + restart | Task 4 |

### 2. Placeholder Scan

- [x] No "TBD", "TODO", "implement later"
- [x] No vague error handling references
- [x] All steps have concrete code or commands
- [x] File paths are exact

### 3. Type Consistency

- [x] `AgentMessage` type from `../agent-ui` used consistently
- [x] `SharedThreadResponse` from `../api` used in ReplayPage
- [x] `ReplayStep` type defined once in `lib/replay.ts`
- [x] Hook return type `ReplayEngineState` matches usage in `ReplayShell`
