import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BrowserTabsProvider } from '../contexts/browser-tabs'
import {
  ExtensionBrowserSessionProvider,
  useExtensionBrowserSession,
} from '../extensions/extension-browser-session'

const desktopMock = vi.hoisted(() => {
  let stateChangedHandler:
    | ((snapshot: { tabs: Array<{
        id: string
        title: string
        url: string
        faviconUrl: string | null
        loading: boolean
        error: string | null
        canGoBack: boolean
        canGoForward: boolean
      }> }) => void)
    | null = null

  const browserTabsApi = {
    list: vi.fn().mockResolvedValue({ tabs: [] }),
    create: vi.fn().mockImplementation(async () => {
      const tab = {
        id: 'browser-extension',
        title: 'Extension Tab',
        url: 'https://example.com/',
        faviconUrl: null,
        loading: false,
        error: null,
        canGoBack: false,
        canGoForward: false,
      }
      stateChangedHandler?.({ tabs: [tab] })
      return tab
    }),
    close: vi.fn(),
    navigate: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    syncBounds: vi.fn(),
    onStateChanged: vi.fn((callback) => {
      stateChangedHandler = callback
      return () => {
        stateChangedHandler = null
      }
    }),
  }

  return {
    isDesktop: vi.fn(() => true),
    getDesktopApi: vi.fn(() => ({ browserTabs: browserTabsApi })),
    browserTabsApi,
  }
})

vi.mock('@arkloop/shared/desktop', () => ({
  isDesktop: desktopMock.isDesktop,
  getDesktopApi: desktopMock.getDesktopApi,
}))

function Probe() {
  const { ensureBrowserSession } = useExtensionBrowserSession()

  return (
    <button type="button" onClick={() => void ensureBrowserSession('sample-extension')}>
      ensure
    </button>
  )
}

describe('ExtensionBrowserSessionProvider', () => {
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

  it('creates one browser tab per extension and reuses it on repeated activation', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <BrowserTabsProvider>
            <ExtensionBrowserSessionProvider>
              <Probe />
            </ExtensionBrowserSessionProvider>
          </BrowserTabsProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    await act(async () => {
      const button = container.querySelector('button')
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(desktopMock.browserTabsApi.create).toHaveBeenCalledTimes(1)
  })
})
