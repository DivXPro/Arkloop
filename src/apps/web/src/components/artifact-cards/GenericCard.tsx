/**
 * 通用卡片预览。
 * 不假设具体业务类型，基于 descriptor 字段存在性自适应渲染。
 */
export function GenericCard({
  descriptor,
  summary,
  onClick,
}: {
  descriptor: Record<string, unknown>
  summary?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const imageUrl =
    (descriptor.image as string) ||
    (descriptor.cover as string) ||
    (descriptor.thumbnail as string) ||
    (descriptor.media as string)

  const platform = (descriptor.platform as string) || (descriptor.source as string)
  const publishedAt = (descriptor.publishedAt as string) || (descriptor.date as string)

  const author = descriptor.author
  const authorName = typeof author === 'string' ? author : (author as Record<string, unknown>)?.name as string | undefined
  const authorAvatar = typeof author === 'object' && author !== null ? (author as Record<string, unknown>)?.avatar as string | undefined : undefined

  const metricsLabel = descriptor.metricsLabel as string | undefined
  const metricsObj = (descriptor.metrics as Record<string, unknown>) ||
    (descriptor.engagement as Record<string, unknown>) ||
    (descriptor.stats as Record<string, unknown>)

  const price = descriptor.price as string | number | undefined
  const rating = descriptor.rating as number | undefined
  const tags = Array.isArray(descriptor.tags) ? descriptor.tags as string[] : undefined

  const hasMetricsObj = metricsObj && Object.keys(metricsObj).length > 0
  const hasFooter = authorName || metricsLabel || hasMetricsObj || price !== undefined || rating !== undefined
  const hasMeta = platform || publishedAt || (tags && tags.length > 0)
  const hasContent = summary || hasMeta || hasFooter

  if (!imageUrl && !hasContent) return null

  return (
    <div className="artifact-card-preview" style={{ marginTop: '10px' }} onClick={onClick}>
      {imageUrl && (
        <div style={{ marginBottom: '10px' }}>
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            style={{
              width: '100%',
              maxHeight: '200px',
              objectFit: 'cover',
              borderRadius: '6px',
              display: 'block',
            }}
          />
        </div>
      )}

      {hasMeta && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
            flexWrap: 'wrap',
          }}
        >
          {platform && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--c-text-muted)',
                padding: '2px 8px',
                background: 'var(--c-bg-deep)',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            >
              {platform}
            </span>
          )}
          {publishedAt && (
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
              {formatDate(publishedAt)}
            </span>
          )}
          {tags?.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '11px',
                color: 'var(--c-text-muted)',
                padding: '1px 6px',
                border: '1px solid var(--c-border)',
                borderRadius: '4px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {summary && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--c-text-secondary)',
            lineHeight: 1.6,
            marginBottom: hasFooter ? '10px' : '0',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {summary}
        </div>
      )}

      {hasFooter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            paddingTop: '8px',
            borderTop: '1px solid var(--c-border)',
          }}
        >
          {authorName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              {authorAvatar && (
                <img
                  src={authorAvatar}
                  alt=""
                  style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0 }}
                />
              )}
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--c-text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {authorName}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {price !== undefined && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--c-text-primary)',
                }}
              >
                {typeof price === 'number' ? `¥${price.toFixed(2)}` : String(price)}
              </span>
            )}
            {rating !== undefined && (
              <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                {'★'.repeat(Math.min(Math.round(rating), 5))}
                {'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}
                <span style={{ marginLeft: '4px' }}>{rating}</span>
              </span>
            )}
            {metricsLabel && (
              <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>{metricsLabel}</span>
            )}
            {!metricsLabel && metricsObj && (
              <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                {formatMetrics(metricsObj)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatMetrics(obj: Record<string, unknown>): string {
  const parts: string[] = []
  const iconMap: Record<string, string> = {
    likes: '♥',
    comments: '💬',
    collects: '⭐',
    shares: '↗',
    views: '👁',
    followers: '+',
    sales: '🛒',
    stock: '📦',
  }
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue
    const icon = iconMap[key] || '·'
    parts.push(`${icon} ${value}`)
  }
  return parts.join('  ')
}

function formatDate(input: string): string {
  try {
    const date = new Date(input)
    if (isNaN(date.getTime())) return input
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return input
  }
}
