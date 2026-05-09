import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OpenDesignPluginPage } from '../plugins/builtin/OpenDesignPluginPage'

const desktopMock = vi.hoisted(() => {
  const managedAppsApi = {
    ensureStarted: vi.fn(async () => ({
      appId: 'open-design' as const,
      status: 'running' as const,
      pid: 321,
      webUrl: 'http://127.0.0.1:54321/',
      lastError: null,
      startedAt: '2026-05-09T00:00:00.000Z',
    })),
    showMainArea: vi.fn(async () => ({ ok: true })),
    hideMainArea: vi.fn(async () => ({ ok: true })),
    getStatus: vi.fn(),
    restart: vi.fn(),
    syncMainAreaBounds: vi.fn(),
  }
  return {
    isDesktop: vi.fn(() => true),
    getDesktopApi: vi.fn(() => ({
      managedApps: managedAppsApi,
    })),
    managedAppsApi,
  }
})

vi.mock('@arkloop/shared/desktop', () => ({
  isDesktop: desktopMock.isDesktop,
  getDesktopApi: desktopMock.getDesktopApi,
}))

describe('OpenDesignPluginPage', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.clearAllMocks()
    if (originalActEnvironment === undefined) {
      delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    } else {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    }
  })

  it('shows loading first and then ready state after ensureStarted resolves', async () => {
    type EnsureStartedResult = {
      appId: 'open-design'
      status: 'running'
      pid: number
      webUrl: string
      lastError: string | null
      startedAt: string
    }

    let resolveEnsureStarted: ((value: EnsureStartedResult) => void) | null = null
    desktopMock.managedAppsApi.ensureStarted.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEnsureStarted = resolve as (value: EnsureStartedResult) => void
        }),
    )

    await act(async () => {
      root.render(<OpenDesignPluginPage />)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="open-design-plugin-loading"]')).not.toBeNull()

    await act(async () => {
      resolveEnsureStarted?.({
        appId: 'open-design',
        status: 'running',
        pid: 321,
        webUrl: 'http://127.0.0.1:54321/',
        lastError: null,
        startedAt: '2026-05-09T00:00:00.000Z',
      })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="open-design-plugin-ready"]')).not.toBeNull()
    expect(desktopMock.managedAppsApi.ensureStarted).toHaveBeenCalledWith('open-design')
    expect(desktopMock.managedAppsApi.showMainArea).toHaveBeenCalledWith(
      'open-design',
      'http://127.0.0.1:54321/',
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number), height: expect.any(Number) }),
    )
  })

  it('hides main area on unmount', async () => {
    await act(async () => {
      root.render(<OpenDesignPluginPage />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      root.unmount()
    })

    expect(desktopMock.managedAppsApi.hideMainArea).toHaveBeenCalledWith('open-design')
  })

  it('shows error state when ensureStarted fails and allows retry', async () => {
    desktopMock.managedAppsApi.ensureStarted.mockRejectedValueOnce(
      new Error('install incomplete'),
    )

    await act(async () => {
      root.render(<OpenDesignPluginPage />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="open-design-plugin-error"]')).not.toBeNull()
    expect(container.textContent).toContain('install incomplete')

    // Retry should call ensureStarted again
    const retryButton = container.querySelector('button')
    expect(retryButton).not.toBeNull()

    desktopMock.managedAppsApi.ensureStarted.mockResolvedValueOnce({
      appId: 'open-design',
      status: 'running',
      pid: 321,
      webUrl: 'http://127.0.0.1:54321/',
      lastError: null,
      startedAt: '2026-05-09T00:00:00.000Z',
    })

    await act(async () => {
      retryButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(desktopMock.managedAppsApi.ensureStarted).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-testid="open-design-plugin-ready"]')).not.toBeNull()
  })
})
