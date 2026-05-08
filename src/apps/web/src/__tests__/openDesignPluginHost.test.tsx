import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OpenDesignPluginHost } from '../plugins/OpenDesignPluginHost'

const ensure = vi.fn(async () => ({
  appId: 'open-design',
  status: 'running',
  daemonUrl: 'http://127.0.0.1:17456',
  webUrl: 'http://127.0.0.1:17573',
  pids: { daemon: 101, web: 202 },
  lastError: null,
}))

const mountMainArea = vi.fn(async () => ({ ok: true }))
const syncMainAreaBounds = vi.fn(async () => ({ ok: true }))
const unmountMainArea = vi.fn(async () => ({ ok: true }))

vi.mock('@arkloop/shared/desktop', async () => {
  const actual = await vi.importActual<typeof import('@arkloop/shared/desktop')>('@arkloop/shared/desktop')
  return {
    ...actual,
    getDesktopApi: () => ({
      managedApps: {
        ensure,
        mountMainArea,
        syncMainAreaBounds,
        unmountMainArea,
      },
    }),
  }
})

describe('OpenDesignPluginHost', () => {
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

  it('ensures the managed app and renders the desktop host when running', async () => {
    await act(async () => {
      root.render(<OpenDesignPluginHost />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(ensure).toHaveBeenCalledWith('open-design')
    expect(container.querySelector('[data-testid="desktop-main-area-host"]')).not.toBeNull()
  })
})
