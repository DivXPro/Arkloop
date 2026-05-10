import type { ReactElement } from 'react'
import { useEffect } from 'react'

import { useBrowserTabs } from '../contexts/browser-tabs'
import type { PluginDefinition, PluginPresentation } from './types'
import { usePluginRuntime } from './runtime'

const PRESENTATION_LABELS: Record<PluginPresentation, string> = {
  route: 'Page',
  'embedded-browser': 'Browser',
  hybrid: 'Hybrid',
}

export function PluginWorkspaceShell({
  plugin,
  presentation,
}: {
  plugin: PluginDefinition
  presentation: PluginPresentation
}) {
  const { closeBrowserPanel } = useBrowserTabs()
  const { setPresentationForPlugin } = usePluginRuntime()

  useEffect(() => {
    if (presentation === 'route') {
      closeBrowserPanel()
    }
  }, [closeBrowserPanel, presentation])

  const Component = plugin.surfaces.mount
  const supportsPresentationSwitch =
    plugin.presentation.supported.length > 1

  const content: ReactElement | null = (
    <div className="min-h-0 flex-1 overflow-auto">
      {Component ? <Component /> : null}
    </div>
  )

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col"
      data-testid="plugin-workspace-shell"
    >
      <div
        className="flex h-10 shrink-0 items-center justify-between gap-3 px-3 text-xs font-medium text-(--c-text-primary)"
        data-testid="plugin-workspace-header"
        style={{ borderBottom: '0.5px solid var(--c-border-subtle)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 truncate">{plugin.title}</div>
        </div>
        <div className="flex items-center gap-2">
          {supportsPresentationSwitch ? (
            <div
              className="flex items-center gap-1 rounded-full p-0.5"
              style={{ backgroundColor: 'var(--c-bg-sub)' }}
            >
              {plugin.presentation.supported.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={mode === presentation}
                  className="rounded-full px-2 py-1 text-[11px] transition-colors"
                  data-testid={`plugin-presentation-button-${mode}`}
                  onClick={() => setPresentationForPlugin(plugin.id, mode)}
                  style={
                    mode === presentation
                      ? {
                          backgroundColor: 'var(--c-bg-page)',
                          color: 'var(--c-text-primary)',
                        }
                      : {
                          color: 'var(--c-text-secondary)',
                        }
                  }
                >
                  {PRESENTATION_LABELS[mode]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {content}
    </div>
  )
}
