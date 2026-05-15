import { getDesktopApi, isDesktop } from '@arkloop/shared/desktop'
import { useEffect, useRef, useState } from 'react'

type OpenDesignViewState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; webUrl: string }

export function OpenDesignExtensionPage() {
  const [state, setState] = useState<OpenDesignViewState>({ phase: 'loading' })
  const containerRef = useRef<HTMLDivElement>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!isDesktop()) {
      setState({
        phase: 'error',
        message: 'Open Design is only available in desktop mode.',
      })
      return
    }

    const managedApps = getDesktopApi()?.managedApps
    if (!managedApps) {
      setState({
        phase: 'error',
        message: 'Desktop managed-app API is unavailable.',
      })
      return
    }

    let disposed = false
    void managedApps
      .ensureStarted('open-design')
      .then((runtime) => {
        if (disposed) return
        if (runtime.status !== 'running' || !runtime.webUrl) {
          setState({
            phase: 'error',
            message: runtime.lastError ?? 'Open Design failed to start.',
          })
          return
        }
        setState({ phase: 'ready', webUrl: runtime.webUrl })
      })
      .catch((error) => {
        if (disposed) return
        setState({
          phase: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      })

    return () => {
      disposed = true
      void managedApps.hideMainArea('open-design').catch(() => {})
    }
  }, [retryKey])

  // Show BrowserView in main area and sync bounds on resize
  useEffect(() => {
    if (state.phase !== 'ready') return

    const managedApps = getDesktopApi()?.managedApps
    if (!managedApps) return

    const container = containerRef.current
    if (!container) return

    const syncBounds = () => {
      const rect = container.getBoundingClientRect()
      void managedApps.showMainArea('open-design', state.webUrl, {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    }

    syncBounds()

    const observer = new ResizeObserver(() => {
      syncBounds()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [state])

  const handleRetry = () => {
    setState({ phase: 'loading' })
    setRetryKey((k) => k + 1)
  }

  if (state.phase === 'loading') {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
        data-testid="open-design-extension-loading"
      >
        Loading Open Design…
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full flex-col items-center justify-center gap-4 p-6"
        data-testid="open-design-extension-error"
      >
        <div className="text-(--c-status-error)">{state.message}</div>
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-md bg-(--c-bg-sub) px-4 py-2 text-sm text-(--c-text-primary) hover:bg-(--c-border-subtle)"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      data-testid="open-design-extension-ready"
    />
  )
}
