import { Navigate, useParams } from 'react-router-dom'

import { getBuiltinExtensionById } from './registry'
import { useExtensionRuntime } from './extension-runtime'
import { ExtensionWorkspaceShell } from './ExtensionWorkspaceShell'

export function ExtensionHostPage() {
  const { extensionId = '' } = useParams()
  const extension = getBuiltinExtensionById(extensionId)
  const { getPresentationForExtension } = useExtensionRuntime()

  if (!extension) {
    return <Navigate to="/" replace />
  }

  const presentation = getPresentationForExtension(extension.id) ?? extension.presentation.default

  if (extension.shell.mode === 'extension-workspace') {
    return <ExtensionWorkspaceShell extension={extension} presentation={presentation} />
  }

  if (presentation === 'route' && extension.surfaces.mount) {
    const Component = extension.surfaces.mount
    return <Component />
  }

  if (presentation === 'embedded-browser' || presentation === 'hybrid') {
    return <ExtensionWorkspaceShell extension={extension} presentation={presentation} />
  }

  return (
    <div data-testid="extension-host-placeholder">
      extension host placeholder for {extension.id} ({presentation})
    </div>
  )
}
