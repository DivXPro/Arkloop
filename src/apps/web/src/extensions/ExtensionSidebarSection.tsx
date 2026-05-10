import { isDesktop } from '@arkloop/shared/desktop'

import { listBuiltinExtensions } from './registry'
import { useExtensionRuntime } from './extension-runtime'

export function ExtensionSidebarSection() {
  const { activeExtensionId, openExtension } = useExtensionRuntime()
  const desktop = isDesktop()
  const extensions = listBuiltinExtensions().filter(
    (extension) => !(extension.desktopOnly && !desktop),
  )

  if (extensions.length === 0) return null

  return (
    <section aria-label="Extensions" className="mb-3">
      <div className="mb-[12px] mt-1 flex shrink-0 items-center gap-2 px-2">
        <h3
          className="text-(--c-text-tertiary) text-[11px] tracking-[0.3px]"
          style={{ fontWeight: 'var(--c-sidebar-section-weight)' }}
        >
          Extensions
        </h3>
      </div>
      <div className="flex flex-col gap-[2px]">
        {extensions.map((extension) => {
          const active = activeExtensionId === extension.id
          return (
            <button
              key={extension.id}
              type="button"
              data-testid={`extension-entry-${extension.id}`}
              onClick={() => void openExtension(extension.id)}
              className="text-(--c-text-primary) flex h-[34px] w-full items-center rounded-[6px] px-3 text-left text-[13.5px] leading-[20px]"
              style={{
                background: active ? 'var(--c-bg-deep)' : 'transparent',
                fontWeight: 'var(--c-sidebar-thread-weight)',
              }}
            >
              {extension.title}
            </button>
          )
        })}
      </div>
    </section>
  )
}
