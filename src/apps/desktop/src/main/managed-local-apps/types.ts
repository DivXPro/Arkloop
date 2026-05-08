export type ManagedLocalAppId = 'open-design'

export type ManagedLocalAppStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'degraded'
  | 'failed'

export type ManagedLocalAppMountTarget = 'main-workspace'

export type ManagedLocalAppProcessId = 'daemon' | 'web'

export type ManagedLocalAppBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type ManagedLocalAppProcessSpec = {
  id: ManagedLocalAppProcessId
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
  preferredPort?: number
}

export type ManagedLocalAppSpec = {
  id: ManagedLocalAppId
  title: string
  presentation: 'page'
  mountTarget: ManagedLocalAppMountTarget
  runtimeRoot: string
  processes: ManagedLocalAppProcessSpec[]
}
