import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InlineArtifactCard } from './InlineArtifactCard'
import { registerKind, registerKindPrefix, setDefaultKindConfig } from '../lib/kindRegistry'

describe('InlineArtifactCard', () => {
  it('renders artifact title and kind', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_001',
          kind: 'design.canvas',
          title: 'Test Design',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'inline-json',
          descriptor: {},
        }}
      />,
    )

    expect(html).toContain('Test Design')
    expect(html).toContain('design.canvas')
  })

  it('falls back to Untitled when no title', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_002',
          kind: 'image.generated',
          title: '',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'inline-json',
          descriptor: {},
        }}
      />,
    )

    expect(html).toContain('Untitled')
  })

  it('shows image preview for inline object-blob image kinds', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_004',
          kind: 'image.png',
          title: 'Photo',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          display: 'inline',
          descriptor: { key: 'test/photo.png' },
        }}
      />,
    )

    expect(html).toContain('/v1/artifacts/test/photo.png')
    expect(html).toContain('alt="Photo"')
  })

  it('does not show preview for non-image kinds', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_005',
          kind: 'design.canvas',
          title: 'Canvas',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'inline-json',
          descriptor: {},
        }}
      />,
    )

    expect(html).not.toContain('<img')
  })

  it('does not show image preview when display=panel', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_006',
          kind: 'image.png',
          title: 'Panel Photo',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          display: 'panel',
          descriptor: { key: 'test/panel.png' },
        }}
      />,
    )

    expect(html).not.toContain('<img')
    expect(html).toContain('Panel Photo')
  })

  it('shows iframe preview for iframe inlineMode with object-blob', () => {
    registerKindPrefix('iframe.', { inlineMode: 'iframe' })
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_007',
          kind: 'iframe.html',
          title: 'Embedded Page',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          display: 'inline',
          descriptor: { key: 'test/page.html' },
        }}
      />,
    )

    expect(html).toContain('<iframe')
    expect(html).toContain('/v1/artifacts/test/page.html')
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"')
    expect(html).toContain('Embedded Page')
  })

  it('does not show iframe preview when display=panel', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_008',
          kind: 'iframe.html',
          title: 'Panel Frame',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          display: 'panel',
          descriptor: { key: 'test/panel.html' },
        }}
      />,
    )

    expect(html).not.toContain('<iframe')
    expect(html).toContain('Panel Frame')
  })

  it('does not show iframe preview for non-object-blob', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_009',
          kind: 'iframe.html',
          title: 'No Blob',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'inline-json',
          display: 'inline',
          descriptor: { key: 'test/no-blob.html' },
        }}
      />,
    )

    expect(html).not.toContain('<iframe')
    expect(html).toContain('No Blob')
  })

  it('renders link style for link inlineMode', () => {
    registerKindPrefix('link.', { inlineMode: 'link' })
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_010',
          kind: 'link.url',
          title: 'External Link',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'external-url',
          descriptor: { url: 'https://example.com' },
        }}
      />,
    )

    expect(html).toContain('External Link')
    expect(html).toContain('text-decoration:underline')
  })

  // === clickAction 行为控制测试 ===

  it('external-url fetchMode defaults to open-external clickAction', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_020',
          kind: 'document.markdown',
          title: 'External Doc',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'external-url',
          descriptor: { url: 'https://example.com/doc' },
        }}
        onClick={() => {}}
      />,
    )

    expect(html).toContain('data-click-action="open-external"')
    expect(html).toContain('↗')
    expect(html).not.toContain('⤢')
    expect(html).not.toContain('artifact-open-panel')
  })

  it('object-blob fetchMode defaults to open-panel clickAction when onClick provided', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_021',
          kind: 'design.canvas',
          title: 'Panel Open',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          descriptor: { key: 'test/design' },
        }}
        onClick={() => {}}
      />,
    )

    expect(html).toContain('data-click-action="open-panel"')
    expect(html).toContain('⤢')
    expect(html).toContain('artifact-open-panel')
  })

  it('clickAction=none disables clicking and hides buttons', () => {
    registerKind('none.thing', { inlineMode: 'card-preview', clickAction: 'none' })
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_022',
          kind: 'none.thing',
          title: 'No Click',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          descriptor: { key: 'test/thing' },
        }}
        onClick={() => {}}
      />,
    )

    expect(html).toContain('data-click-action="none"')
    expect(html).not.toContain('⤢')
    expect(html).not.toContain('artifact-open-panel')
    expect(html).not.toContain('↗')
  })

  it('clickAction=open-external via kindConfig overrides default behavior', () => {
    registerKind('custom.external', { inlineMode: 'card-preview', clickAction: 'open-external' })
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_023',
          kind: 'custom.external',
          title: 'Forced External',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          descriptor: { url: 'https://forced.example.com' },
        }}
        onClick={() => {}}
      />,
    )

    expect(html).toContain('data-click-action="open-external"')
    expect(html).toContain('↗')
    expect(html).not.toContain('⤢')
  })

  it('clickAction=open-panel via kindConfig forces panel even for external-url', () => {
    registerKind('custom.panel', { inlineMode: 'card-preview', clickAction: 'open-panel' })
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_024',
          kind: 'custom.panel',
          title: 'Forced Panel',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'external-url',
          descriptor: { url: 'https://example.com' },
        }}
        onClick={() => {}}
      />,
    )

    expect(html).toContain('data-click-action="open-panel"')
    expect(html).toContain('⤢')
    expect(html).not.toContain('↗')
  })

  it('no onClick defaults to none clickAction for non-external-url', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_025',
          kind: 'design.canvas',
          title: 'No Handler',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          descriptor: { key: 'test/design' },
        }}
      />,
    )

    expect(html).toContain('data-click-action="none"')
    expect(html).not.toContain('⤢')
    expect(html).not.toContain('artifact-open-panel')
  })
})
