import { act, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@arkloop/shared'

import { AppLayout } from '../layouts/AppLayout'
import { LocaleProvider } from '../contexts/LocaleContext'
import { AuthProvider } from '../contexts/auth'
import { ThreadListProvider } from '../contexts/thread-list'
import { AppUIProvider } from '../contexts/app-ui'
import { BrowserTabsProvider } from '../contexts/browser-tabs'
import { PluginRuntimeProvider, usePluginRuntime } from '../plugins/runtime'
import { PluginBrowserSessionProvider } from '../plugins/browser-session'
import { CreditsProvider } from '../contexts/credits'
import {
  getMe,
  getMyCredits,
  listThreads,
  streamThreadRunStateEvents,
  type MeCreditsResponse,
  type MeResponse,
} from '../api'

const desktopMock = vi.hoisted(() => ({
  isDesktop: vi.fn(() => true),
  getDesktopApi: vi.fn(() => ({
    browserTabs: {
      list: vi.fn().mockResolvedValue({ tabs: [] }),
      create: vi.fn(),
      close: vi.fn().mockResolvedValue({ tabs: [] }),
      navigate: vi.fn(),
      reload: vi.fn(),
      goBack: vi.fn(),
      goForward: vi.fn(),
      show: vi.fn().mockResolvedValue({ ok: true }),
      hide: vi.fn().mockResolvedValue({ ok: true }),
      syncBounds: vi.fn().mockResolvedValue({ ok: true }),
      onStateChanged: vi.fn(() => () => {}),
    },
    managedApps: {
      ensure: vi.fn(async () => ({
        appId: 'open-design',
        status: 'running',
        daemonUrl: 'http://127.0.0.1:17456',
        webUrl: 'http://127.0.0.1:17573',
        pids: { daemon: 101, web: 202 },
        lastError: null,
      })),
      getStatus: vi.fn(async () => ({
        appId: 'open-design',
        status: 'running',
        daemonUrl: 'http://127.0.0.1:17456',
        webUrl: 'http://127.0.0.1:17573',
        pids: { daemon: 101, web: 202 },
        lastError: null,
      })),
      restart: vi.fn(),
      stop: vi.fn(),
      mountMainArea: vi.fn(async () => ({ ok: true })),
      syncMainAreaBounds: vi.fn(async () => ({ ok: true })),
      unmountMainArea: vi.fn(async () => ({ ok: true })),
    },
  })),
}))

vi.mock('@arkloop/shared/desktop', async () => {
  const actual =
    await vi.importActual<typeof import('@arkloop/shared/desktop')>(
      '@arkloop/shared/desktop',
    )
  return {
    ...actual,
    isDesktop: desktopMock.isDesktop,
    getDesktopApi: desktopMock.getDesktopApi,
  }
})

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    getMe: vi.fn(),
    listThreads: vi.fn(),
    getMyCredits: vi.fn(),
    streamThreadRunStateEvents: vi.fn(),
  }
})

function PluginOpener({ pluginId }: { pluginId: string }) {
  const { openPlugin } = usePluginRuntime()
  const openedRef = useRef(false)

  useEffect(() => {
    if (openedRef.current) return
    openedRef.current = true
    void openPlugin(pluginId)
  }, [openPlugin, pluginId])

  return null
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="path">{location.pathname}</div>
}

describe('AppLayout managed page takeover', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const mockedGetMe = vi.mocked(getMe)
  const mockedListThreads = vi.mocked(listThreads)
  const mockedGetMyCredits = vi.mocked(getMyCredits)
  const mockedStreamThreadRunStateEvents = vi.mocked(streamThreadRunStateEvents)
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    mockedGetMe.mockResolvedValue({
      id: 'user-1',
      username: 'Test User',
      email: 'test@example.com',
      email_verified: true,
      email_verification_required: false,
      work_enabled: true,
      timezone: 'Asia/Shanghai',
      account_timezone: 'Asia/Shanghai',
    } satisfies MeResponse)
    mockedListThreads.mockResolvedValue([])
    mockedGetMyCredits.mockResolvedValue({
      balance: 0,
      transactions: [],
    } satisfies MeCreditsResponse)
    mockedStreamThreadRunStateEvents.mockReturnValue(new Promise(() => {}))
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

  it('replaces the normal workspace with the managed main-area host', async () => {
    await act(async () => {
      root.render(
        <LocaleProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/t/thread-1']}>
              <AuthProvider accessToken="token" onLoggedOut={vi.fn()}>
                <ThreadListProvider>
                  <AppUIProvider>
                    <BrowserTabsProvider>
                      <PluginRuntimeProvider>
                        <PluginBrowserSessionProvider>
                          <CreditsProvider>
                            <PluginOpener pluginId="open-design" />
                            <LocationProbe />
                            <Routes>
                              <Route element={<AppLayout />}>
                                <Route path="/t/:threadId" element={<div data-testid="chat-view">Chat view</div>} />
                              </Route>
                            </Routes>
                          </CreditsProvider>
                        </PluginBrowserSessionProvider>
                      </PluginRuntimeProvider>
                    </BrowserTabsProvider>
                  </AppUIProvider>
                </ThreadListProvider>
              </AuthProvider>
            </MemoryRouter>
          </ToastProvider>
        </LocaleProvider>,
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe('/t/thread-1')
    expect(container.querySelector('[data-testid="workspace-host"]')).toBeNull()
    expect(container.querySelector('[data-testid="chat-view"]')).toBeNull()
    expect(container.querySelector('[data-testid="desktop-main-area-host"]')).not.toBeNull()
  })
})
