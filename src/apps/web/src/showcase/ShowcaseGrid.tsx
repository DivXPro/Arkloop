import { memo } from 'react'
import type { ShowcaseItem } from './types'
import { ShowcaseCard } from './ShowcaseCard'

interface Props {
  items: ShowcaseItem[]
}

export const ShowcaseGrid = memo(function ShowcaseGrid({ items }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <ShowcaseCard key={item.id} item={item} />
      ))}
    </div>
  )
})
