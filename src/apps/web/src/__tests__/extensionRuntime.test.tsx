import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ExtensionRuntimeProvider, useExtensionRuntime } from '../extensions/extension-runtime'

vi.mock('../storage', async () => {
  const actual = await vi.importActual<typeof import('../storage')>('../storage')
  return {
    ...actual,
    readExtensionRuntimeState: vi.fn(() => ({
      lastExtensionId: 'open-design',
      presentationByExtensionId: { 'open-design': 'route' as const },
    })),
    writeExtensionRuntimeState: vi.fn(),
  }
})

function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeExtensionId, openExtension } = useExtensionRuntime()

  return (
    <div>
      <div data-testid="active">{activeExtensionId ?? 'none'}</div>
      <div data-testid="path">{location.pathname}</div>
      <button type="button" onClick={() => void openExtension('open-design')}>
        open-design
      </button>
      <button type="button" onClick={() => navigate('/t/thread-2')}>
        go-thread
      </button>
    </div>
  )
}

describe('ExtensionRuntimeProvider', () => {
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

  it('opens a extension route and tracks the active extension id', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <ExtensionRuntimeProvider>
            <Probe />
          </ExtensionRuntimeProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('open-design')
    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe('/extensions/open-design')
  })

  it('does not restore an active extension highlight on cold start outside extension context', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/t/thread-1']}>
          <ExtensionRuntimeProvider>
            <Probe />
          </ExtensionRuntimeProvider>
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe('/t/thread-1')
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('none')
  })

  it('clears the active extension when leaving extension mode for a thread route', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/t/thread-1']}>
          <ExtensionRuntimeProvider>
            <Probe />
          </ExtensionRuntimeProvider>
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
