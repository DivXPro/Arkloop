import type { ChildProcess } from 'node:child_process'

import type { ManagedAppId, ManagedAppState } from './types'

type LaunchResult = {
  pid: number
  child?: ChildProcess
}

type ReadyResult = {
  webUrl: string
}

function createStoppedState(appId: ManagedAppId): ManagedAppState {
  return {
    appId,
    status: 'stopped',
    pid: null,
    webUrl: null,
    lastError: null,
    startedAt: null,
  }
}

export function createManagedAppRuntimeManager(deps: {
  launch: (appId: ManagedAppId) => Promise<LaunchResult>
  pollReady: (appId: ManagedAppId) => Promise<ReadyResult>
  stop: (pid: number) => Promise<void>
}) {
  const records = new Map<ManagedAppId, ManagedAppState>()

  async function ensureStarted(appId: ManagedAppId): Promise<ManagedAppState> {
    const existing = records.get(appId)
    if (existing?.status === 'running') {
      return existing
    }

    const launched = await deps.launch(appId)

    try {
      const ready = await deps.pollReady(appId)
      const runningState: ManagedAppState = {
        appId,
        status: 'running',
        pid: launched.pid,
        webUrl: ready.webUrl,
        lastError: null,
        startedAt: new Date().toISOString(),
      }
      records.set(appId, runningState)
      return runningState
    } catch (error) {
      const failedState: ManagedAppState = {
        appId,
        status: 'failed',
        pid: launched.pid,
        webUrl: null,
        lastError: error instanceof Error ? error.message : String(error),
        startedAt: new Date().toISOString(),
      }
      records.set(appId, failedState)
      throw error
    }
  }

  function getState(appId: ManagedAppId): ManagedAppState {
    return records.get(appId) ?? createStoppedState(appId)
  }

  async function stopApp(appId: ManagedAppId): Promise<ManagedAppState> {
    const current = records.get(appId)
    if (current?.pid) {
      await deps.stop(current.pid)
    }
    const stoppedState = createStoppedState(appId)
    records.set(appId, stoppedState)
    return stoppedState
  }

  return {
    ensureStarted,
    getState,
    stopApp,
  }
}
