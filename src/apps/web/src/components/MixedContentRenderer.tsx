import { memo } from 'react'
import type { ArtifactResource } from '@arkloop/shared'
import { parseMixedContent } from '../lib/parseMixedContent'
import { MarkdownRenderer } from './MarkdownRenderer'
import { InlineArtifactCard } from './InlineArtifactCard'
import type { ComponentProps } from 'react'

type MarkdownProps = ComponentProps<typeof MarkdownRenderer>

type Props = {
  content: string
  artifacts?: ArtifactResource[]
  onOpenArtifact?: (id: string) => void
} & Omit<MarkdownProps, 'content'>

export const MixedContentRenderer = memo(function MixedContentRenderer({
  content,
  artifacts,
  onOpenArtifact,
  ...markdownProps
}: Props) {
  const segments = parseMixedContent(content)

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <MarkdownRenderer key={`text-${index}`} content={segment.text} {...markdownProps} />
        }

        const resource = artifacts?.find((a) => a.id === segment.id)

        if (resource) {
          return (
            <InlineArtifactCard
              key={`artifact-${segment.id}`}
              resource={resource}
              title={segment.title}
              onClick={onOpenArtifact}
            />
          )
        }

        return (
          <div
            key={`broken-${segment.id}`}
            className="artifact-broken"
            style={{
              padding: '12px',
              border: '1px dashed var(--c-status-error)',
              borderRadius: '8px',
              color: 'var(--c-status-error)',
              margin: '8px 0',
              fontSize: '13px',
            }}
          >
            产物引用失效: {segment.id}
          </div>
        )
      })}
    </>
  )
})
