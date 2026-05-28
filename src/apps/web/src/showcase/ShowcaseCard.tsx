import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '../contexts/LocaleContext'
import { useSkillPromptUI } from '../contexts/app-ui'
import type { ShowcaseItem } from './types'

interface Props {
  item: ShowcaseItem
}

export const ShowcaseCard = memo(function ShowcaseCard({ item }: Props) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { queueSkillPrompt } = useSkillPromptUI()

  const handleTryIt = () => {
    queueSkillPrompt(item.prompt)
    navigate('/')
  }

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      style={{
        background: 'var(--c-bg-sub)',
        border: '0.5px solid var(--c-border-subtle)',
        minHeight: 220,
      }}
    >
      {/* Background image */}
      <div className="relative flex-1 overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ minHeight: 140 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        {/* Gradient overlay for text readability */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '70%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
          }}
        />
        {/* Text content over image */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-[16px] font-medium text-white">{item.title}</h3>
          <p className="mt-1 text-[13px] text-white/80 line-clamp-2">{item.description}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 p-3" style={{ background: 'var(--c-bg-sub)' }}>
        <button
          type="button"
          disabled
          className="flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: 'var(--c-bg-deep)',
            color: 'var(--c-text-secondary)',
          }}
        >
          {t.showcaseReplay}
        </button>
        <button
          type="button"
          onClick={handleTryIt}
          className="flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors hover:opacity-90 active:scale-[0.97]"
          style={{
            background: 'var(--c-accent-send)',
            color: 'var(--c-accent-send-text)',
          }}
        >
          {t.showcaseTryIt}
        </button>
      </div>
    </div>
  )
})
