import { useRef, useEffect, useCallback, useState } from 'react'
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

const IFRAME_HTML_TEMPLATE = (themeCSS: string, content: string) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh; style-src 'unsafe-inline'; img-src data: blob: https: http:; font-src https: http:; connect-src https: http:;">
<style>
  * { box-sizing: border-box; }
  html { background: transparent; overflow-x: hidden; }
  body { margin: 0; padding: 0; background: transparent; overflow-x: hidden; }
</style>
<style id="arkloop-theme-vars">
${themeCSS}
</style>
<script type="importmap">
{
  "imports": {
    "@modelcontextprotocol/ext-apps": "https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@1/dist/src/app-with-deps.js",
    "@modelcontextprotocol/ext-apps/react": "https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@1/dist/src/react/react-with-deps.js"
  }
}
</script>
</head>
<body>
${content}
<script>
(function() {
  function notifyHeight() {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight);
    window.parent.postMessage({ type: 'arkloop:mcpapp:resize', height: h + 20 }, '*');
  }
  new MutationObserver(notifyHeight).observe(document.body, { childList: true, subtree: true, attributes: true });
  if (typeof ResizeObserver === 'function') {
    var ro = new ResizeObserver(notifyHeight);
    ro.observe(document.body);
    ro.observe(document.documentElement);
  }
  window.addEventListener('load', notifyHeight);
})();
</script>
</body>
</html>`

function buildThemeCSS(): string {
  if (typeof document === 'undefined') return ''
  const root = document.documentElement
  const vars: string[] = []
  for (let i = 0; i < root.style.length; i++) {
    const name = root.style.item(i)
    if (name.startsWith('--c-')) {
      vars.push(`  ${name}: ${root.style.getPropertyValue(name)};`)
    }
  }
  // fallback: read computed styles for known variables
  const computed = getComputedStyle(root)
  const knownVars = [
    '--c-bg-page', '--c-bg-sub', '--c-text-primary', '--c-text-secondary',
    '--c-border', '--c-border-subtle', '--c-status-error', '--c-status-success',
  ]
  for (const name of knownVars) {
    if (!vars.some((v) => v.includes(name))) {
      const value = computed.getPropertyValue(name)
      if (value) vars.push(`  ${name}: ${value};`)
    }
  }
  return `:root {\n` + vars.join('\n') + `\n}`
}

function collectThemeSnapshot(): { css: string; theme: 'light' | 'dark' | null } {
  if (typeof document === 'undefined') {
    return { css: '', theme: null }
  }
  const rawTheme = document.documentElement.getAttribute('data-theme')
  return {
    css: buildThemeCSS(),
    theme: rawTheme === 'light' || rawTheme === 'dark' ? rawTheme : null,
  }
}

type Props = {
  uri: string
  content: string
  toolOutput?: unknown
  onOpenLink?: (url: string) => void
  style?: React.CSSProperties
  className?: string
}

function toCallToolResult(output: unknown): CallToolResult {
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>
    if (Array.isArray(o.content)) {
      return o as CallToolResult
    }
    if (o.result && typeof o.result === 'object') {
      const result = o.result as Record<string, unknown>
      if (Array.isArray(result.content)) {
        return result as CallToolResult
      }
    }
  }
  const text = typeof output === 'string' ? output : JSON.stringify(output)
  return { content: [{ type: 'text', text }] }
}

export function McpAppIframe({ uri, content, toolOutput, onOpenLink, style, className }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<AppBridge | null>(null)
  const pendingToolResultRef = useRef<unknown>(undefined)
  const isConnectedRef = useRef(false)
  const [iframeHeight, setIframeHeight] = useState<number | undefined>(undefined)

  // Rebuild iframe HTML when content or theme changes
  const [srcDoc, setSrcDoc] = useState(() => {
    const snapshot = collectThemeSnapshot()
    return IFRAME_HTML_TEMPLATE(snapshot.css, content)
  })

  const sendToolResult = useCallback((bridge: AppBridge, output: unknown) => {
    if (output === undefined) return
    try {
      bridge.sendToolResult(toCallToolResult(output))
    } catch (err) {
      console.error('[McpAppIframe] sendToolResult failed:', err)
    }
  }, [])

  // Handle toolOutput prop changes
  useEffect(() => {
    if (isConnectedRef.current && bridgeRef.current) {
      sendToolResult(bridgeRef.current, toolOutput)
    } else {
      pendingToolResultRef.current = toolOutput
    }
  }, [toolOutput, sendToolResult])

  // Connect AppBridge when iframe srcDoc changes (iframe mounts or reloads)
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) {
      return
    }

    let cancelled = false

    const setup = async () => {
      // Yield to browser so iframe begins parsing; then connect before
      // the app-side script calls its own connect().
      await new Promise((r) => setTimeout(r, 50))
      if (cancelled) return

      const transport = new PostMessageTransport(
        iframe.contentWindow!,
        iframe.contentWindow!,
      )
      const bridge = new AppBridge(
        null,
        { name: 'arkloop', version: '1.0.0' },
        { serverTools: { listChanged: true } },
      )

      bridge.onopenlink = async (request) => {
        onOpenLink?.(request.url)
        return { success: true }
      }

      bridge.oncalltool = async () => {
        throw new Error('Tool calling not yet implemented')
      }

      bridge.oninitialized = () => {
        if (cancelled) return
        isConnectedRef.current = true
        if (pendingToolResultRef.current !== undefined) {
          sendToolResult(bridge, pendingToolResultRef.current)
          pendingToolResultRef.current = undefined
        }
      }

      try {
        await bridge.connect(transport)
        if (cancelled) {
          bridge.close().catch(() => {})
          return
        }
        bridgeRef.current = bridge
      } catch (err) {
        console.error('[McpAppIframe] AppBridge connect failed:', err)
      }
    }

    setup()

    return () => {
      cancelled = true
      isConnectedRef.current = false
      bridgeRef.current?.close().catch(() => {})
      bridgeRef.current = null
    }
  }, [srcDoc, onOpenLink, sendToolResult])

  // Listen for resize messages from iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const iframe = iframeRef.current
      if (!iframe || event.source !== iframe.contentWindow) return
      if (event.data?.type === 'arkloop:mcpapp:resize' && typeof event.data.height === 'number') {
        setIframeHeight(Math.min(event.data.height, 2000))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const srcDocRef = useRef(srcDoc)
  srcDocRef.current = srcDoc

  const rebuildSrcDoc = useCallback((htmlContent: string) => {
    const snapshot = collectThemeSnapshot()
    const next = IFRAME_HTML_TEMPLATE(snapshot.css, htmlContent)
    if (next !== srcDocRef.current) {
      setSrcDoc(next)
    }
  }, [])

  useEffect(() => {
    rebuildSrcDoc(content)
  }, [content, rebuildSrcDoc])

  // Theme change listener: only data-theme, not style (CSS vars change too frequently)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      rebuildSrcDoc(content)
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [content, rebuildSrcDoc])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      title={`mcp-app-${uri}`}
      sandbox="allow-scripts"
      style={{
        width: '100%',
        minHeight: '200px',
        height: iframeHeight ? `${iframeHeight}px` : 'auto',
        border: '0.5px solid var(--c-border-subtle)',
        borderRadius: '10px',
        background: 'transparent',
        display: 'block',
        ...style,
      }}
      className={className}
    />
  )
}
