import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ExtensionRuntimeProvider } from '../extensions/extension-runtime'
import { ExtensionSidebarSection } from '../extensions/ExtensionSidebarSection'

const desktopMock = vi.hoisted(() => ({
  isDesktop: vi.fn(() => true),
}))

vi.mock('@arkloop/shared/desktop', () => ({
  isDesktop: desktopMock.isDesktop,
}))

function Probe() {
  const location = useLocation()
  return <div data-testid="path">{location.pathname}</div>
}

describe('ExtensionSidebarSection', () => {
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
    if (originalActEnvironment === undefined) {
      delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    } else {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    }
  })

  it('renders open-design in the sidebar and navigates on click', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/t/thread-1']}>
          <ExtensionRuntimeProvider>
            <ExtensionSidebarSection />
            <Probe />
          </ExtensionRuntimeProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Open Design')

    await act(async () => {
      container
        .querySelector('[data-testid="extension-entry-open-design"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe('/extensions/open-design')
  })
})
