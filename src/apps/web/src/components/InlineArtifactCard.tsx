import { useState } from 'react'
import type { ArtifactResource } from '@arkloop/shared'

type Props = {
  resource: ArtifactResource
  title?: string
  onClick?: (id: string) => void
}

export function InlineArtifactCard({ resource, title, onClick }: Props) {
  const [imageError, setImageError] = useState(false)

  const displayTitle = title || resource.title || 'Untitled'
  const isObjectBlob = resource.fetchMode === 'object-blob'
  const isImageKind = resource.kind.startsWith('image.')
  const showPreview = isObjectBlob && isImageKind && !imageError

  return (
    <div
      className="inline-artifact"
      data-kind={resource.kind}
      data-testid={`inline-artifact-${resource.id}`}
      style={{
        border: '1px solid var(--c-border)',
        borderRadius: '8px',
        padding: '12px',
        margin: '8px 0',
        cursor: onClick ? 'pointer' : 'default',
        background: 'var(--c-bg-sub)',
        transition: 'background 0.15s ease',
      }}
      onClick={() => onClick?.(resource.id)}
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
            fontWeight: 500,
            color: 'var(--c-text-primary)',
            fontSize: '14px',
          }}
        >
          {displayTitle}
        </span>
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

      {showPreview && (
        <div className="artifact-preview" style={{ marginTop: '8px' }}>
          <img
            src={`/v1/artifacts/${resource.descriptor.key as string}/preview`}
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
