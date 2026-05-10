import { useState } from 'react'
import type { ArtifactResource } from '@arkloop/shared'
import { getKindConfig } from '../lib/kindRegistry'

type Props = {
  resource: ArtifactResource
  title?: string
  onClick?: (id: string) => void
  accessToken?: string
}

export function InlineArtifactCard({ resource, title, onClick, accessToken }: Props) {
  const [imageError, setImageError] = useState(false)

  const displayTitle = title || resource.title || 'Untitled'
  const isObjectBlob = resource.fetchMode === 'object-blob'
  const isExternalUrl = resource.fetchMode === 'external-url'
  const kindConfig = getKindConfig(resource.kind)
  // display 由 artifact 数据定义（'inline' | 'panel'），缺省为 'inline'
  const display = resource.display || 'inline'
  // panel 模式下只展示紧凑卡片，不展开 inline 预览
  const showImagePreview = display === 'inline' && isObjectBlob && kindConfig.inlineMode === 'image' && !imageError
  const showIframePreview = display === 'inline' && isObjectBlob && kindConfig.inlineMode === 'iframe'
  const isLinkMode = kindConfig.inlineMode === 'link'

  const artifactKey = resource.descriptor?.key as string | undefined
  const iframeSrc = artifactKey ? `/v1/artifacts/${artifactKey}` : undefined

  const handleClick = () => {
    onClick?.(resource.id)
  }

  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--c-border)',
    borderRadius: '8px',
    padding: '12px',
    margin: '8px 0',
    cursor: onClick ? 'pointer' : 'default',
    background: 'var(--c-bg-sub)',
    transition: 'background 0.15s ease',
    ...(isLinkMode && {
      padding: '10px 12px',
      borderStyle: 'dashed',
    }),
  }

  return (
    <div
      className="inline-artifact"
      data-kind={resource.kind}
      data-testid={`inline-artifact-${resource.id}`}
      data-inline-mode={kindConfig.inlineMode}
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--c-bg-input)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--c-bg-sub)'
      }}
    >
      <div
        className="artifact-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span className="artifact-icon" style={{ fontSize: '20px', lineHeight: 1 }}>
          {kindIcon(resource.kind)}
        </span>
        <span
          className="artifact-title"
          style={{
            flex: 1,
            fontWeight: isLinkMode ? 400 : 500,
            color: isLinkMode ? 'var(--c-link)' : 'var(--c-text-primary)',
            fontSize: '14px',
            textDecoration: isLinkMode ? 'underline' : 'none',
            textUnderlineOffset: '2px',
          }}
        >
          {displayTitle}
        </span>
        {isLinkMode && isExternalUrl && (
          <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>↗</span>
        )}
        <span
          className="artifact-kind"
          style={{
            fontSize: '11px',
            color: 'var(--c-text-muted)',
            padding: '2px 8px',
            background: 'var(--c-bg-deep)',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        >
          {resource.kind}
        </span>
      </div>

      {showImagePreview && (
        <div className="artifact-preview" style={{ marginTop: '8px' }}>
          <img
            src={`/v1/artifacts/${artifactKey}`}
            alt={displayTitle}
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '4px',
              objectFit: 'cover',
              display: 'block',
            }}
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {showIframePreview && iframeSrc && (
        <div className="artifact-preview" style={{ marginTop: '8px' }}>
          <iframe
            src={iframeSrc}
            title={displayTitle}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            style={{
              width: '100%',
              height: '300px',
              border: '1px solid var(--c-border)',
              borderRadius: '4px',
              background: 'var(--c-bg-page)',
              display: 'block',
            }}
          />
        </div>
      )}
    </div>
  )
}

function kindIcon(kind: string): string {
  if (kind.startsWith('image.')) return '🖼️'
  if (kind.startsWith('design.')) return '🎨'
  if (kind.startsWith('document.')) return '📄'
  if (kind.startsWith('code.')) return '💻'
  if (kind.startsWith('data.')) return '📊'
  return '📦'
}
