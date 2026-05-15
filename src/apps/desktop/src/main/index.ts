import { app, BrowserWindow, Menu, nativeImage, powerSaveBlocker, session, shell } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { loadConfig, normalizeConfig, saveConfig } from './config'
import {
  startSidecar,
  stopSidecar,
  setStatusListener,
  setRuntimeListener,
  setBridgeUrlListener,
  setMemoryConfig,
  setNetworkConfig,
  getSidecarRuntime,
  getBridgeBaseUrl,
  getDesktopAccessToken,
  stopBridgeOpenvikingIfNeeded,
  ensureOpenCLI,
  type SidecarRuntime,
} from './sidecar'
import { createTray, registerGlobalShortcut, destroyTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { initVersionsFile } from './config'
import { setupAppUpdater } from './app-updater'
import { setupMainProcessLogging, getDesktopLogDir } from './logging'
import { syncLocalVersions } from './updater'
import { ensureBrowserSearchServer, closeBrowserSearchServer } from './browser-search'
import { createMainAreaBrowserHost } from './browser-main-area'
import {
  getOpenDesignInstallPaths,
  readOpenDesignReadyFile,
  validateOpenDesignInstall,
} from './managed-apps/open-design'
import { createManagedAppRuntimeManager } from './managed-apps/runtime-manager'
import type {
  ManagedAppId,
  ManagedAppMainAreaBounds,
  ManagedAppState,
} from './managed-apps/types'
import type { AppConfig, ApplyConfigUpdateOptions } from './types'

app.setName('Arkloop')

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-lcd-text')
}

setupMainProcessLogging()

let mainWindow: BrowserWindow | null = null
let activeSidecarPort: number | null = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()
const managedAppProcesses = new Map<ManagedAppId, ChildProcess>()
const OPEN_DESIGN_READY_TIMEOUT_MS = 30_000
const OPEN_DESIGN_READY_POLL_MS = 400

const REACT_DEVTOOLS_EXTENSION_ID = 'fmkadmapgofadopljbjfkapdkoienihi'

function parseHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed
  } catch {}
  return null
}

function getRendererDevOrigin(): string {
  try {
    return new URL(process.env.VITE_DEV_URL || 'http://localhost:5173').origin
  } catch {
    return 'http://localhost:5173'
  }
}

function isAppHttpNavigation(url: string): boolean {
  if (process.env.ELECTRON_DEV !== 'true') return false
  const parsed = parseHttpUrl(url)
  return parsed?.origin === getRendererDevOrigin()
}

function getAppIconPath(): string {
  const candidates = app.isPackaged
    ? (
      process.platform === 'darwin'
        ? [
            path.join(process.resourcesPath, 'icon.icns'),
            path.join(process.resourcesPath, 'app.asar', 'resources', 'icon.png'),
            path.join(app.getAppPath(), 'resources', 'icon.icns'),
          ]
        : process.platform === 'win32'
          ? [
              path.join(process.resourcesPath, 'icon.ico'),
              path.join(process.resourcesPath, 'app.asar', 'resources', 'icon.ico'),
              path.join(app.getAppPath(), 'resources', 'icon.ico'),
            ]
          : [
              path.join(process.resourcesPath, 'icon.png'),
              path.join(process.resourcesPath, 'app.asar', 'resources', 'icon.png'),
              path.join(app.getAppPath(), 'resources', 'icon.png'),
            ]
    )
    : [
        path.join(__dirname, '..', '..', 'resources', 'icon.png'),
        path.join(__dirname, '..', '..', 'resources', 'icon.icns'),
        path.join(app.getAppPath(), 'resources', 'icon.png'),
      ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[0]
}

function applyAppIcon(): void {
  const icon = nativeImage.createFromPath(getAppIconPath())
  if (icon.isEmpty()) return
  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }
}

function ensureDockPresence(): void {
  if (process.platform !== 'darwin') return
  app.setActivationPolicy('regular')
  app.dock?.show()
}

