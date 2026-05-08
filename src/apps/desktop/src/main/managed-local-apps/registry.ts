import * as path from 'path'

import { app } from 'electron'

import type { AppConfig } from '../types'
import { buildOpenDesignSpec } from './apps/open-design'
import type { ManagedLocalAppId, ManagedLocalAppSpec } from './types'

export function getManagedLocalAppSpec(
  config: AppConfig,
  appId: ManagedLocalAppId,
): ManagedLocalAppSpec | null {
  if (appId !== 'open-design') return null

  const openDesign = config.integrations.openDesign
  if (!openDesign.enabled || !openDesign.projectPath) return null

  const runtimeRoot = path.join(app.getPath('userData'), 'integrations', 'open-design')
  return buildOpenDesignSpec({
    projectPath: openDesign.projectPath,
    runtimeRoot,
    preferredDaemonPort: openDesign.preferredDaemonPort ?? 17456,
    preferredWebPort: openDesign.preferredWebPort ?? 17573,
  })
}
