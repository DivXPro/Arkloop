/**
 * 社媒专用卡片。
 * 约定 descriptor 字段：
 *   - cover: 封面图
 *   - platform: 平台名
 *   - author: string | { name, avatar }
 *   - publishedAt: 发布时间
 *   - metrics: { likes, comments, shares, collects }
 *   - metricsLabel: 预设指标文本（兜底）
 */
export function SocialCard({
  descriptor,
  summary,
  onClick,
}: {
  descriptor: Record<string, unknown>
  summary?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const cover = descriptor.cover as string | undefined
  const platform = descriptor.platform as string | undefined
  const publishedAt = descriptor.publishedAt as string | undefined

  const author = descriptor.author
  const authorName = typeof author === 'string' ? author : (author as Record<string, unknown>)?.name as string | undefined
  const authorAvatar = typeof author === 'object' && author !== null ? (author as Record<string, unknown>)?.avatar as string | undefined : undefined

  const metrics = descriptor.metrics as Record<string, number> | undefined
  const metricsLabel = descriptor.metricsLabel as string | undefined

  const hasMetrics = metrics && Object.keys(metrics).length > 0

  return (
    <div className="artifact-social-card" style={{ marginTop: '10px' }} onClick={onClick}>
      {cover && (
        <div style={{ marginBottom: '10px' }}>
          <img
            src={cover}
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
      </div>

      {summary && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--c-text-secondary)',
            lineHeight: 1.6,
            marginBottom: '10px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {summary}
        </div>
      )}

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
          {metricsLabel && (
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>{metricsLabel}</span>
          )}
          {!metricsLabel && hasMetrics && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {metrics.likes !== undefined && (
                <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>♥ {metrics.likes}</span>
              )}
              {metrics.comments !== undefined && (
                <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>💬 {metrics.comments}</span>
              )}
              {metrics.shares !== undefined && (
                <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>↗ {metrics.shares}</span>
              )}
              {metrics.collects !== undefined && (
                <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>⭐ {metrics.collects}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
