import { useState } from 'react'
import type { ArtifactResource } from '@arkloop/shared'
import { getKindConfig } from '../lib/kindRegistry'
import { GenericCard, SocialCard, ProductCard } from './artifact-cards'

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
  const artifactKey = resource.descriptor?.key as string | undefined
  const viewerUrl = resource.descriptor?.viewerUrl as string | undefined
  const externalUrl = resource.descriptor?.url as string | undefined
  const iframeSrc = viewerUrl || (artifactKey ? `/v1/artifacts/${artifactKey}` : undefined)

  const showImagePreview = display === 'inline' && isObjectBlob && kindConfig.inlineMode === 'image' && !imageError
  const hasExternalViewer = !!viewerUrl || (isExternalUrl && !!externalUrl)
  const showIframePreview = display === 'inline' && (isObjectBlob || hasExternalViewer) && kindConfig.inlineMode === 'iframe'
  const isLinkMode = kindConfig.inlineMode === 'link'
  const isCardPreview = kindConfig.inlineMode === 'card-preview'
  const isSocialCard = kindConfig.inlineMode === 'social-card'
  const isProductCard = kindConfig.inlineMode === 'product-card'

  const handleOpenPanel = () => {
    // 如果存在外部链接，直接跳转而不是打开 Panel
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer')
      return
    }
    onClick?.(resource.id)
  }

  // 阻止预览区域的点击冒泡到 panel 打开
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className="inline-artifact"
      data-kind={resource.kind}
      data-testid={`inline-artifact-${resource.id}`}
      data-inline-mode={kindConfig.inlineMode}
      style={{
        border: '1px solid var(--c-border)',
        borderRadius: '8px',
        padding: '12px',
        margin: '8px 0',
        background: 'var(--c-bg-sub)',
        transition: 'background 0.15s ease',
        ...(isLinkMode && {
          padding: '10px 12px',
          borderStyle: 'dashed',
        }),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--c-bg-input)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--c-bg-sub)'
      }}
    >
      {/* 标题行：可点击打开 Panel 或外部链接 */}
      <div
        className="artifact-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: onClick || externalUrl ? 'pointer' : 'default',
        }}
        onClick={handleOpenPanel}
      >
        <span className="artifact-icon" style={{ fontSize: '20px', lineHeight: 1 }}>
          {kindIcon(resource.kind)}
        </span>
        <span
          className="artifact-title"
          style={{
            flex: 1,
            fontWeight: isLinkMode || externalUrl ? 400 : 500,
            color: isLinkMode || externalUrl ? 'var(--c-link)' : 'var(--c-text-primary)',
            fontSize: '14px',
            textDecoration: isLinkMode || externalUrl ? 'underline' : 'none',
            textUnderlineOffset: '2px',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayTitle}
        </span>
        {(isLinkMode && isExternalUrl || externalUrl) && (
          <span style={{ fontSize: '13px', color: 'var(--c-text-muted)', flexShrink: 0 }}>↗</span>
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
            flexShrink: 0,
          }}
        >
          {resource.kind}
        </span>
        {/* 打开 Panel 按钮 */}
        {onClick && (
          <span
            className="artifact-open-panel"
            title="在 Panel 中打开"
            style={{
              fontSize: '13px',
              color: 'var(--c-text-muted)',
              padding: '2px 6px',
              borderRadius: '4px',
              flexShrink: 0,
              opacity: 0.7,
              transition: 'opacity 0.15s ease, background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.background = 'var(--c-bg-deep)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            ⤢
          </span>
        )}
      </div>

      {/* 预览区域：点击不触发 Panel 打开 */}
      {showImagePreview && (
        <div className="artifact-preview" style={{ marginTop: '8px' }} onClick={stopPropagation}>
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
        <div className="artifact-preview" style={{ marginTop: '8px' }} onClick={stopPropagation}>
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

      {/* 卡片模板分发 */}
      {isSocialCard && display === 'inline' && (
        <SocialCard descriptor={resource.descriptor} summary={resource.summary} onClick={stopPropagation} />
      )}
      {isProductCard && display === 'inline' && (
        <ProductCard descriptor={resource.descriptor} summary={resource.summary} onClick={stopPropagation} />
      )}
      {isCardPreview && display === 'inline' && (
        <GenericCard descriptor={resource.descriptor} summary={resource.summary} onClick={stopPropagation} />
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
  if (kind.startsWith('social.')) return '💬'
  if (kind.startsWith('ecommerce.')) return '🛒'
  return '📦'
}
