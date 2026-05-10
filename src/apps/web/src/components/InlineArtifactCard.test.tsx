import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InlineArtifactCard } from './InlineArtifactCard'
import { registerKindPrefix, setDefaultKindConfig } from '../lib/kindRegistry'

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

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_003',
          kind: 'document.markdown',
          title: 'Doc',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'inline-json',
          descriptor: {},
        }}
        onClick={onClick}
      />,
    )

    expect(html).toContain('inline-artifact-art_003')
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

    expect(html).not.toContain('/v1/artifacts/test/panel.png/preview')
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
    expect(html).toContain('↗')
    expect(html).toContain('text-decoration:underline')
  })

  it('does not show external link arrow for non-external-url link mode', () => {
    const html = renderToStaticMarkup(
      <InlineArtifactCard
        resource={{
          id: 'art_011',
          kind: 'link.url',
          title: 'Internal Link',
          producer: { type: 'agent', id: 'test' },
          fetchMode: 'object-blob',
          descriptor: { key: 'test/doc' },
        }}
      />,
    )

    expect(html).toContain('Internal Link')
    expect(html).not.toContain('↗')
  })
})