function getReactDevToolsExtensionPath(): string | null {
  const home = os.homedir()
  const extensionRoots = [
    path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Extensions', REACT_DEVTOOLS_EXTENSION_ID),
    path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Profile 1', 'Extensions', REACT_DEVTOOLS_EXTENSION_ID),
    path.join(home, 'Library', 'Application Support', 'Google', 'Chrome Beta', 'Default', 'Extensions', REACT_DEVTOOLS_EXTENSION_ID),
    path.join(home, 'Library', 'Application Support', 'Google', 'Chrome Canary', 'Default', 'Extensions', REACT_DEVTOOLS_EXTENSION_ID),
    path.join(home, 'Library', 'Application Support', 'Microsoft Edge', 'Default', 'Extensions', REACT_DEVTOOLS_EXTENSION_ID),
  ]

  for (const root of extensionRoots) {
    if (!fs.existsSync(root)) continue
    const versions = fs.readdirSync(root)
      .map((entry) => path.join(root, entry))
      .filter((entryPath) => fs.existsSync(path.join(entryPath, 'manifest.json')))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const latest = versions.at(-1)
    if (latest) return latest
  }

  return null
}

async function installReactDevTools(): Promise<void> {
  if (process.env.ELECTRON_DEV !== 'true') return
  const extensionPath = getReactDevToolsExtensionPath()
  if (!extensionPath) return
  try {
    await session.defaultSession.loadExtension(extensionPath, { allowFileAccess: true })
    console.info('[desktop]', { reactDevTools: 'loaded', extensionPath })
  } catch (error) {
    console.error('[desktop] react-devtools load failed', error instanceof Error ? error.message : String(error))
  }
}

function getWindow(): BrowserWindow | null {
  return mainWindow
}

