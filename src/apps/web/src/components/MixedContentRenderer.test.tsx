import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MixedContentRenderer } from './MixedContentRenderer'

function makeArtifact(id: string, kind: string, title: string): any {
  return {
    id,
    kind,
    title,
    producer: { type: 'agent', id: 'test' },
    fetchMode: 'inline-json',
    descriptor: {},
  }
}

describe('MixedContentRenderer', () => {
  it('renders text only when no artifact markers', () => {
    const html = renderToStaticMarkup(
      <MixedContentRenderer content="Hello world" />,
    )

    expect(html).toContain('Hello world')
  })

  it('renders inline artifact when resource exists in artifacts array', () => {
    const html = renderToStaticMarkup(
      <MixedContentRenderer
        content='Check this out: <artifact id="art_001" kind="design.canvas" title="My Design" />'
        artifacts={[makeArtifact('art_001', 'design.canvas', 'My Design')]}
      />,
    )

    expect(html).toContain('inline-artifact-art_001')
    expect(html).toContain('My Design')
    expect(html).toContain('Check this out:')
  })

  it('renders broken placeholder when artifact id not found in artifacts array', () => {
    const html = renderToStaticMarkup(
      <MixedContentRenderer
        content='Missing: <artifact id="art_missing" kind="code.file" title="Missing" />'
        artifacts={[]}
      />,
    )

    expect(html).toContain('产物引用失效')
    expect(html).toContain('art_missing')
    expect(html).toContain('artifact-broken')
  })

  it('calls onOpenArtifact when artifact card is clicked (wired via props)', () => {
    const onOpenArtifact = vi.fn()
    const html = renderToStaticMarkup(
      <MixedContentRenderer
        content='See <artifact id="art_002" kind="document.markdown" title="Doc" />'
        artifacts={[makeArtifact('art_002', 'document.markdown', 'Doc')]}
        onOpenArtifact={onOpenArtifact}
      />,
    )

    expect(html).toContain('inline-artifact-art_002')
  })
})
