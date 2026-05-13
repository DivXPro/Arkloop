const resourceDataMap = new Map<string, unknown>()

export function setResourceToolOutput(uri: string, output: unknown): void {
  resourceDataMap.set(uri, output)
}

export function getResourceToolOutput(uri: string): unknown {
  return resourceDataMap.get(uri)
}

export function clearResourceToolOutputs(): void {
  resourceDataMap.clear()
}
