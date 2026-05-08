import { describe, expect, it, vi } from 'vitest'

import { createMainAreaBrowserHost } from './browser-main-area'

describe('createMainAreaBrowserHost', () => {
  it('reuses a dedicated BrowserView per app id and tracks visibility', async () => {
    const addBrowserView = vi.fn()
    const removeBrowserView = vi.fn()
    const setTopBrowserView = vi.fn()
    const setBounds = vi.fn()
    const setAutoResize = vi.fn()
    const loadURL = vi.fn(async () => {})

    const host = createMainAreaBrowserHost({
      createView: () =>
        ({
          setBounds,
          setAutoResize,
          webContents: {
            getURL: () => '',
            loadURL,
          },
        }) as never,
      getWindow: () =>
        ({
          addBrowserView,
          removeBrowserView,
          setTopBrowserView,
          getBrowserViews: () => [],
          isDestroyed: () => false,
        }) as never,
    })

    await host.show('open-design', 'http://127.0.0.1:17573', {
      x: 10,
      y: 20,
      width: 900,
      height: 700,
    })

    expect(addBrowserView).toHaveBeenCalledTimes(1)
    expect(setTopBrowserView).toHaveBeenCalledTimes(1)
    expect(setBounds).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 900,
      height: 700,
    })
    expect(setAutoResize).toHaveBeenCalledWith({ width: true, height: true })
    expect(loadURL).toHaveBeenCalledWith('http://127.0.0.1:17573')
  })
})
