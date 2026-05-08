import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveManagedLocalAppSpec } from './registry'

describe('resolveManagedLocalAppSpec', () => {
  it('resolves a launcher-backed spec using plugin local config', () => {
    const spec = resolveManagedLocalAppSpec({
      homeDir: '/Users/huhui',
      pluginId: 'open-design',
      launcher: {
        id: 'open-design',
        localConfigKey: 'projectPath',
        mountTarget: 'main-workspace',
        runtimeRootTemplate: '.arkloop/integrations/{pluginId}',
        processes: [
          {
            id: 'daemon',
            command: 'pnpm',
            args: ['tools-dev', 'run', 'web', '--daemon-port', '{port:daemon}', '--web-port', '{port:web}'],
            cwd: 'projectPath',
            env: {
              OD_PORT: '{port:daemon}',
              OD_DATA_DIR: '{runtimeRoot}/data',
            },
            preferredPort: 17456,
            launchMode: 'health-only',
          },
        ],
        healthChecks: [{ processId: 'daemon', path: '/api/projects' }],
      },
      localConfig: {
        projectPath: '/Users/huhui/Projects/open-design',
      },
    })

    expect(spec?.runtimeRoot).toBe(path.join('/Users/huhui', '.arkloop', 'integrations', 'open-design'))
    expect(spec?.processes[0]?.cwd).toBe('/Users/huhui/Projects/open-design')
    expect(spec?.processes[0]?.args).toContain('17456')
    expect(spec?.processes[0]?.env.OD_DATA_DIR).toBe('/Users/huhui/.arkloop/integrations/open-design/data')
    expect(spec?.processes[0]?.launchMode).toBe('health-only')
  })
})
