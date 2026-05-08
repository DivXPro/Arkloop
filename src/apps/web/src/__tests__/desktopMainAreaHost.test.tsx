import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DesktopMainAreaHost } from '../components/DesktopMainAreaHost'

const desktopMock = vi.hoisted(() => {
  const managedAppsApi = {
    mountMainArea: vi.fn(async () => ({ ok: true })),
    syncMainAreaBounds: vi.fn(async () => ({ ok: true })),
    unmountMainArea: vi.fn(async () => ({ ok: true })),
  }

  return {
    getDesktopApi: vi.fn(() => ({ managedApps: managedAppsApi })),
    managedAppsApi,
  }
})

vi.mock('@arkloop/shared/desktop', async () => {
  const actual =
    await vi.importActual<typeof import('@arkloop/shared/desktop')>(
      '@arkloop/shared/desktop',
    )
  return {
    ...actual,
    getDesktopApi: desktopMock.getDesktopApi,
  }
})

type ResizeObserverRecord = {
  callback: ResizeObserverCallback
  target: Element | null
}

describe('DesktopMainAreaHost', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let resizeObserverRecords: ResizeObserverRecord[]
  let originalResizeObserver: typeof ResizeObserver | undefined
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    resizeObserverRecords = []
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class ResizeObserverMock {
      private readonly record: ResizeObserverRecord

      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, target: null }
        resizeObserverRecords.push(this.record)
      }

      observe(target: Element) {
        this.record.target = target
      }

      unobserve() {}

      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    desktopMock.managedAppsApi.mountMainArea.mockClear()
    desktopMock.managedAppsApi.syncMainAreaBounds.mockClear()
    desktopMock.managedAppsApi.unmountMainArea.mockClear()
    if (originalResizeObserver === undefined) {
      Reflect.deleteProperty(globalThis, 'ResizeObserver')
    } else {
      globalThis.ResizeObserver = originalResizeObserver
    }
    if (originalActEnvironment === undefined) {
      delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    } else {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    }
  })

  it('syncs managed app bounds when the host element resizes', async () => {
    await act(async () => {
      root.render(<DesktopMainAreaHost appId="open-design" />)
      await Promise.resolve()
    })

    const host = container.querySelector('[data-testid="desktop-main-area-host"]') as HTMLDivElement | null
    expect(host).not.toBeNull()
    expect(resizeObserverRecords).toHaveLength(1)

    let rect = {
      left: 0,
      top: 0,
      width: 320,
      height: 240,
    }
    Object.defineProperty(host!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        ...rect,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }),
    })

    rect = {
      left: 0,
      top: 0,
      width: 640,
      height: 240,
    }

    const syncCallCountBeforeResize = desktopMock.managedAppsApi.syncMainAreaBounds.mock.calls.length

    await act(async () => {
      resizeObserverRecords[0]?.callback(
        [{ target: host! } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      )
      await Promise.resolve()
    })

    expect(desktopMock.managedAppsApi.syncMainAreaBounds).toHaveBeenCalledTimes(
      syncCallCountBeforeResize + 1,
    )
    expect(desktopMock.managedAppsApi.syncMainAreaBounds).toHaveBeenLastCalledWith(
      'open-design',
      {
        x: 0,
        y: 0,
        width: 640,
        height: 240,
      },
    )
  })
})
