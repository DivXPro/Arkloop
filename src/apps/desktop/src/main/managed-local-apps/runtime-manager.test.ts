import { describe, expect, it } from 'vitest'

import { buildOpenDesignSpec } from './apps/open-design'
import { createManagedLocalAppRuntimeManager } from './runtime-manager'

describe('buildOpenDesignSpec', () => {
  it('builds daemon and web launch specs from config and runtime roots', () => {
    const spec = buildOpenDesignSpec({
      projectPath: '/Users/huhui/Projects/open-design',
      runtimeRoot: '/tmp/arkloop-open-design',
      preferredDaemonPort: 17456,
      preferredWebPort: 17573,
    })

    expect(spec.id).toBe('open-design')
    expect(spec.presentation).toBe('page')
    expect(spec.mountTarget).toBe('main-workspace')
    expect(spec.processes.map((process) => process.id)).toEqual(['daemon', 'web'])
    expect(spec.processes[0]?.args).toContain('--no-open')
    expect(spec.processes[0]?.env.OD_DATA_DIR).toBe('/tmp/arkloop-open-design/data')
    expect(spec.processes[1]?.env.OD_DAEMON_URL).toBe('http://127.0.0.1:17456')
  })
})

describe('createManagedLocalAppRuntimeManager', () => {
  it('marks the app running after daemon and web become healthy', async () => {
    const manager = createManagedLocalAppRuntimeManager({
      launchProcess: async (process) => ({
        pid: process.id === 'daemon' ? 101 : 202,
      }),
      waitForHealth: async (process) =>
        process.id === 'daemon'
          ? { ok: true, url: 'http://127.0.0.1:17456' }
          : { ok: true, url: 'http://127.0.0.1:17573' },
      stopProcess: async () => {},
    })

    const status = await manager.ensureApp(
      buildOpenDesignSpec({
        projectPath: '/Users/huhui/Projects/open-design',
        runtimeRoot: '/tmp/arkloop-open-design',
        preferredDaemonPort: 17456,
        preferredWebPort: 17573,
      }),
    )

    expect(status.status).toBe('running')
    expect(status.daemonUrl).toBe('http://127.0.0.1:17456')
    expect(status.webUrl).toBe('http://127.0.0.1:17573')
    expect(status.pids).toEqual({ daemon: 101, web: 202 })
  })
})
