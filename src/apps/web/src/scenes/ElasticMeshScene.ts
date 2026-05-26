import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  PointsMaterial,
  Points,
  FogExp2,
} from 'three'

// ── config ──────────────────────────────────────────────────────
const GRID_COLS = 55
const GRID_ROWS = 38
const GRID_SPACING = 0.52
const DARK_COLOR = 0x4ade80
const LIGHT_COLOR = 0x166534

// ── helpers ─────────────────────────────────────────────────────

function isLightTheme(): boolean {
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme === 'light') return true
  if (theme === 'dark') return false
  return !window.matchMedia('(prefers-color-scheme: dark)').matches
}

interface GridVertex {
  baseX: number
  baseY: number
  baseZ: number
}

function buildGrid(): GridVertex[] {
  const vertices: GridVertex[] = []
  const offX = ((GRID_COLS - 1) * GRID_SPACING) / 2
  const offY = ((GRID_ROWS - 1) * GRID_SPACING) / 2
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      vertices.push({
        baseX: col * GRID_SPACING - offX,
        baseY: row * GRID_SPACING - offY,
        baseZ: (Math.random() - 0.5) * 1.4,
      })
    }
  }
  return vertices
}

function buildLinePositions(vertices: GridVertex[]): Float32Array {
  const totalSegments = GRID_ROWS * (GRID_COLS - 1) + GRID_COLS * (GRID_ROWS - 1)
  const positions = new Float32Array(totalSegments * 6)
  let idx = 0
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS - 1; col++) {
      const a = row * GRID_COLS + col
      const b = a + 1
      positions[idx++] = vertices[a].baseX
      positions[idx++] = vertices[a].baseY
      positions[idx++] = vertices[a].baseZ
      positions[idx++] = vertices[b].baseX
      positions[idx++] = vertices[b].baseY
      positions[idx++] = vertices[b].baseZ
    }
  }
  for (let row = 0; row < GRID_ROWS - 1; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const a = row * GRID_COLS + col
      const b = a + GRID_COLS
      positions[idx++] = vertices[a].baseX
      positions[idx++] = vertices[a].baseY
      positions[idx++] = vertices[a].baseZ
      positions[idx++] = vertices[b].baseX
      positions[idx++] = vertices[b].baseY
      positions[idx++] = vertices[b].baseZ
    }
  }
  return positions
}

function buildDotPositions(vertices: GridVertex[]): Float32Array {
  const positions = new Float32Array(vertices.length * 3)
  for (let i = 0; i < vertices.length; i++) {
    positions[i * 3] = vertices[i].baseX
    positions[i * 3 + 1] = vertices[i].baseY
    positions[i * 3 + 2] = vertices[i].baseZ
  }
  return positions
}

function buildSegmentPairs(): [number, number][] {
  const pairs: [number, number][] = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS - 1; col++) {
      pairs.push([row * GRID_COLS + col, row * GRID_COLS + col + 1])
    }
  }
  for (let row = 0; row < GRID_ROWS - 1; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      pairs.push([row * GRID_COLS + col, row * GRID_COLS + col + GRID_COLS])
    }
  }
  return pairs
}

// ── scene controller ────────────────────────────────────────────

export interface ElasticMeshSceneHandle {
  dispose: () => void
}

