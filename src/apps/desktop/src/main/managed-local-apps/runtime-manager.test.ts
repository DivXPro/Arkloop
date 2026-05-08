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
      command: 'node',
      args: [
        'apps/daemon/dist/cli.js',
        '--port',
        '17456',
        '--host',
        '127.0.0.1',
        '--no-open',
      ],
      cwd: '/Users/huhui/Projects/open-design',
      env: {
        OD_PORT: '17456',
        OD_DATA_DIR: '/tmp/arkloop-open-design/data',
      },
      preferredPort: 17456,
    },
    {
      id: 'web',
      command: 'pnpm',
      args: [
        '--filter',
        '@open-design/web',
        'dev',
        '--hostname',
        '127.0.0.1',
        '--port',
        '17573',
      ],
      cwd: '/Users/huhui/Projects/open-design',
      env: {
        OD_DAEMON_URL: 'http://127.0.0.1:17456',
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
    expect(openDesignSpec.processes[0]?.args).toContain('--no-open')
    expect(openDesignSpec.processes[0]?.env.OD_DATA_DIR).toBe('/tmp/arkloop-open-design/data')
    expect(openDesignSpec.processes[1]?.args).not.toContain('--')
    expect(openDesignSpec.processes[1]?.env.OD_DAEMON_URL).toBe('http://127.0.0.1:17456')
  })
})

describe('createManagedLocalAppRuntimeManager', () => {
  it('marks the app running after daemon and web become healthy', async () => {
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

    const status = await manager.ensureApp(openDesignSpec)

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

    await manager.ensureApp(openDesignSpec)

    const stopped = await manager.stopApp('open-design')

    expect(stopProcess).toHaveBeenCalledTimes(2)
    expect(stopProcess).toHaveBeenNthCalledWith(1, 202)
    expect(stopProcess).toHaveBeenNthCalledWith(2, 101)
    expect(stopped.status).toBe('stopped')
  })
})
