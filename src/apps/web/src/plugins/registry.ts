import {
  SampleHybridPluginPage,
  SamplePagePluginPage,
} from './builtin/SamplePluginPage'
import type { PluginLauncherSpec } from '@arkloop/shared/plugin-launchers'
import type { PluginDefinition } from './types'

const openDesignLauncher: PluginLauncherSpec = {
  id: 'open-design',
  localConfigKey: 'projectPath',
  mountTarget: 'main-workspace',
  runtimeRootTemplate: '.arkloop/integrations/{pluginId}',
  processes: [
    {
      id: 'daemon',
      command: 'pnpm',
      args: [
        'tools-dev',
        'run',
        'web',
        '--daemon-port',
        '{port:daemon}',
        '--web-port',
        '{port:web}',
      ],
      cwd: 'projectPath',
      env: {
        OD_PORT: '{port:daemon}',
        OD_DATA_DIR: '{runtimeRoot}/data',
      },
      preferredPort: 17456,
      launchMode: 'health-only',
    },
    {
      id: 'web',
      command: 'pnpm',
      args: [
        'tools-dev',
        'run',
        'web',
        '--daemon-port',
        '{port:daemon}',
        '--web-port',
        '{port:web}',
      ],
      cwd: 'projectPath',
      env: {
        OD_PORT: '{port:daemon}',
        OD_DATA_DIR: '{runtimeRoot}/data',
        PORT: '{port:web}',
      },
      preferredPort: 17573,
    },
  ],
  healthChecks: [
    { processId: 'daemon', path: '/api/projects' },
    { processId: 'web', path: '/' },
  ],
}

export const builtinPlugins: PluginDefinition[] = [
  {
    id: 'open-design',
    title: 'Open Design',
    desktopOnly: true,
    nav: { section: 'workspace', order: 130 },
    shell: { mode: 'plugin-main' },
    presentation: {
      default: 'page-external',
      supported: ['page-external'],
    },
    surfaces: {
      managedApp: {
        managedAppId: 'open-design',
        mountTarget: 'main-workspace',
      },
    },
    launcher: openDesignLauncher,
  },
]

const internalBuiltinPlugins: PluginDefinition[] = [
  {
    id: 'sample-page-plugin',
    title: 'Sample Page Plugin',
    desktopOnly: true,
    nav: { section: 'workspace', order: 100 },
    shell: { mode: 'plugin-main' },
    presentation: {
      default: 'route',
      supported: ['route'],
    },
    surfaces: {
      mount: SamplePagePluginPage,
    },
  },
  {
    id: 'sample-browser-plugin',
    title: 'Sample Browser Plugin',
    desktopOnly: true,
    nav: { section: 'workspace', order: 110 },
    shell: { mode: 'plugin-workspace' },
    presentation: {
      default: 'embedded-browser',
      supported: ['embedded-browser'],
    },
    surfaces: {
      resolveBrowserUrl: ({ location }) => {
        const target = new URLSearchParams(location.search).get('target')?.trim()
        return target || 'https://example.com/'
      },
      browserPlacement: 'sidecar',
    },
  },
  {
    id: 'sample-hybrid-plugin',
    title: 'Sample Hybrid Plugin',
    desktopOnly: true,
    nav: { section: 'workspace', order: 120 },
    shell: { mode: 'plugin-workspace' },
    presentation: {
      default: 'hybrid',
      supported: ['hybrid'],
    },
    surfaces: {
      mount: SampleHybridPluginPage,
      resolveBrowserUrl: ({ location }) => {
        const target = new URLSearchParams(location.search).get('target')?.trim()
        return target || 'https://example.com/'
      },
      browserPlacement: 'sidecar',
    },
  },
]

const allBuiltinPlugins: PluginDefinition[] = [...builtinPlugins, ...internalBuiltinPlugins]

export function listBuiltinPlugins(): PluginDefinition[] {
  return [...builtinPlugins].sort((left, right) => left.nav.order - right.nav.order)
}

export function getBuiltinPluginById(pluginId: string): PluginDefinition | null {
  return allBuiltinPlugins.find((plugin) => plugin.id === pluginId) ?? null
}
