import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PluginRuntimeProvider, usePluginRuntime } from '../plugins/runtime'

vi.mock('../storage', async () => {
  const actual = await vi.importActual<typeof import('../storage')>('../storage')
  return {
    ...actual,
    readPluginRuntimeState: vi.fn(() => ({
      lastPluginId: 'open-design',
      presentationByPluginId: { 'open-design': 'route' as const },
    })),
    writePluginRuntimeState: vi.fn(),
  }
})

function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  const { activePluginId, openPlugin } = usePluginRuntime()

  return (
    <div>
      <div data-testid="active">{activePluginId ?? 'none'}</div>
      <div data-testid="path">{location.pathname}</div>
      <button type="button" onClick={() => void openPlugin('open-design')}>
        open-design
      </button>
      <button type="button" onClick={() => navigate('/t/thread-2')}>
        go-thread
      </button>
    </div>
  )
}

describe('PluginRuntimeProvider', () => {
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

  it('opens a plugin route and tracks the active plugin id', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <PluginRuntimeProvider>
            <Probe />
          </PluginRuntimeProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('open-design')
    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe('/plugins/open-design')
  })

  it('does not restore an active plugin highlight on cold start outside plugin context', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/t/thread-1']}>
          <PluginRuntimeProvider>
            <Probe />
          </PluginRuntimeProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe('/t/thread-1')
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('none')
  })

  it('clears the active plugin when leaving plugin mode for a thread route', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/t/thread-1']}>
          <PluginRuntimeProvider>
            <Probe />
          </PluginRuntimeProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('open-design')

    await act(async () => {
      container
        .querySelectorAll('button')[1]
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe('/t/thread-2')
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('none')
  })
})
