import path from 'node:path'

import type { ManagedAppLaunchConfig, OpenDesignInstallPaths } from './types'
import {
  getOpenDesignInstallPaths,
  readOpenDesignReadyFile,
  validateOpenDesignInstall,
} from './open-design'

export const managedAppRegistry: Record<string, ManagedAppLaunchConfig> = {
  'open-design': {
    getInstallPaths: getOpenDesignInstallPaths,
    validateInstall: (paths) => validateOpenDesignInstall(paths as OpenDesignInstallPaths),
    buildSpawnArgs: (paths) => {
      const p = paths as OpenDesignInstallPaths
      return {
        command: p.nodeBinary,
        args: [p.entryScript],
        cwd: p.runtimeRoot,
      }
    },
    buildEnv: (paths) => {
      const p = paths as OpenDesignInstallPaths
      return {
        OD_NAMESPACE: 'default',
        OD_DATA_DIR: p.dataRoot,
        OD_RESOURCE_ROOT: path.join(p.resourcesRoot, 'open-design'),
        OD_DAEMON_CLI_ENTRY: path.join(
          p.bundleRoot,
          'prebundled',
          'daemon',
          'daemon-cli.mjs',
        ),
        OD_DAEMON_SIDECAR_ENTRY: path.join(
          p.bundleRoot,
          'prebundled',
          'daemon',
          'daemon-sidecar.mjs',
        ),
        OD_WEB_SIDECAR_ENTRY: path.join(
          p.bundleRoot,
          'prebundled',
          'web-sidecar.mjs',
        ),
        OD_WEB_OUTPUT_MODE: 'standalone',
        OD_WEB_STANDALONE_ROOT: path.join(
          p.resourcesRoot,
          'open-design-web-standalone',
          'apps',
          'web',
        ),
      }
    },
    getReadyFilePath: (paths) => (paths as OpenDesignInstallPaths).readyFile,
    readReadyFile: readOpenDesignReadyFile,
    readyTimeoutMs: 30000,
    readyPollMs: 500,
  },
}
