import { describe, it, expect } from 'vitest'
import { getKindConfig, registerKind, registerKindPrefix, setDefaultKindConfig } from './kindRegistry'

describe('kindRegistry', () => {
  it('returns previewable=true for image kinds via prefix', () => {
    expect(getKindConfig('image.png').previewable).toBe(true)
    expect(getKindConfig('image.jpeg').previewable).toBe(true)
    expect(getKindConfig('image.generated').previewable).toBe(true)
  })

  it('returns previewable=false for design kinds', () => {
    expect(getKindConfig('design.canvas').previewable).toBe(false)
    expect(getKindConfig('design.figma').previewable).toBe(false)
  })

  it('returns previewable=false for document kinds', () => {
    expect(getKindConfig('document.markdown').previewable).toBe(false)
  })

  it('returns previewable=false for code kinds', () => {
    expect(getKindConfig('code.python').previewable).toBe(false)
  })

  it('returns previewable=false for data kinds', () => {
    expect(getKindConfig('data.csv').previewable).toBe(false)
  })

  it('returns default config for unknown kinds', () => {
    const cfg = getKindConfig('unknown.something')
    expect(cfg.previewable).toBe(false)
    expect(cfg.cardType).toBe('compact')
  })

  it('exact match overrides prefix match', () => {
    registerKind('image.special', { previewable: false, cardType: 'compact', defaultDisplay: 'inline' })
    expect(getKindConfig('image.special').previewable).toBe(false)
    // other image kinds still use prefix rule
    expect(getKindConfig('image.png').previewable).toBe(true)
  })

  it('custom prefix works', () => {
    registerKindPrefix('custom.', { previewable: true, cardType: 'thumbnail', defaultDisplay: 'inline' })
    expect(getKindConfig('custom.thing').previewable).toBe(true)
  })

  it('setDefault changes fallback', () => {
    setDefaultKindConfig({ previewable: true, cardType: 'thumbnail', defaultDisplay: 'collapsed' })
    expect(getKindConfig('totally.unknown').previewable).toBe(true)
    // restore for other tests
    setDefaultKindConfig({ previewable: false, cardType: 'compact', defaultDisplay: 'inline' })
  })
})