const mainAreaBrowserHost = createMainAreaBrowserHost({
  getWindow,
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function terminateProcess(pid: number): Promise<void> {
  if (!isProcessAlive(pid)) return
  try {
    process.kill(pid, 'SIGTERM')
  } catch {}

  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return
    await sleep(200)
  }

  try {
    process.kill(pid, 'SIGKILL')
  } catch {}
}

async function launchManagedApp(appId: ManagedAppId): Promise<{ pid: number }> {
  if (appId !== 'open-design') {
    throw new Error(`unsupported managed app: ${appId}`)
  }

  const existing = managedAppProcesses.get(appId)
  if (existing?.pid && existing.exitCode === null) {
    if (isProcessAlive(existing.pid)) {
      return { pid: existing.pid }
    }
    managedAppProcesses.delete(appId)
  }

  const installPaths = getOpenDesignInstallPaths()
  validateOpenDesignInstall(installPaths)

  // Remove stale ready file from a previous session so pollManagedAppReady
  // doesn't accidentally read an old port before the new process writes it.
  try {
    if (fs.existsSync(installPaths.readyFile)) {
      fs.unlinkSync(installPaths.readyFile)
    }
  } catch {
    // ignore
  }

  const child = spawn(installPaths.nodeBinary, [installPaths.entryScript], {
    cwd: installPaths.runtimeRoot,
    env: {
      ...process.env,
      OD_NAMESPACE: 'default',
      OD_DATA_DIR: installPaths.dataRoot,
      OD_RESOURCE_ROOT: installPaths.resourcesRoot,
      OD_DAEMON_CLI_ENTRY: path.join(
        installPaths.bundleRoot,
        'prebundled',
        'daemon',
        'daemon-cli.mjs',
      ),
      OD_DAEMON_SIDECAR_ENTRY: path.join(
        installPaths.bundleRoot,
        'prebundled',
        'daemon',
        'daemon-sidecar.mjs',
      ),
      OD_WEB_SIDECAR_ENTRY: path.join(
        installPaths.bundleRoot,
        'prebundled',
        'web-sidecar.mjs',
      ),
      OD_WEB_OUTPUT_MODE: 'standalone',
      OD_WEB_STANDALONE_ROOT: path.join(
        installPaths.resourcesRoot,
        'open-design-web-standalone',
        'apps',
        'web',
      ),
    },
    stdio: 'ignore',
  })

  if (!child.pid) {
    throw new Error('failed to start open design runtime')
  }

  managedAppProcesses.set(appId, child)
  child.once('exit', () => {
    const current = managedAppProcesses.get(appId)
    if (current === child) {
      managedAppProcesses.delete(appId)
    }
  })

  return { pid: child.pid }
}

async function pollManagedAppReady(appId: ManagedAppId): Promise<{ webUrl: string }> {
  if (appId !== 'open-design') {
    throw new Error(`unsupported managed app: ${appId}`)
  }

  const installPaths = getOpenDesignInstallPaths()
  const deadline = Date.now() + OPEN_DESIGN_READY_TIMEOUT_MS

  while (Date.now() < deadline) {
    const child = managedAppProcesses.get(appId)
    if (!child || child.exitCode !== null) {
      throw new Error('open design runtime exited before ready')
    }

    if (fs.existsSync(installPaths.readyFile)) {
      const raw = fs.readFileSync(installPaths.readyFile, 'utf8')
      return readOpenDesignReadyFile(raw)
    }
    await sleep(OPEN_DESIGN_READY_POLL_MS)
  }

  throw new Error('open design runtime readiness timeout')
}

async function stopManagedAppByPid(pid: number): Promise<void> {
  await terminateProcess(pid)
  for (const [appId, child] of managedAppProcesses.entries()) {
    if (child.pid === pid) {
      managedAppProcesses.delete(appId)
      break
    }
  }
}

async function stopAllManagedApps(): Promise<void> {
  const pids = Array.from(managedAppProcesses.values())
    .map((child) => child.pid)
    .filter((value): value is number => typeof value === 'number')
  for (const pid of pids) {
    await stopManagedAppByPid(pid)
  }
}

const managedAppRuntimeManager = createManagedAppRuntimeManager({
  launch: launchManagedApp,
  pollReady: pollManagedAppReady,
  stop: stopManagedAppByPid,
})

async function ensureManagedAppStarted(appId: ManagedAppId): Promise<ManagedAppState> {
  return managedAppRuntimeManager.ensureStarted(appId)
}

function getManagedAppState(appId: ManagedAppId): ManagedAppState {
  return managedAppRuntimeManager.getState(appId)
}

async function restartManagedApp(appId: ManagedAppId): Promise<ManagedAppState> {
  await managedAppRuntimeManager.stopApp(appId)
  return managedAppRuntimeManager.ensureStarted(appId)
}

async function showManagedAppInMainArea(
  appId: ManagedAppId,
  url: string,
  bounds: ManagedAppMainAreaBounds,
): Promise<{ ok: boolean }> {
  if (appId !== 'open-design') {
    throw new Error(`unsupported managed app: ${appId}`)
  }
  return mainAreaBrowserHost.show(appId, url, bounds)
}

function hideManagedAppInMainArea(appId: ManagedAppId): { ok: boolean } {
  if (appId !== 'open-design') {
    throw new Error(`unsupported managed app: ${appId}`)
  }
  return mainAreaBrowserHost.hide(appId)
}

function syncManagedAppMainAreaBounds(
  appId: ManagedAppId,
  bounds: ManagedAppMainAreaBounds,
): { ok: boolean } {
  if (appId !== 'open-design') {
    throw new Error(`unsupported managed app: ${appId}`)
  }
  return mainAreaBrowserHost.syncBounds(appId, bounds)
}

function showMainWindow(): void {
  ensureDockPresence()
  const win = mainWindow
  if (!win) return
  if (win.isMinimized()) {
    win.restore()
  }
  win.show()
  if (process.platform === 'linux') {
    app.focus()
  }
  win.focus()
}

function mergeConfigWithRuntime(config: AppConfig, runtime: SidecarRuntime): AppConfig {
  if (config.mode !== 'local') return config
  return normalizeConfig({
    ...config,
    local: {
      ...config.local,
      port: runtime.port ?? config.local.port,
      portMode: runtime.portMode,
    },
  })
}

function syncConfigToRenderer(config: AppConfig): void {
  const win = getWindow()
  if (win) {
    win.webContents.send('arkloop:config:changed', config)
  }
}

function syncRuntimeToRenderer(runtime: SidecarRuntime): void {
  const win = getWindow()
  if (win) {
    win.webContents.send('arkloop:sidecar:runtime-changed', runtime)
  }
}

function syncBridgeBaseUrlToRenderer(bridgeBaseUrl: string): void {
  const win = getWindow()
  if (win) {
    win.webContents.send('arkloop:bridge:url-changed', bridgeBaseUrl)
  }
}

function syncActiveSidecarPort(config: AppConfig, runtime: SidecarRuntime): void {
  activeSidecarPort = config.mode === 'local'
    ? (runtime.port ?? config.local.port)
    : null
}

function handleRuntimeUpdate(runtime: SidecarRuntime): void {
  const current = loadConfig()
  const next = mergeConfigWithRuntime(current, runtime)
  syncActiveSidecarPort(next, runtime)
  if (next.local.port !== current.local.port || next.local.portMode !== current.local.portMode) {
    saveConfig(next)
    syncConfigToRenderer(next)
  }
  syncRuntimeToRenderer(runtime)
}

async function ensureLocalSidecar(config: AppConfig): Promise<AppConfig> {
  if (config.mode !== 'local') {
    activeSidecarPort = null
    return config
  }

  setMemoryConfig(config.memory)
  setNetworkConfig(config.network)
  void ensureOpenCLI()

  const runtime = await startSidecar(config.local.port, config.local.portMode)
  await syncLocalVersions(true)
  const next = mergeConfigWithRuntime(config, runtime)
  syncActiveSidecarPort(next, runtime)
  if (next.local.port !== config.local.port || next.local.portMode !== config.local.portMode) {
    saveConfig(next)
  }
  return next
}

function memoryChanged(a: AppConfig, b: AppConfig): boolean {
  return a.memory.enabled !== b.memory.enabled
    || a.memory.provider !== b.memory.provider
    || JSON.stringify(a.memory.openviking) !== JSON.stringify(b.memory.openviking)
    || JSON.stringify(a.memory.nowledge) !== JSON.stringify(b.memory.nowledge)
}

function networkChanged(a: AppConfig, b: AppConfig): boolean {
  return a.network.proxyEnabled !== b.network.proxyEnabled
    || a.network.proxyUrl !== b.network.proxyUrl
    || a.network.requestTimeoutMs !== b.network.requestTimeoutMs
    || a.network.retryCount !== b.network.retryCount
    || a.network.userAgent !== b.network.userAgent
}

async function applyConfigUpdate(
  config: AppConfig,
  options?: ApplyConfigUpdateOptions,
): Promise<AppConfig> {
  const previous = loadConfig()
  const candidate = normalizeConfig(config)
  const forceLocalReload = Boolean(options?.forceLocalSidecarRestart) && candidate.mode === 'local'
  const needsRestart = previous.mode !== candidate.mode
    || previous.local.port !== candidate.local.port
    || previous.local.portMode !== candidate.local.portMode
    || memoryChanged(previous, candidate)
    || networkChanged(previous, candidate)
    || forceLocalReload

  if (!needsRestart) {
    setNetworkConfig(candidate.network)
    saveConfig(candidate)
    applyDesktopPreferences(candidate)
    syncActiveSidecarPort(candidate, getSidecarRuntime())
    syncConfigToRenderer(candidate)
    return candidate
  }

  const wasOpenviking = previous.mode === 'local'
    && previous.memory.enabled
    && previous.memory.provider === 'openviking'
  const wantOpenviking = candidate.mode === 'local'
    && candidate.memory.enabled
    && candidate.memory.provider === 'openviking'
  if (wasOpenviking && !wantOpenviking) {
    await stopBridgeOpenvikingIfNeeded(previous.memory)
  }

  await stopSidecar()
  try {
    const applied = await ensureLocalSidecar(candidate)
    saveConfig(applied)
    applyDesktopPreferences(applied)
    syncConfigToRenderer(applied)
    return applied
  } catch (error) {
    if (previous.mode === 'local') {
      try {
        const restored = await ensureLocalSidecar(previous)
        saveConfig(restored)
        applyDesktopPreferences(restored)
        syncConfigToRenderer(restored)
      } catch {}
    } else {
      activeSidecarPort = null
    }
    throw error
  }
}

async function restartLocalSidecar(): Promise<SidecarRuntime> {
  const config = loadConfig()
  await stopSidecar()
  const next = await ensureLocalSidecar(config)
  saveConfig(next)
  syncConfigToRenderer(next)
  return getSidecarRuntime()
}

function attachRendererContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = []

    if (params.isEditable) {
      template.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
      )
    } else {
      if (params.selectionText && params.selectionText.trim().length > 0) {
        template.push({ role: 'copy' })
      }
      if (params.mediaType === 'image') {
        template.push({
          label: '复制图片',
          click: () => {
            win.webContents.copyImageAt(Math.floor(params.x), Math.floor(params.y))
          },
        })
      }
    }

    if (template.length === 0) {
      return
    }
    Menu.buildFromTemplate(template).popup({ window: win })
  })
}

