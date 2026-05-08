import { useEffect, useState } from 'react'

import { getDesktopApi } from '@arkloop/shared/desktop'

import { DesktopMainAreaHost } from '../components/DesktopMainAreaHost'

export function OpenDesignPluginHost() {
  const [state, setState] = useState<'starting' | 'running' | 'failed'>('starting')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const api = getDesktopApi()
    if (!api?.managedApps) {
      setState('failed')
      setError('仅桌面端支持 Open Design')
      return
    }

    void api.managedApps.ensure('open-design').then((runtime) => {
      if (cancelled) return
      if (runtime.status !== 'running' || !runtime.webUrl) {
        setState('failed')
        setError(runtime.lastError ?? 'Open Design 未能启动')
        return
      }
      setState('running')
    }).catch((reason) => {
      if (cancelled) return
      setState('failed')
      setError(reason instanceof Error ? reason.message : String(reason))
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'failed') {
    return <div data-testid="open-design-plugin-error">{error}</div>
  }

  if (state === 'starting') {
    return <div data-testid="open-design-plugin-loading">Open Design 启动中...</div>
  }

  return <DesktopMainAreaHost appId="open-design" />
}
