const STORAGE_KEY = 'arkloop:web:resource_ui_contents'

function loadFromStorage(): Map<string, string> {
  const map = new Map<string, string>()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Record<string, string>
      for (const [uri, content] of Object.entries(data)) {
        map.set(uri, content)
      }
    }
  } catch { /* ignore */ }
  return map
}

function saveToStorage(map: Map<string, string>): void {
  try {
    const data: Record<string, string> = {}
    for (const [uri, content] of map.entries()) {
      data[uri] = content
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

const resourceContentMap = loadFromStorage()

export function setResourceContent(uri: string, content: string): void {
  resourceContentMap.set(uri, content)
  saveToStorage(resourceContentMap)
}

export function getResourceContent(uri: string): string | undefined {
  return resourceContentMap.get(uri)
}

export function clearResourceContents(): void {
  resourceContentMap.clear()
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
