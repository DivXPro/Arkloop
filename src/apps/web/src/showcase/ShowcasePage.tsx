import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, LayoutGrid } from 'lucide-react'
import { useLocale } from '../contexts/LocaleContext'
import { useShowcases } from './data'
import { ShowcaseGrid } from './ShowcaseGrid'

export function ShowcasePage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { items, loading, error } = useShowcases()

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="flex h-full flex-col bg-[var(--c-bg-page)]">
      {/* Header */}
      <div className="flex min-h-[51px] shrink-0 items-center justify-between border-b border-[var(--c-border-subtle)] px-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-bg-deep)] hover:text-[var(--c-text-primary)]"
        >
          <ArrowLeft size={16} />
          <span>{t.showcaseBack}</span>
        </button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-[15px] font-medium text-[var(--c-text-primary)]">
          {t.showcaseTitle}
        </h1>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-bg-deep)] hover:text-[var(--c-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
          <span>{t.showcaseRefresh}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-5">
        {loading && items.length === 0 && (
          <div className="flex h-40 items-center justify-center text-[14px] text-[var(--c-text-secondary)]">
            {t.loading}
          </div>
        )}

        {items.length > 0 ? (
          <ShowcaseGrid items={items} />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <LayoutGrid size={40} className="text-[var(--c-text-tertiary)]" />
            <p className="text-[15px] font-medium text-[var(--c-text-secondary)]">{t.showcaseEmptyTitle}</p>
            <p className="text-[13px] text-[var(--c-text-tertiary)]">{t.showcaseEmptyDesc}</p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-[var(--c-status-error)]/20 bg-[var(--c-status-error)]/5 px-4 py-2.5 text-[13px] text-[var(--c-status-error)]">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
