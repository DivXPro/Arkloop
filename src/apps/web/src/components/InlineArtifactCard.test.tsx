import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InlineArtifactCard } from './InlineArtifactCard'

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

    expect(html).toContain('/v1/artifacts/test/photo.png/preview')
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
})
