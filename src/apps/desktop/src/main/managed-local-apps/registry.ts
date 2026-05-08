import path from 'node:path'

import type { ManagedLocalAppEnsureRequest, ManagedLocalAppLauncherSpec, ManagedLocalAppSpec } from './types'

function resolveRuntimeRoot(homeDir: string, pluginId: string, launcher: ManagedLocalAppLauncherSpec): string {
  const relativeRoot = launcher.runtimeRootTemplate.replaceAll('{pluginId}', pluginId)
  return path.join(homeDir, ...relativeRoot.split('/').filter(Boolean))
}

function buildReplacementContext(input: {
  pluginId: string
  runtimeRoot: string
  daemonPort: number
  webPort: number
}) {
  return {
    '{pluginId}': input.pluginId,
    '{runtimeRoot}': input.runtimeRoot,
    '{port:daemon}': String(input.daemonPort),
    '{port:web}': String(input.webPort),
  }
}

function interpolateTemplate(value: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (result, [token, replacement]) => result.replaceAll(token, replacement),
    value,
  )
}

export function resolveManagedLocalAppSpec(input: {
  homeDir: string
  pluginId: ManagedLocalAppEnsureRequest['pluginId']
  launcher: ManagedLocalAppEnsureRequest['launcher']
  localConfig: ManagedLocalAppEnsureRequest['localConfig']
}): ManagedLocalAppSpec | null {
  const projectPath = input.localConfig[input.launcher.localConfigKey]
  if (!projectPath) return null

  const runtimeRoot = resolveRuntimeRoot(input.homeDir, input.pluginId, input.launcher)
  const daemonPort = input.launcher.processes.find((process) => process.id === 'daemon')?.preferredPort ?? 17456
  const webPort = input.launcher.processes.find((process) => process.id === 'web')?.preferredPort ?? 17573
  const replacements = buildReplacementContext({
    pluginId: input.pluginId,
    runtimeRoot,
    daemonPort,
    webPort,
  })
  const healthPaths = new Map(
    input.launcher.healthChecks.map((check) => [check.processId, check.path]),
  )

  return {
    id: input.pluginId,
    title: input.launcher.id,
    presentation: 'page',
    mountTarget: input.launcher.mountTarget,
    runtimeRoot,
    processes: input.launcher.processes.map((process) => ({
      id: process.id,
      command: process.command,
      args: process.args.map((value) => interpolateTemplate(value, replacements)),
      cwd: projectPath,
      env: Object.fromEntries(
        Object.entries(process.env).map(([key, value]) => [
          key,
          interpolateTemplate(value, replacements),
        ]),
      ),
      preferredPort: process.preferredPort,
      healthPath: healthPaths.get(process.id),
    })),
  }
}
