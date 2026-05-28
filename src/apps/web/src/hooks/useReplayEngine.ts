import { useState, useEffect, useRef } from 'react'
import type { AgentMessage } from '../agent-ui'
import { buildReplaySteps, sleep } from '../lib/replay'

export interface ReplayEngineState {
  visibleMessages: AgentMessage[]
  isComplete: boolean
  currentIndex: number
  totalSteps: number
}

export function useReplayEngine(allMessages: AgentMessage[]): ReplayEngineState {
  const [state, setState] = useState<ReplayEngineState>({
    visibleMessages: [],
    isComplete: false,
    currentIndex: 0,
    totalSteps: 0,
  })
  const cancelledRef = useRef(false)

  const steps = buildReplaySteps(allMessages)

  useEffect(() => {
    if (allMessages.length === 0) return

    cancelledRef.current = false
    setState({
      visibleMessages: [],
      isComplete: false,
      currentIndex: 0,
      totalSteps: steps.length,
    })

    async function run() {
      const visible: AgentMessage[] = []
      for (let i = 0; i < steps.length; i++) {
        if (cancelledRef.current) break

        const step = steps[i]
        visible.push(step.message)
        setState((prev) => ({
          ...prev,
          currentIndex: i,
          visibleMessages: visible,
        }))

        if (i < steps.length - 1) {
          await sleep(step.delayAfterMs)
        }
      }

      if (!cancelledRef.current) {
        setState((prev) => ({
          ...prev,
          isComplete: true,
        }))
      }
    }

    const timeout = setTimeout(() => {
      void run()
    }, 600)

    return () => {
      cancelledRef.current = true
      clearTimeout(timeout)
    }
  }, [allMessages, steps])

  return state
}
