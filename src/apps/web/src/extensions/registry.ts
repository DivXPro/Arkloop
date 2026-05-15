import { OpenDesignExtensionPage } from './builtin/OpenDesignExtensionPage'
import type { ExtensionDefinition } from './types'

export const builtinExtensions: ExtensionDefinition[] = [
  {
    id: 'open-design',
    title: 'Open Design',
    desktopOnly: true,
    nav: { section: 'workspace', order: 130 },
    shell: { mode: 'extension-main' },
    presentation: {
      default: 'route',
      supported: ['route'],
    },
    surfaces: {
      mount: OpenDesignExtensionPage,
    },
  },
]

export function listBuiltinExtensions(): ExtensionDefinition[] {
  return [...builtinExtensions].sort((left, right) => left.nav.order - right.nav.order)
}

export function getBuiltinExtensionById(extensionId: string): ExtensionDefinition | null {
  return builtinExtensions.find((extension) => extension.id === extensionId) ?? null
}