function createWindow(): BrowserWindow {
  const config = loadConfig()
  const iconPath = getAppIconPath()
  const isWindows = process.platform === 'win32'

  const win = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: 760,
    minHeight: 600,
    title: 'Arkloop',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    frame: !isWindows,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 12, y: 12 },
    ...(process.platform === 'linux' || process.platform === 'win32' ? { icon: iconPath } : {}),
  })

  win.on('page-title-updated', (event) => {
    event.preventDefault()
    win.setTitle('Arkloop')
  })

  // 窗口大小变化时持久化
  win.on('resize', () => {
    if (win.isMaximized()) return
    const [width, height] = win.getSize()
    const cfg = loadConfig()
    cfg.window = { width, height }
    saveConfig(cfg)
  })

  win.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    if (loadConfig().desktop.closeBehavior === 'quit') {
      app.quit()
      return
    }
    win.hide()
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  const syncMaximizedState = () => {
    win.webContents.send('arkloop:window:maximized-changed', win.isMaximized())
  }
  win.on('maximize', syncMaximizedState)
  win.on('unmaximize', syncMaximizedState)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (parseHttpUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-frame-navigate', (event) => {
    const { url, isMainFrame } = event
    if (!parseHttpUrl(url)) return
    if (!isMainFrame) return
    if (isAppHttpNavigation(url)) return
    event.preventDefault()
    void shell.openExternal(url)
  })

  attachRendererContextMenu(win)

  return win
}

