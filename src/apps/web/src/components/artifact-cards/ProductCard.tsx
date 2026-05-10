/**
 * 电商专用卡片。
 * 约定 descriptor 字段：
 *   - image: 商品图
 *   - price: string | number
 *   - rating: number (1-5)
 *   - brand: 品牌名
 *   - stock: 库存数
 *   - originalPrice: 原价（用于显示划线价）
 *   - sales: 销量
 */
export function ProductCard({
  descriptor,
  summary,
  onClick,
}: {
  descriptor: Record<string, unknown>
  summary?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const image = descriptor.image as string | undefined
  const price = descriptor.price as number | string | undefined
  const originalPrice = descriptor.originalPrice as number | string | undefined
  const rating = descriptor.rating as number | undefined
  const brand = descriptor.brand as string | undefined
  const stock = descriptor.stock as number | undefined
  const sales = descriptor.sales as number | undefined

  const hasPrice = price !== undefined
  const showDiscount = hasPrice && originalPrice !== undefined &&
    Number(originalPrice) > Number(price)

  return (
    <div className="artifact-product-card" style={{ marginTop: '10px' }} onClick={onClick}>
      {image && (
        <div style={{ marginBottom: '10px', position: 'relative' }}>
          <img
            src={image}
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
          {brand && (
            <span
              style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                fontSize: '11px',
                color: '#fff',
                background: 'rgba(0,0,0,0.6)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {brand}
            </span>
          )}
        </div>
      )}

      {summary && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--c-text-secondary)',
            lineHeight: 1.6,
            marginBottom: '10px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {hasPrice && (
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-text-primary)' }}>
              {typeof price === 'number' ? `¥${price.toFixed(2)}` : String(price)}
            </span>
          )}
          {showDiscount && (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--c-text-muted)',
                textDecoration: 'line-through',
              }}
            >
              {typeof originalPrice === 'number' ? `¥${originalPrice.toFixed(2)}` : String(originalPrice)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {rating !== undefined && (
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
              {'★'.repeat(Math.min(Math.round(rating), 5))}
              {'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}
              <span style={{ marginLeft: '4px' }}>{rating}</span>
            </span>
          )}
          {sales !== undefined && (
            <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
              已售 {sales}
            </span>
          )}
          {stock !== undefined && (
            <span
              style={{
                fontSize: '11px',
                color: stock <= 10 ? '#ff4d4f' : 'var(--c-text-muted)',
                padding: '1px 6px',
                border: '1px solid var(--c-border)',
                borderRadius: '4px',
              }}
            >
              {stock <= 0 ? '缺货' : stock <= 10 ? `仅剩 ${stock} 件` : `库存 ${stock}`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
