import { describe, it, expect } from 'vitest'
import { getKindConfig, registerKind, registerKindPrefix, setDefaultKindConfig } from './kindRegistry'

describe('kindRegistry', () => {
  it('returns inlineMode=image for image kinds via prefix', () => {
    expect(getKindConfig('image.png').inlineMode).toBe('image')
    expect(getKindConfig('image.jpeg').inlineMode).toBe('image')
    expect(getKindConfig('image.generated').inlineMode).toBe('image')
  })

  it('returns inlineMode=card-preview for design kinds', () => {
    expect(getKindConfig('design.canvas').inlineMode).toBe('card-preview')
    expect(getKindConfig('design.figma').inlineMode).toBe('card-preview')
  })

  it('returns inlineMode=card-preview for document kinds', () => {
    expect(getKindConfig('document.markdown').inlineMode).toBe('card-preview')
  })

  it('returns inlineMode=card-preview for code kinds', () => {
    expect(getKindConfig('code.python').inlineMode).toBe('card-preview')
  })

  it('returns inlineMode=card-preview for data kinds', () => {
    expect(getKindConfig('data.csv').inlineMode).toBe('card-preview')
  })

  it('returns default config for unknown kinds', () => {
    const cfg = getKindConfig('unknown.something')
    expect(cfg.inlineMode).toBe('link')
    expect(cfg.viewer).toBeUndefined()
  })

  it('exact match overrides prefix match', () => {
    registerKind('image.special', { inlineMode: 'link' })
    expect(getKindConfig('image.special').inlineMode).toBe('link')
    // other image kinds still use prefix rule
    expect(getKindConfig('image.png').inlineMode).toBe('image')
  })

  it('custom prefix works', () => {
    registerKindPrefix('custom.', { inlineMode: 'iframe', viewer: 'editor' })
    expect(getKindConfig('custom.thing').inlineMode).toBe('iframe')
    expect(getKindConfig('custom.thing').viewer).toBe('editor')
  })

  it('setDefault changes fallback', () => {
    setDefaultKindConfig({ inlineMode: 'iframe', viewer: 'editor' })
    expect(getKindConfig('totally.unknown').inlineMode).toBe('iframe')
    expect(getKindConfig('totally.unknown').viewer).toBe('editor')
    // restore for other tests
    setDefaultKindConfig({ inlineMode: 'link' })
  })
})
