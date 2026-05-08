import * as path from 'path'

import type { ManagedLocalAppSpec } from '../types'

export function buildOpenDesignSpec(input: {
  projectPath: string
  runtimeRoot: string
  preferredDaemonPort: number
  preferredWebPort: number
}): ManagedLocalAppSpec {
  const dataDir = path.join(input.runtimeRoot, 'data')
  const daemonUrl = `http://127.0.0.1:${input.preferredDaemonPort}`

  return {
    id: 'open-design',
    title: 'Open Design',
    presentation: 'page',
    mountTarget: 'main-workspace',
    runtimeRoot: input.runtimeRoot,
    processes: [
      {
        id: 'daemon',
        command: 'node',
        args: [
          'apps/daemon/dist/cli.js',
          '--port',
          String(input.preferredDaemonPort),
          '--host',
          '127.0.0.1',
          '--no-open',
        ],
        cwd: input.projectPath,
        env: {
          OD_PORT: String(input.preferredDaemonPort),
          OD_DATA_DIR: dataDir,
        },
        preferredPort: input.preferredDaemonPort,
      },
      {
        id: 'web',
        command: 'pnpm',
        args: [
          '--filter',
          '@open-design/web',
          'dev',
          '--',
          '--hostname',
          '127.0.0.1',
          '--port',
          String(input.preferredWebPort),
        ],
        cwd: input.projectPath,
        env: {
          OD_DAEMON_URL: daemonUrl,
          PORT: String(input.preferredWebPort),
        },
        preferredPort: input.preferredWebPort,
      },
    ],
  }
}
