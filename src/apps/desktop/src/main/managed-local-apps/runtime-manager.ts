import type { ChildProcess } from 'node:child_process'

import type {
  ManagedLocalAppId,
  ManagedLocalAppProcessSpec,
  ManagedLocalAppSpec,
  ManagedLocalAppStatus,
} from './types'

export type ManagedLocalAppRuntimeState = {
  appId: ManagedLocalAppId
  status: ManagedLocalAppStatus
  daemonUrl: string | null
  webUrl: string | null
  pids: { daemon?: number; web?: number }
  lastError: string | null
}

type ManagedLocalAppRecord = {
  spec: ManagedLocalAppSpec
  state: ManagedLocalAppRuntimeState
  children: Partial<Record<ManagedLocalAppProcessSpec['id'], ChildProcess>>
}

export type ManagedLocalAppRuntimeEvent =
  | { appId: ManagedLocalAppId; stage: 'ensure-started' }
  | { appId: ManagedLocalAppId; processId: ManagedLocalAppProcessSpec['id']; stage: 'launch-started' }
  | {
    appId: ManagedLocalAppId
    processId: ManagedLocalAppProcessSpec['id']
    stage: 'launch-completed'
    pid: number
  }
  | {
    appId: ManagedLocalAppId
    processId: ManagedLocalAppProcessSpec['id']
    stage: 'health-ok'
    url: string
  }
  | {
    appId: ManagedLocalAppId
    processId: ManagedLocalAppProcessSpec['id']
    stage: 'health-failed'
    error: string
  }
  | {
    appId: ManagedLocalAppId
    stage: 'ensure-running'
    daemonUrl: string
    webUrl: string
  }

export function createManagedLocalAppRuntimeManager(deps: {
  launchProcess: (process: ManagedLocalAppProcessSpec) => Promise<{ pid: number; child?: ChildProcess }>
  waitForHealth: (
    process: ManagedLocalAppProcessSpec,
  ) => Promise<{ ok: boolean; url?: string; error?: string }>
  stopProcess: (pid: number) => Promise<void>
  onEvent?: (event: ManagedLocalAppRuntimeEvent) => void
}) {
  const records = new Map<ManagedLocalAppId, ManagedLocalAppRecord>()

  function stoppedState(appId: ManagedLocalAppId): ManagedLocalAppRuntimeState {
    return {
      appId,
      status: 'stopped',
      daemonUrl: null,
      webUrl: null,
      pids: {},
      lastError: null,
    }
  }

  async function ensureApp(spec: ManagedLocalAppSpec): Promise<ManagedLocalAppRuntimeState> {
    const existing = records.get(spec.id)
    if (existing?.state.status === 'running') {
      return existing.state
    }

    const daemon = spec.processes.find((process) => process.id === 'daemon')
    const web = spec.processes.find((process) => process.id === 'web')
    if (!daemon || !web) {
      throw new Error(`managed app ${spec.id} requires daemon and web processes`)
    }

    const record: ManagedLocalAppRecord = {
      spec,
      state: {
        appId: spec.id,
        status: 'starting',
        daemonUrl: null,
        webUrl: null,
        pids: {},
        lastError: null,
      },
      children: {},
    }
    records.set(spec.id, record)
    deps.onEvent?.({ appId: spec.id, stage: 'ensure-started' })

    deps.onEvent?.({ appId: spec.id, processId: daemon.id, stage: 'launch-started' })
    const daemonLaunch = await deps.launchProcess(daemon)
    record.state.pids.daemon = daemonLaunch.pid
    deps.onEvent?.({
      appId: spec.id,
      processId: daemon.id,
      stage: 'launch-completed',
      pid: daemonLaunch.pid,
    })
    if (daemonLaunch.child) {
      record.children.daemon = daemonLaunch.child
    }

    const daemonHealth = await deps.waitForHealth(daemon)
    if (!daemonHealth.ok || !daemonHealth.url) {
      deps.onEvent?.({
        appId: spec.id,
        processId: daemon.id,
        stage: 'health-failed',
        error: daemonHealth.error ?? 'daemon health check failed',
      })
      record.state = {
        ...record.state,
        status: 'failed',
        daemonUrl: null,
        webUrl: null,
        lastError: daemonHealth.error ?? 'daemon health check failed',
      }
      return record.state
    }
    record.state.daemonUrl = daemonHealth.url
    deps.onEvent?.({
      appId: spec.id,
      processId: daemon.id,
      stage: 'health-ok',
      url: daemonHealth.url,
    })

    deps.onEvent?.({ appId: spec.id, processId: web.id, stage: 'launch-started' })
    const webLaunch = await deps.launchProcess(web)
    record.state.pids.web = webLaunch.pid
    deps.onEvent?.({
      appId: spec.id,
      processId: web.id,
      stage: 'launch-completed',
      pid: webLaunch.pid,
    })
    if (webLaunch.child) {
      record.children.web = webLaunch.child
    }

    const webHealth = await deps.waitForHealth(web)
    if (!webHealth.ok || !webHealth.url) {
      deps.onEvent?.({
        appId: spec.id,
        processId: web.id,
        stage: 'health-failed',
        error: webHealth.error ?? 'web health check failed',
      })
      record.state = {
        ...record.state,
        status: 'failed',
        webUrl: null,
        lastError: webHealth.error ?? 'web health check failed',
      }
      return record.state
    }
    deps.onEvent?.({
      appId: spec.id,
      processId: web.id,
      stage: 'health-ok',
      url: webHealth.url,
    })

    record.state = {
      ...record.state,
      status: 'running',
      webUrl: webHealth.url,
      lastError: null,
    }
    deps.onEvent?.({
      appId: spec.id,
      stage: 'ensure-running',
      daemonUrl: record.state.daemonUrl ?? '',
      webUrl: webHealth.url,
    })
    return record.state
  }

  function getStatus(appId: ManagedLocalAppId): ManagedLocalAppRuntimeState {
    return records.get(appId)?.state ?? stoppedState(appId)
  }

  async function stopApp(appId: ManagedLocalAppId): Promise<ManagedLocalAppRuntimeState> {
    const record = records.get(appId)
    if (!record) return stoppedState(appId)

    const pids = [record.state.pids.web, record.state.pids.daemon].filter(
      (pid): pid is number => typeof pid === 'number' && pid > 0,
    )
    for (const pid of pids) {
      await deps.stopProcess(pid)
    }
    records.delete(appId)
    return stoppedState(appId)
  }

  async function restartApp(appId: ManagedLocalAppId): Promise<ManagedLocalAppRuntimeState> {
    const record = records.get(appId)
    if (!record) return stoppedState(appId)
    await stopApp(appId)
    return ensureApp(record.spec)
  }

  async function stopAll(): Promise<void> {
    const appIds = Array.from(records.keys())
    for (const appId of appIds) {
      await stopApp(appId)
    }
  }

  return {
    ensureApp,
    getStatus,
    restartApp,
    stopApp,
    stopAll,
  }
}
