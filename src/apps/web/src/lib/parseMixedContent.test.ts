import { describe, it, expect } from 'vitest'
import { parseMixedContent } from './parseMixedContent'

describe('parseMixedContent', () => {
  it('parses content with inline artifact markers', () => {
    const content = 'Hello\n\n<artifact id="art_001" kind="design.canvas" title="Design" />\n\nWorld'
    const result = parseMixedContent(content)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ type: 'text', text: 'Hello\n\n' })
    expect(result[1]).toEqual({ type: 'artifact', id: 'art_001', kind: 'design.canvas', title: 'Design' })
    expect(result[2]).toEqual({ type: 'text', text: '\n\nWorld' })
  })

  it('returns single text segment when no markers', () => {
    const content = 'Just plain text'
    const result = parseMixedContent(content)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'text', text: 'Just plain text' })
  })

  it('handles empty title attribute', () => {
    const content = '<artifact id="art_002" kind="image.generated" />'
    const result = parseMixedContent(content)

    expect(result[0].type).toBe('artifact')
    if (result[0].type === 'artifact') {
      expect(result[0].title).toBeUndefined()
    }
  })

  it('handles malformed tag gracefully', () => {
    const content = 'Text <artifact id="art_003"> more text'
    const result = parseMixedContent(content)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
  })

  it('handles missing id as text', () => {
    const content = '<artifact kind="design.canvas" />'
    const result = parseMixedContent(content)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
  })

  it('handles multiple artifacts', () => {
    const content = 'A <artifact id="a1" kind="x" /> B <artifact id="a2" kind="y" /> C'
    const result = parseMixedContent(content)

    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({ type: 'text', text: 'A ' })
    expect(result[1]).toEqual({ type: 'artifact', id: 'a1', kind: 'x' })
    expect(result[2]).toEqual({ type: 'text', text: ' B ' })
    expect(result[3]).toEqual({ type: 'artifact', id: 'a2', kind: 'y' })
    expect(result[4]).toEqual({ type: 'text', text: ' C' })
  })
})
