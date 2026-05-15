import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { OpenDesignInstallPaths } from './types'

export function getOpenDesignInstallPaths(
  homeDir = os.homedir(),
): OpenDesignInstallPaths {
  const runtimeRoot = path.join(
    homeDir,
    '.arkloop',
    'integrations',
    'open-design',
  )
  const dataRoot = path.join(runtimeRoot, 'data')

  return {
    runtimeRoot,
    bundleRoot: path.join(runtimeRoot, 'bundle'),
    resourcesRoot: path.join(runtimeRoot, 'resources'),
    dataRoot,
    nodeBinary: path.join(runtimeRoot, 'resources', 'open-design', 'bin', 'node'),
    entryScript: path.join(runtimeRoot, 'bundle', 'prebundled', 'headless.mjs'),
    readyFile: path.join(
      dataRoot,
      'namespaces',
      'default',
      'runtime',
      'web-root.json',
    ),
  }
}

export function readOpenDesignReadyFile(raw: string): { webUrl: string } {
  const parsed = JSON.parse(raw) as { url?: string }
  const url = new URL(parsed.url ?? '')
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`invalid open design url protocol: ${url.protocol}`)
  }
  return { webUrl: url.toString() }
}

export function validateOpenDesignInstall(paths: OpenDesignInstallPaths): void {
  const requiredPaths = [
    paths.nodeBinary,
    paths.entryScript,
    path.join(paths.resourcesRoot, 'open-design', 'skills'),
    path.join(paths.resourcesRoot, 'open-design', 'design-systems'),
  ]

  for (const candidate of requiredPaths) {
    if (!fs.existsSync(candidate)) {
      throw new Error(`open design install incomplete: missing ${candidate}`)
    }
  }
}
