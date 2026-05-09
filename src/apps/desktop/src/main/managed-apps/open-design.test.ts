import { describe, expect, it } from 'vitest'

import {
  getOpenDesignInstallPaths,
  readOpenDesignReadyFile,
} from './open-design'

describe('getOpenDesignInstallPaths', () => {
  it('derives bundle, resource, data, and ready-file paths under ~/.arkloop/integrations/open-design', () => {
    const paths = getOpenDesignInstallPaths('/Users/huhui')

    expect(paths.runtimeRoot).toBe('/Users/huhui/.arkloop/integrations/open-design')
    expect(paths.nodeBinary).toBe('/Users/huhui/.arkloop/integrations/open-design/resources/bin/node')
    expect(paths.entryScript).toBe('/Users/huhui/.arkloop/integrations/open-design/bundle/node_modules/@open-design/packaged/dist/headless.mjs')
    expect(paths.readyFile).toBe('/Users/huhui/.arkloop/integrations/open-design/data/namespaces/default/runtime/web-root.json')
  })
})

describe('readOpenDesignReadyFile', () => {
  it('returns a validated http url from web-root.json', () => {
    const ready = readOpenDesignReadyFile(
      JSON.stringify({ version: 1, url: 'http://127.0.0.1:54321' }),
    )

    expect(ready.webUrl).toBe('http://127.0.0.1:54321/')
  })
})
