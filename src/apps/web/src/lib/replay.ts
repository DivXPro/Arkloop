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