export function createElasticMeshScene(container: HTMLElement): ElasticMeshSceneHandle {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lightTheme = isLightTheme()
  const vertices = buildGrid()
  const segmentPairs = buildSegmentPairs()

  // renderer
  const renderer = new WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.domElement.classList.add('welcome-particle-canvas')
  renderer.domElement.style.opacity = '0'
  renderer.domElement.style.transition = 'opacity 0.8s ease'
  container.insertBefore(renderer.domElement, container.firstChild)

  // scene + fog
  const scene = new Scene()
  scene.fog = new FogExp2(0x000000, 0.01)

  // camera
  const camera = new PerspectiveCamera(
    50,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.1,
    100,
  )
  camera.position.z = 14
  camera.lookAt(0, 0, 0)

  // materials
  const lineMaterial = new LineBasicMaterial({
    color: lightTheme ? LIGHT_COLOR : DARK_COLOR,
    transparent: true,
    opacity: 0.25,
    blending: 2, // AdditiveBlending
    depthWrite: false,
  })
  const dotMaterial = new PointsMaterial({
    color: lightTheme ? LIGHT_COLOR : DARK_COLOR,
    size: 0.04,
    transparent: true,
    opacity: 0.55,
    blending: 2,
    depthWrite: false,
  })

  // line geometry + segments
  const linePositions = buildLinePositions(vertices)
  const lineGeometry = new BufferGeometry()
  lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3))
  const lines = new LineSegments(lineGeometry, lineMaterial)
  scene.add(lines)

  // dots
  const dotPositions = buildDotPositions(vertices)
  const dotGeometry = new BufferGeometry()
  dotGeometry.setAttribute('position', new BufferAttribute(dotPositions, 3))
  const dots = new Points(dotGeometry, dotMaterial)
  scene.add(dots)

  // fade in
  requestAnimationFrame(() => {
    renderer.domElement.style.opacity = '1'
  })

  // pointer tracking
  const mouse = { x: 0, y: 0 }
  const handlePointerMove = (e: PointerEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  }
  window.addEventListener('pointermove', handlePointerMove, { passive: true })

  // theme observer
  const themeObserver = new MutationObserver(() => {
    const light = isLightTheme()
    const color = light ? LIGHT_COLOR : DARK_COLOR
    lineMaterial.color.set(color)
    dotMaterial.color.set(color)
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  // resize
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    const { width, height } = entry.contentRect
    renderer.setSize(width, height)
    camera.aspect = width / Math.max(height, 1)
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(container)

  // animation
  let animFrame = 0
  const displaced = new Float32Array(vertices.length * 3)
  const lineAttr = lineGeometry.attributes.position as BufferAttribute
  const dotAttr = dotGeometry.attributes.position as BufferAttribute
  const startTime = performance.now()

  function animate() {
    animFrame = requestAnimationFrame(animate)

    const t = (performance.now() - startTime) / 1000

    // wave displacement
    const speed = reduceMotion ? 0.15 : 0.35
    const amp = reduceMotion ? 0.1 : 0.9
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i]
      const x = v.baseX
      const y = v.baseY
      const z =
        Math.sin(x * 0.7 + t * speed * 0.8) * Math.cos(y * 0.6 + t * speed * 0.6) * amp * 0.7 +
        Math.cos(x * 0.45 - t * speed * 1.1) * Math.sin(y * 0.55 + t * speed * 0.9) * amp * 0.5 +
        Math.sin(x * 0.3 + y * 0.4 + t * speed * 0.5) * amp * 0.35 +
        v.baseZ * 0.3
      displaced[i * 3] = v.baseX
      displaced[i * 3 + 1] = v.baseY
      displaced[i * 3 + 2] = z
    }

    // update line positions
    const lp = lineAttr.array as Float32Array
    for (let s = 0; s < segmentPairs.length; s++) {
      const [a, b] = segmentPairs[s]
      const o = s * 6
      lp[o] = displaced[a * 3]
      lp[o + 1] = displaced[a * 3 + 1]
      lp[o + 2] = displaced[a * 3 + 2]
      lp[o + 3] = displaced[b * 3]
      lp[o + 4] = displaced[b * 3 + 1]
      lp[o + 5] = displaced[b * 3 + 2]
    }
    lineAttr.needsUpdate = true

    // update dots
    dotAttr.array.set(displaced)
    dotAttr.needsUpdate = true

    // opacity pulse
    const pulse = 1 + Math.sin(t * 0.4) * (reduceMotion ? 0.06 : 0.12)
    lineMaterial.opacity = (reduceMotion ? 0.3 : 0.22) + pulse * 0.06
    dotMaterial.opacity = (reduceMotion ? 0.55 : 0.5) + pulse * 0.08

    // pointer drift
    if (!reduceMotion) {
      const targetX = mouse.x * 0.5
      const targetY = mouse.y * 0.3
      camera.position.x += (targetX - camera.position.x) * 0.025
      camera.position.y += (targetY - camera.position.y) * 0.025
    }

    camera.position.z = 14 + Math.sin(t * 0.3) * 0.6
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }
  animate()

  // cleanup
  const dispose = () => {
    cancelAnimationFrame(animFrame)
    window.removeEventListener('pointermove', handlePointerMove)
    themeObserver.disconnect()
    resizeObserver.disconnect()
    renderer.dispose()
    lineGeometry.dispose()
    lineMaterial.dispose()
    dotGeometry.dispose()
    dotMaterial.dispose()
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
  }

  return { dispose }
}
