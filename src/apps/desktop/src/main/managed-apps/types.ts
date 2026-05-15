export type ManagedAppId = string

export type ManagedAppStatus = 'stopped' | 'starting' | 'running' | 'failed'

export type ManagedAppState = {
  appId: ManagedAppId
  status: ManagedAppStatus
  pid: number | null
  webUrl: string | null
  lastError: string | null
  startedAt: string | null
}

export type OpenDesignInstallPaths = {
  runtimeRoot: string
  bundleRoot: string
  resourcesRoot: string
  dataRoot: string
  nodeBinary: string
  entryScript: string
  readyFile: string
}

export type ManagedAppMainAreaBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type ManagedAppSpawnArgs = {
  command: string
  args: string[]
  cwd: string
}

export type ManagedAppLaunchConfig<TPaths = unknown> = {
  getInstallPaths: () => TPaths
  validateInstall: (paths: TPaths) => void
  buildSpawnArgs: (paths: TPaths) => ManagedAppSpawnArgs
  buildEnv: (paths: TPaths) => Record<string, string>
  getReadyFilePath: (paths: TPaths) => string
  readReadyFile: (raw: string) => { webUrl: string }
  readyTimeoutMs: number
  readyPollMs: number
}
