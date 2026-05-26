import { useEffect, useRef } from 'react'
import { createCanvasDitherScene } from '../scenes/CanvasDitherScene'

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function WelcomeParticleBackground({ containerRef }: Props) {
  const mountedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || mountedRef.current) return
    mountedRef.current = true

    const scene = createCanvasDitherScene(container)
    return () => {
      scene.dispose()
      mountedRef.current = false
    }
  }, [containerRef])

  return null
}
