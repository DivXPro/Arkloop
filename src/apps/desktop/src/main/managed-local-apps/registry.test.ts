import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { getManagedLocalAppRuntimeRoot } from './registry'

describe('getManagedLocalAppRuntimeRoot', () => {
  it('uses the desktop config root under ~/.arkloop for open-design runtime data', () => {
    expect(getManagedLocalAppRuntimeRoot('/Users/huhui', 'open-design')).toBe(
      path.join('/Users/huhui', '.arkloop', 'integrations', 'open-design'),
    )
  })
})
