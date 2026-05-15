import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '../contexts/LocaleContext'
import { BrowserTabsProvider } from '../contexts/browser-tabs'
import { ExtensionBrowserSessionProvider } from '../extensions/extension-browser-session'
import { ExtensionWorkspaceShell } from '../extensions/ExtensionWorkspaceShell'
import { ExtensionRuntimeProvider } from '../extensions/extension-runtime'
import type { ExtensionDefinition } from '../extensions/types'

const desktopMock = vi.hoisted(() => ({
  isDesktop: vi.fn(() => true),
  getDesktopApi: vi.fn(() => ({})),
}))

vi.mock('@arkloop/shared/desktop', () => ({
  isDesktop: desktopMock.isDesktop,
  getDesktopApi: desktopMock.getDesktopApi,
}))

function SampleExtensionBody() {
  return <div data-testid="sample-extension-body">sample extension page</div>
}

const routeExtension: ExtensionDefinition = {
  id: 'test-extension',
  title: 'Test Extension',
  desktopOnly: true,
  nav: { section: 'workspace', order: 100 },
  shell: { mode: 'extension-main' },
  presentation: {
    default: 'route',
    supported: ['route'],
  },
  surfaces: {
    mount: SampleExtensionBody,
  },
}

describe('ExtensionWorkspaceShell', () => {
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

  it('renders the extension component in route mode', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/extensions/test-extension']}>
          <LocaleProvider>
            <BrowserTabsProvider>
              <ExtensionRuntimeProvider>
                <ExtensionBrowserSessionProvider>
                  <ExtensionWorkspaceShell extension={routeExtension} presentation="route" />
                </ExtensionBrowserSessionProvider>
              </ExtensionRuntimeProvider>
            </BrowserTabsProvider>
          </LocaleProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="sample-extension-body"]')).not.toBeNull()
    expect(container.textContent).toContain('Test Extension')
  })

  it('does not render a presentation switcher when only route is supported', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/extensions/test-extension']}>
          <LocaleProvider>
            <BrowserTabsProvider>
              <ExtensionRuntimeProvider>
                <ExtensionBrowserSessionProvider>
                  <ExtensionWorkspaceShell extension={routeExtension} presentation="route" />
                </ExtensionBrowserSessionProvider>
              </ExtensionRuntimeProvider>
            </BrowserTabsProvider>
          </LocaleProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid^="extension-presentation-button-"]')).toBeNull()
  })
})
