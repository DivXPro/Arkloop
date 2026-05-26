// ── config ──────────────────────────────────────────────────────
const CELL_STEP = 7
const DOT_RADIUS_BASE = 1.8
/** CSS variable used as the dot color — flips contrast automatically for dark/light */
const COLOR_VAR = '--c-text-secondary'

// ── helpers ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)
  if (!match) return null
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
}

function readThemeRgb(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(COLOR_VAR).trim()
  const parsed = hexToRgb(raw)
  return parsed ?? [194, 192, 182] // fallback: warm gray
}

function colorString(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
}

// ── scene controller ────────────────────────────────────────────

export interface CanvasSceneHandle {
  dispose: () => void
}

export function createCanvasDitherScene(container: HTMLElement): CanvasSceneHandle {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // canvas
  const canvas = document.createElement('canvas')
  canvas.classList.add('welcome-particle-canvas')
  canvas.style.opacity = '0'
  canvas.style.transition = 'opacity 0.8s ease'
  container.insertBefore(canvas, container.firstChild)

  const ctx = canvas.getContext('2d')!

  // sizing
  let w = 0
  let h = 0
  let dpr = 1
  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2)
    w = container.clientWidth
    h = container.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()

  // fade in
  requestAnimationFrame(() => {
    canvas.style.opacity = '1'
  })

  // pointer
  const mouse = { x: w / 2, y: h / 2 }
  const handlePointerMove = (e: PointerEvent) => {
    mouse.x = e.clientX
    mouse.y = e.clientY
  }
  window.addEventListener('pointermove', handlePointerMove, { passive: true })

  // theme color — read from CSS variable, re-read on theme change
  let currentRgb = readThemeRgb()
  const themeObserver = new MutationObserver(() => {
    currentRgb = readThemeRgb()
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  // also re-read on system color-scheme change (for system mode)
  const schemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleSchemeChange = () => {
    currentRgb = readThemeRgb()
  }
  schemeQuery.addEventListener('change', handleSchemeChange)

  // resize
  const resizeObserver = new ResizeObserver(() => {
    resize()
  })
  resizeObserver.observe(container)

  // animation
  let animFrame = 0
  let elapsed = 0
  let lastTime = performance.now()

  function draw() {
    animFrame = requestAnimationFrame(draw)

    const now = performance.now()
    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now
    elapsed += dt

    ctx.clearRect(0, 0, w, h)

    // pattern origin drifts with pointer
    const tx = w / 2 + (mouse.x - window.innerWidth / 2) * 0.08
    const ty = h / 2 + (mouse.y - window.innerHeight / 2) * 0.08

    const speed = reduceMotion ? 0.15 : 0.4
    const t = elapsed * speed

    for (let x = 0; x < w; x += CELL_STEP) {
      for (let y = 0; y < h; y += CELL_STEP) {
        const dx = x - tx
        const dy = y - ty
        const dist = Math.sqrt(dx * dx + dy * dy)

        // multi-layer wave
        let v =
          Math.sin(x * 0.005 + t * 0.7) * Math.cos(y * 0.008 - t * 0.5) * 0.6 +
          Math.cos(x * 0.006 - t * 0.4) * Math.sin(y * 0.007 + t * 0.6) * 0.4 +
          Math.sin((x + y) * 0.003 + t * 0.3) * 0.3

        // distance ring modulation
        v *= 0.5 + 0.5 * Math.sin(dist * 0.012 - t * 0.25)

        // breathing pulse
        const breath = 1 + Math.sin(elapsed * 0.3) * (reduceMotion ? 0.06 : 0.18)
        v *= breath

        const abs = Math.abs(v)
        if (abs < 0.08) continue

        const alpha = Math.min(abs * 1.1, 0.7)
        const radius = abs * DOT_RADIUS_BASE * 2

        ctx.fillStyle = colorString(currentRgb, alpha)
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  draw()

  // cleanup
  const dispose = () => {
    cancelAnimationFrame(animFrame)
    window.removeEventListener('pointermove', handlePointerMove)
    themeObserver.disconnect()
    schemeQuery.removeEventListener('change', handleSchemeChange)
    resizeObserver.disconnect()
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas)
    }
  }

  return { dispose }
}
