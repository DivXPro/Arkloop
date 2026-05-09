export type ManagedAppId = 'open-design'

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
