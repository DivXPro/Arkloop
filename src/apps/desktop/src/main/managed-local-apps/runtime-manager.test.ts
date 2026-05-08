import { describe, expect, it, vi } from 'vitest'

import { createManagedLocalAppRuntimeManager } from './runtime-manager'
import type { ManagedLocalAppSpec } from './types'

const openDesignSpec: ManagedLocalAppSpec = {
  id: 'open-design',
  title: 'Open Design',
  presentation: 'page',
  mountTarget: 'main-workspace',
  runtimeRoot: '/tmp/arkloop-open-design',
  processes: [
    {
      id: 'daemon',
      command: 'pnpm',
      args: [
        'tools-dev',
        'run',
        'web',
        '--daemon-port',
        '17456',
        '--web-port',
        '17573',
      ],
      cwd: '/Users/huhui/Projects/open-design',
      env: {
        OD_PORT: '17456',
        OD_DATA_DIR: '/tmp/arkloop-open-design/data',
      },
      preferredPort: 17456,
      launchMode: 'health-only',
    },
    {
      id: 'web',
      command: 'pnpm',
      args: [
        'tools-dev',
        'run',
        'web',
        '--daemon-port',
        '17456',
        '--web-port',
        '17573',
      ],
      cwd: '/Users/huhui/Projects/open-design',
      env: {
        OD_PORT: '17456',
        PORT: '17573',
      },
      preferredPort: 17573,
    },
  ],
}

describe('openDesignSpec fixture', () => {
  it('represents a launcher-resolved daemon and web runtime', () => {
    expect(openDesignSpec.id).toBe('open-design')
    expect(openDesignSpec.presentation).toBe('page')
    expect(openDesignSpec.mountTarget).toBe('main-workspace')
    expect(openDesignSpec.processes.map((process) => process.id)).toEqual(['daemon', 'web'])
    expect(openDesignSpec.processes[0]?.launchMode).toBe('health-only')
    expect(openDesignSpec.processes[0]?.args).toContain('tools-dev')
    expect(openDesignSpec.processes[0]?.env.OD_DATA_DIR).toBe('/tmp/arkloop-open-design/data')
    expect(openDesignSpec.processes[1]?.args).toContain('--web-port')
    expect(openDesignSpec.processes[1]?.env.OD_PORT).toBe('17456')
  })
})

describe('createManagedLocalAppRuntimeManager', () => {
  it('marks the app running after daemon and web become healthy', async () => {
    const fullSpawnSpec: ManagedLocalAppSpec = {
      ...openDesignSpec,
      processes: openDesignSpec.processes.map((process) => ({
        ...process,
        launchMode: 'spawn',
      })),
    }
    const onEvent = vi.fn()
    const manager = createManagedLocalAppRuntimeManager({
      launchProcess: async (process) => ({
        pid: process.id === 'daemon' ? 101 : 202,
      }),
      waitForHealth: async (process) =>
        process.id === 'daemon'
          ? { ok: true, url: 'http://127.0.0.1:17456' }
          : { ok: true, url: 'http://127.0.0.1:17573' },
      stopProcess: async () => {},
      onEvent,
    })

    const status = await manager.ensureApp(fullSpawnSpec)

    expect(status.status).toBe('running')
    expect(status.daemonUrl).toBe('http://127.0.0.1:17456')
    expect(status.webUrl).toBe('http://127.0.0.1:17573')
    expect(status.pids).toEqual({ daemon: 101, web: 202 })
    expect(onEvent.mock.calls).toEqual([
      [{ appId: 'open-design', stage: 'ensure-started' }],
      [{ appId: 'open-design', processId: 'daemon', stage: 'launch-started' }],
      [{ appId: 'open-design', processId: 'daemon', stage: 'launch-completed', pid: 101 }],
      [{
        appId: 'open-design',
        processId: 'daemon',
        stage: 'health-ok',
        url: 'http://127.0.0.1:17456',
      }],
      [{ appId: 'open-design', processId: 'web', stage: 'launch-started' }],
      [{ appId: 'open-design', processId: 'web', stage: 'launch-completed', pid: 202 }],
      [{
        appId: 'open-design',
        processId: 'web',
        stage: 'health-ok',
        url: 'http://127.0.0.1:17573',
      }],
      [{
        appId: 'open-design',
        stage: 'ensure-running',
        daemonUrl: 'http://127.0.0.1:17456',
        webUrl: 'http://127.0.0.1:17573',
      }],
    ])
  })

  it('stops both processes when the managed app is stopped', async () => {
    const fullSpawnSpec: ManagedLocalAppSpec = {
      ...openDesignSpec,
      processes: openDesignSpec.processes.map((process) => ({
        ...process,
        launchMode: 'spawn',
      })),
    }
    const stopProcess = vi.fn(async () => {})
    const manager = createManagedLocalAppRuntimeManager({
      launchProcess: async (process) => ({
        pid: process.id === 'daemon' ? 101 : 202,
      }),
      waitForHealth: async (process) =>
        process.id === 'daemon'
          ? { ok: true, url: 'http://127.0.0.1:17456' }
          : { ok: true, url: 'http://127.0.0.1:17573' },
      stopProcess,
    })

    await manager.ensureApp(fullSpawnSpec)

    const stopped = await manager.stopApp('open-design')

    expect(stopProcess).toHaveBeenCalledTimes(2)
    expect(stopProcess).toHaveBeenNthCalledWith(1, 202)
    expect(stopProcess).toHaveBeenNthCalledWith(2, 101)
    expect(stopped.status).toBe('stopped')
  })

  it('keeps daemon as a health-only slot when web is the only spawned process', async () => {
    let webSpawned = false
    const launchProcess = vi.fn(async (process: ManagedLocalAppSpec['processes'][number]) => {
      if (process.id === 'web') {
        webSpawned = true
      }
      return { pid: process.id === 'web' ? 202 : 101 }
    })
    const manager = createManagedLocalAppRuntimeManager({
      launchProcess,
      waitForHealth: async (process) =>
        process.id === 'daemon'
          ? (
              webSpawned
                ? { ok: true, url: 'http://127.0.0.1:17456' }
                : { ok: false, error: 'daemon should appear after web starts' }
            )
          : { ok: true, url: 'http://127.0.0.1:17573' },
      stopProcess: async () => {},
    })

    const status = await manager.ensureApp(openDesignSpec)

    expect(launchProcess).toHaveBeenCalledTimes(1)
    expect(launchProcess).toHaveBeenCalledWith(openDesignSpec.processes[1])
    expect(webSpawned).toBe(true)
    expect(status.status).toBe('running')
    expect(status.daemonUrl).toBe('http://127.0.0.1:17456')
    expect(status.webUrl).toBe('http://127.0.0.1:17573')
    expect(status.pids).toEqual({ web: 202 })
  })
})
