import { describe, expect, it, vi } from 'vitest'

import { createManagedAppRuntimeManager } from './runtime-manager'

describe('createManagedAppRuntimeManager', () => {
  it('starts open-design, waits for ready file, and reports running state', async () => {
    const launch = vi.fn(async () => ({ pid: 321 }))
    const pollReady = vi.fn(async () => ({
      webUrl: 'http://127.0.0.1:54321/',
    }))
    const manager = createManagedAppRuntimeManager({
      launch,
      pollReady,
      stop: vi.fn(),
    })

    const state = await manager.ensureStarted('open-design')

    expect(launch).toHaveBeenCalledTimes(1)
    expect(pollReady).toHaveBeenCalledTimes(1)
    expect(state.status).toBe('running')
    expect(state.webUrl).toBe('http://127.0.0.1:54321/')
    expect(state.pid).toBe(321)
  })

  it('records failed state when ready polling throws', async () => {
    const manager = createManagedAppRuntimeManager({
      launch: async () => ({ pid: 321 }),
      pollReady: async () => {
        throw new Error('ready file timeout')
      },
      stop: vi.fn(),
    })

    await expect(manager.ensureStarted('open-design')).rejects.toThrow(
      'ready file timeout',
    )
    expect(manager.getState('open-design').status).toBe('failed')
    expect(manager.getState('open-design').lastError).toBe(
      'ready file timeout',
    )
  })
})
