import { BrowserView, type BrowserWindow } from 'electron'

import type { ManagedLocalAppBounds, ManagedLocalAppId } from './managed-local-apps/types'

export function createMainAreaBrowserHost(deps: {
  getWindow: () => BrowserWindow | null
  createView?: () => BrowserView
}) {
  const views = new Map<ManagedLocalAppId, BrowserView>()
  const createView =
    deps.createView ??
    (() =>
      new BrowserView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      }))

  async function show(appId: ManagedLocalAppId, url: string, bounds: ManagedLocalAppBounds): Promise<void> {
    const win = deps.getWindow()
    if (!win || win.isDestroyed()) return

    const view = views.get(appId) ?? createView()
    views.set(appId, view)

    if (!win.getBrowserViews().includes(view)) {
      win.addBrowserView(view)
    }

    win.setTopBrowserView(view)
    view.setBounds(bounds)
    view.setAutoResize({ width: true, height: true })

    if (view.webContents.getURL() !== url) {
      await view.webContents.loadURL(url)
    }
  }

  function hide(appId: ManagedLocalAppId): void {
    const win = deps.getWindow()
    const view = views.get(appId)
    if (!win || !view) return
    try {
      win.removeBrowserView(view)
    } catch {}
  }

  function syncBounds(appId: ManagedLocalAppId, bounds: ManagedLocalAppBounds): void {
    const view = views.get(appId)
    if (!view) return
    view.setBounds(bounds)
  }

  return {
    show,
    hide,
    syncBounds,
  }
}
