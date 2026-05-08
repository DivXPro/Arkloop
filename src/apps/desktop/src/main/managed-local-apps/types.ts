export type ManagedLocalAppId = string

export type ManagedLocalAppStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'degraded'
  | 'failed'

export type ManagedLocalAppMountTarget = 'main-workspace'

export type ManagedLocalAppProcessId = 'daemon' | 'web'

export type ManagedLocalAppLauncherProcess = {
  id: ManagedLocalAppProcessId
  command: string
  args: string[]
  cwd: 'projectPath'
  env: Record<string, string>
  preferredPort?: number
}

export type ManagedLocalAppLauncherHealthCheck = {
  processId: ManagedLocalAppProcessId
  path: string
}

export type ManagedLocalAppLauncherSpec = {
  id: string
  localConfigKey: 'projectPath'
  mountTarget: ManagedLocalAppMountTarget
  runtimeRootTemplate: string
  processes: ManagedLocalAppLauncherProcess[]
  healthChecks: ManagedLocalAppLauncherHealthCheck[]
}

export type ManagedLocalAppEnsureRequest = {
  pluginId: string
  launcher: ManagedLocalAppLauncherSpec
  localConfig: Record<string, string | undefined>
}

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
  healthPath?: string
}

export type ManagedLocalAppSpec = {
  id: ManagedLocalAppId
  title: string
  presentation: 'page'
  mountTarget: ManagedLocalAppMountTarget
  runtimeRoot: string
  processes: ManagedLocalAppProcessSpec[]
}
