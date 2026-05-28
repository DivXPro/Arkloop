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

        setVisibleMessages((prev) => {
          if (prev.some((m) => m.id === step.message.id)) return prev
          return [...prev, step.message]
        })

        if (i < steps.length - 1) {
          await sleep(step.delayAfterMs)
        }
      }

      if (!cancelledRef.current) {
        setIsComplete(true)
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

  return {
    visibleMessages,
    isComplete,
    currentIndex,
    totalSteps: steps.length,
  }
}