import { OpenDesignPluginPage } from './builtin/OpenDesignPluginPage'
import type { PluginDefinition } from './types'

export const builtinPlugins: PluginDefinition[] = [
  {
    id: 'open-design',
    title: 'Open Design',
    desktopOnly: true,
    nav: { section: 'workspace', order: 130 },
    shell: { mode: 'plugin-main' },
    presentation: {
      default: 'route',
      supported: ['route'],
    },
    surfaces: {
      mount: OpenDesignPluginPage,
    },
  },
]

export function listBuiltinPlugins(): PluginDefinition[] {
  return [...builtinPlugins].sort((left, right) => left.nav.order - right.nav.order)
}

export function getBuiltinPluginById(pluginId: string): PluginDefinition | null {
  return builtinPlugins.find((plugin) => plugin.id === pluginId) ?? null
}
