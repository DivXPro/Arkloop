import { isDesktop } from '@arkloop/shared/desktop'

import { listBuiltinPlugins } from './registry'
import { usePluginRuntime } from './runtime'

export function PluginSidebarSection() {
  const { activePluginId, openPlugin } = usePluginRuntime()
  const desktop = isDesktop()
  const plugins = listBuiltinPlugins().filter(
    (plugin) =>
      !(plugin.desktopOnly && !desktop) &&
      (plugin.presentation.default === 'route' || plugin.presentation.default === 'page-external'),
  )

  if (plugins.length === 0) return null

  return (
    <div className="mb-[12px] flex flex-col gap-[2px]">
      {plugins.map((plugin) => {
        const active = activePluginId === plugin.id
        return (
          <button
            key={plugin.id}
            type="button"
            data-testid={`plugin-entry-${plugin.id}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => void openPlugin(plugin.id)}
            className="flex h-[34px] w-full items-center rounded-[6px] px-3 text-left text-[13.5px] leading-[20px] text-(--c-text-secondary) transition-colors duration-60 hover:bg-(--c-bg-deep) hover:text-(--c-text-primary)"
            style={{
              background: active ? 'var(--c-bg-deep)' : 'transparent',
              color: active ? 'var(--c-text-primary)' : undefined,
              fontWeight: 'var(--c-sidebar-thread-weight)',
            }}
          >
            {plugin.title}
          </button>
        )
      })}
    </div>
  )
}
