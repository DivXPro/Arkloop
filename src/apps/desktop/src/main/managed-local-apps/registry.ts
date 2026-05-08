import * as path from 'path'
import * as os from 'os'

import type { AppConfig } from '../types'
import { buildOpenDesignSpec } from './apps/open-design'
import type { ManagedLocalAppId, ManagedLocalAppSpec } from './types'

export function getManagedLocalAppRuntimeRoot(
  homeDir: string,
  appId: ManagedLocalAppId,
): string {
  return path.join(homeDir, '.arkloop', 'integrations', appId)
}

export function getManagedLocalAppSpec(
  config: AppConfig,
  appId: ManagedLocalAppId,
): ManagedLocalAppSpec | null {
  if (appId !== 'open-design') return null

  const openDesign = config.integrations.openDesign
  if (!openDesign.enabled || !openDesign.projectPath) return null

  const runtimeRoot = getManagedLocalAppRuntimeRoot(os.homedir(), appId)
  return buildOpenDesignSpec({
    projectPath: openDesign.projectPath,
    runtimeRoot,
    preferredDaemonPort: openDesign.preferredDaemonPort ?? 17456,
    preferredWebPort: openDesign.preferredWebPort ?? 17573,
  })
}
