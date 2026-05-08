export type PluginLauncherProcessId = 'daemon' | 'web'

export type PluginLauncherProcess = {
  id: PluginLauncherProcessId
  command: string
  args: string[]
  cwd: 'projectPath'
  env: Record<string, string>
  preferredPort?: number
}

export type PluginLauncherHealthCheck = {
  processId: PluginLauncherProcessId
  path: string
}

export type PluginLauncherSpec = {
  id: string
  localConfigKey: 'projectPath'
  mountTarget: 'main-workspace'
  runtimeRootTemplate: '.arkloop/integrations/{pluginId}'
  processes: PluginLauncherProcess[]
  healthChecks: PluginLauncherHealthCheck[]
}
