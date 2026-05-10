import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '../contexts/LocaleContext'
import { BrowserTabsProvider } from '../contexts/browser-tabs'
import { PluginBrowserSessionProvider } from '../plugins/browser-session'
import { PluginWorkspaceShell } from '../plugins/PluginWorkspaceShell'
import { PluginRuntimeProvider } from '../plugins/runtime'
import type { PluginDefinition } from '../plugins/types'

const desktopMock = vi.hoisted(() => ({
  isDesktop: vi.fn(() => true),
  getDesktopApi: vi.fn(() => ({})),
}))

vi.mock('@arkloop/shared/desktop', () => ({
  isDesktop: desktopMock.isDesktop,
  getDesktopApi: desktopMock.getDesktopApi,
}))

function SamplePluginBody() {
  return <div data-testid="sample-plugin-body">sample plugin page</div>
}

const routePlugin: PluginDefinition = {
  id: 'test-plugin',
  title: 'Test Plugin',
  desktopOnly: true,
  nav: { section: 'workspace', order: 100 },
  shell: { mode: 'plugin-main' },
  presentation: {
    default: 'route',
    supported: ['route'],
  },
  surfaces: {
    mount: SamplePluginBody,
  },
}

describe('PluginWorkspaceShell', () => {
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

  it('renders the plugin component in route mode', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/plugins/test-plugin']}>
          <LocaleProvider>
            <BrowserTabsProvider>
              <PluginRuntimeProvider>
                <PluginBrowserSessionProvider>
                  <PluginWorkspaceShell plugin={routePlugin} presentation="route" />
                </PluginBrowserSessionProvider>
              </PluginRuntimeProvider>
            </BrowserTabsProvider>
          </LocaleProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="sample-plugin-body"]')).not.toBeNull()
    expect(container.textContent).toContain('Test Plugin')
  })

  it('does not render a presentation switcher when only route is supported', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/plugins/test-plugin']}>
          <LocaleProvider>
            <BrowserTabsProvider>
              <PluginRuntimeProvider>
                <PluginBrowserSessionProvider>
                  <PluginWorkspaceShell plugin={routePlugin} presentation="route" />
                </PluginBrowserSessionProvider>
              </PluginRuntimeProvider>
            </BrowserTabsProvider>
          </LocaleProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid^="plugin-presentation-button-"]')).toBeNull()
  })
})
