import { BrowserView, type BrowserWindow } from 'electron'

export type MainAreaBounds = {
  x: number
  y: number
  width: number
  height: number
}

export function createMainAreaBrowserHost(deps: {
  getWindow: () => BrowserWindow | null
  createView?: () => BrowserView
}) {
  const views = new Map<string, BrowserView>()
  const pendingLoads = new Set<string>()
  const createView = deps.createView
    ?? (() => new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    }))

  return {
    async show(appId: string, url: string, bounds: MainAreaBounds): Promise<{ ok: boolean }> {
      const win = deps.getWindow()
      if (!win || win.isDestroyed()) {
        return { ok: false }
      }

      const view = views.get(appId) ?? createView()
      views.set(appId, view)

      if (!win.getBrowserViews().includes(view)) {
        win.addBrowserView(view)
      }
      win.setTopBrowserView(view)
      view.setBounds(bounds)
      view.setAutoResize({ width: true, height: true })

      if (view.webContents.getURL() !== url && !pendingLoads.has(appId)) {
        pendingLoads.add(appId)
        try {
          await view.webContents.loadURL(url)
        } catch {
          // ignore load errors (e.g. abort) so they don't bubble as unhandled rejections
        } finally {
          pendingLoads.delete(appId)
        }
      }

      return { ok: true }
    },

    hide(appId: string): { ok: boolean } {
      const win = deps.getWindow()
      const view = views.get(appId)
      if (!win || win.isDestroyed() || !view) {
        return { ok: true }
      }

      try {
        win.removeBrowserView(view)
      } catch {}

      return { ok: true }
    },

    syncBounds(appId: string, bounds: MainAreaBounds): { ok: boolean } {
      views.get(appId)?.setBounds(bounds)
      return { ok: true }
    },
  }
}
