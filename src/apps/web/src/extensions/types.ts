export type ExtensionShellMode = 'extension-main' | 'extension-workspace'

export type ExtensionPresentation = 'route' | 'embedded-browser' | 'hybrid'

export type ExtensionBrowserLocation = {
  pathname: string
  search: string
  hash: string
}

export type ExtensionResolveBrowserUrlContext = {
  extensionId: string
  presentation: ExtensionPresentation
  location: ExtensionBrowserLocation
}

export type ExtensionDefinition = {
  id: string
  title: string
  desktopOnly?: boolean
  nav: {
    section: 'primary' | 'tools' | 'workspace'
    order: number
    icon?: string
  }
  shell: {
    mode: ExtensionShellMode
  }
  presentation: {
    default: ExtensionPresentation
    supported: ExtensionPresentation[]
  }
  surfaces: {
    mount?: React.ComponentType
    resolveBrowserUrl?: (context: ExtensionResolveBrowserUrlContext) => Promise<string> | string
    browserPlacement?: 'main' | 'sidecar'
  }
}
