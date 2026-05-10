import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '../contexts/LocaleContext'
import { BrowserTabsProvider } from '../contexts/browser-tabs'
import { ExtensionBrowserSessionProvider } from '../extensions/extension-browser-session'
import { ExtensionHostPage } from '../extensions/ExtensionHostPage'
import { ExtensionRuntimeProvider } from '../extensions/extension-runtime'

const desktopMock = vi.hoisted(() => {
  const managedAppsApi = {
    ensureStarted: vi.fn().mockResolvedValue({
      appId: 'open-design',
      status: 'running',
      pid: 321,
      webUrl: 'http://127.0.0.1:54321/',
      lastError: null,
      startedAt: '2026-05-09T00:00:00.000Z',
    }),
    getStatus: vi.fn(),
    restart: vi.fn(),
    showMainArea: vi.fn().mockResolvedValue({ ok: true }),
    hideMainArea: vi.fn().mockResolvedValue({ ok: true }),
    syncMainAreaBounds: vi.fn().mockResolvedValue({ ok: true }),
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

describe('ExtensionHostPage', () => {
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

  it('renders open-design extension page through route surface', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/extensions/open-design']}>
          <LocaleProvider>
            <BrowserTabsProvider>
              <ExtensionRuntimeProvider>
                <ExtensionBrowserSessionProvider>
                  <Routes>
                    <Route path="/extensions/:extensionId" element={<ExtensionHostPage />} />
                  </Routes>
                </ExtensionBrowserSessionProvider>
              </ExtensionRuntimeProvider>
            </BrowserTabsProvider>
          </LocaleProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="open-design-extension-ready"]')).not.toBeNull()
    expect(desktopMock.managedAppsApi.ensureStarted).toHaveBeenCalledWith('open-design')
  })
})