function loadContent(win: BrowserWindow): void {
  if (process.env.ELECTRON_DEV === 'true') {
    // 开发模式: 加载 Vite dev server
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173'
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else if (app.isPackaged) {
    // 生产打包模式
    const rendererPath = path.join(process.resourcesPath, 'renderer', 'index.html')
    win.loadFile(rendererPath)
  } else {
    // 开发模式但非 ELECTRON_DEV（直接 build 后测试）
    const webDist = path.resolve(__dirname, '..', '..', '..', 'web', 'dist', 'index.html')
    win.loadFile(webDist)
  }
}

let isQuitting = false
let shutdownInProgress = false
let powerSaveBlockerId: number | null = null
let keepAwakeSessionActive = false

function applyDesktopPreferences(config: AppConfig): void {
  try {
    app.setLoginItemSettings({ openAtLogin: config.desktop.launchAtLogin })
  } catch (error) {
    console.error('[desktop] login_item_update_failed', { error })
  }

  if (config.desktop.keepScreenAwake && keepAwakeSessionActive) {
    if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    }
    return
  }

  if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
    powerSaveBlocker.stop(powerSaveBlockerId)
  }
  powerSaveBlockerId = null
}

function setKeepAwakeSessionActive(active: boolean): void {
  keepAwakeSessionActive = active
  applyDesktopPreferences(loadConfig())
}

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(async () => {
    console.info('[desktop] app ready', {
      logDir: getDesktopLogDir(),
      packaged: app.isPackaged,
      version: app.getVersion(),
    })
    await installReactDevTools()
    if (process.platform === 'win32') {
      Menu.setApplicationMenu(null)
    }
    ensureDockPresence()
    initVersionsFile()
    await syncLocalVersions()
    applyAppIcon()

    setStatusListener((status) => {
      mainWindow?.webContents.send('arkloop:sidecar:status-changed', status)
    })
    setRuntimeListener((runtime) => {
      handleRuntimeUpdate(runtime)
    })
    setBridgeUrlListener((bridgeBaseUrl) => {
      syncBridgeBaseUrlToRenderer(bridgeBaseUrl)
    })

    registerIpcHandlers(getWindow, {
      applyConfigUpdate,
      restartLocalSidecar,
      getSidecarRuntime: async () => getSidecarRuntime(),
      setKeepAwakeSessionActive,
      ensureManagedAppStarted,
      getManagedAppState,
      restartManagedApp,
      showManagedAppInMainArea,
      hideManagedAppInMainArea,
      syncManagedAppMainAreaBounds,
    })
    try {
      await ensureBrowserSearchServer(getDesktopAccessToken())
    } catch (error) {
      console.error('[desktop] browser_search_server_start_failed', { error })
    }

    const config = loadConfig()
    applyDesktopPreferences(config)

    // 先创建窗口，让用户立即看到 LoadingPage
    mainWindow = createWindow()

    const pushEmbeddedStateToRendererOnce = (() => {
      let sent = false
      return (): void => {
        if (sent) return
        const win = mainWindow
        if (!win || win.isDestroyed()) return
        sent = true
        syncRuntimeToRenderer(getSidecarRuntime())
        syncConfigToRenderer(loadConfig())
        syncBridgeBaseUrlToRenderer(getBridgeBaseUrl())
      }
    })()
    mainWindow.webContents.once('dom-ready', pushEmbeddedStateToRendererOnce)
    mainWindow.webContents.once('did-finish-load', pushEmbeddedStateToRendererOnce)

    loadContent(mainWindow)

    // 窗口已显示，再启动 sidecar（可能阻塞 30s）
    if (config.mode === 'local') {
      try {
        await ensureLocalSidecar(config)
      } catch (error) {
        console.error('[desktop] failed to start local sidecar:', error)
        syncRuntimeToRenderer(getSidecarRuntime())
      }
    } else {
      activeSidecarPort = null
    }

    createTray(getWindow, showMainWindow)
    registerGlobalShortcut(getWindow, showMainWindow)
    setupAppUpdater(getWindow, { autoCheck: config.desktop.productUpdateNotifications })
  })

  app.on('window-all-closed', () => {
    // macOS: 保持运行直到用户显式退出
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    showMainWindow()
  })

  app.on('before-quit', (e) => {
    if (shutdownInProgress) return
    e.preventDefault()
    shutdownInProgress = true
    isQuitting = true
    void (async () => {
      destroyTray()
      try {
        const cfg = loadConfig()
        if (cfg.mode === 'local') {
          await stopBridgeOpenvikingIfNeeded(cfg.memory)
        }
        await stopAllManagedApps()
        await stopSidecar()
      } catch (err) {
        console.error('[desktop] shutdown error:', err)
      }
      app.quit()
    })()
  })

  app.on('will-quit', () => {
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId)
      powerSaveBlockerId = null
    }
    void closeBrowserSearchServer()
  })
}
