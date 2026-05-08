import { useEffect, useRef } from 'react'

import { getDesktopApi, type ManagedDesktopAppBounds, type ManagedDesktopAppId } from '@arkloop/shared/desktop'

function readBounds(element: HTMLDivElement): ManagedDesktopAppBounds {
  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

export function DesktopMainAreaHost({ appId }: { appId: ManagedDesktopAppId }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const api = getDesktopApi()
    const managedApps = api?.managedApps
    const element = ref.current
    if (!managedApps || !element) return

    const syncBounds = () => {
      void managedApps.syncMainAreaBounds(appId, readBounds(element))
    }

    void managedApps.mountMainArea(appId, readBounds(element))
    syncBounds()
    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => syncBounds()) : null
    resizeObserver?.observe(element)
    window.addEventListener('resize', syncBounds)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', syncBounds)
      void managedApps.unmountMainArea(appId)
    }
  }, [appId])

  return <div ref={ref} className="h-full w-full" data-testid="desktop-main-area-host" />
}
