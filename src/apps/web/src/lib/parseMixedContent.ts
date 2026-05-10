import type { ContentSegment } from '@arkloop/shared'

const ARTIFACT_TAG_PATTERN = /<artifact\s+([^>]*)\/>/g
const ATTRIBUTE_PATTERN = /(\w+)="([^"]*)"/g

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const matches = attrString.matchAll(ATTRIBUTE_PATTERN)
  for (const match of matches) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

/**
 * 解析混合内容，提取内联 artifact 标记，拆分为文本段和产物段。
 *
 * 标准 Markdown 解析器遇到未知 XML 标签时行为不可控，因此必须在 Markdown
 * 解析前调用此函数做预处理拆分。
 */
export function parseMixedContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const matches = Array.from(content.matchAll(ARTIFACT_TAG_PATTERN))
  let lastIndex = 0

  for (const match of matches) {
    const matchIndex = match.index ?? 0
    const matchText = match[0]

    // Text before the tag
    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        text: content.slice(lastIndex, matchIndex),
      })
    }

    // Parse attributes
    const attrs = parseAttributes(match[1])

    if (attrs.id && attrs.kind) {
      segments.push({
        type: 'artifact',
        id: attrs.id,
        kind: attrs.kind,
        title: attrs.title,
      })
    } else {
      // Malformed: keep as text
      segments.push({
        type: 'text',
        text: matchText,
      })
    }

    lastIndex = matchIndex + matchText.length
  }

  // Trailing text
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      text: content.slice(lastIndex),
    })
  }

  return segments
}
