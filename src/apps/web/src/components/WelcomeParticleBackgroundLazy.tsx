import { lazy, Suspense, type RefObject } from 'react'

const LazyBackground = lazy(() =>
  import('./WelcomeParticleBackground').then((m) => ({ default: m.WelcomeParticleBackground })),
)

type Props = { containerRef: RefObject<HTMLDivElement | null> }

export function WelcomeParticleBackgroundLazy(props: Props) {
  return (
    <Suspense fallback={null}>
      <LazyBackground {...props} />
    </Suspense>
  )
}
