import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useBrowserTabs } from '../contexts/browser-tabs'
import {
  readExtensionBrowserSessionMap,
  writeExtensionBrowserSessionMap,
} from '../storage'

type ExtensionBrowserSessionContextValue = {
  ensureBrowserSession: (
    extensionId: string,
    options?: { openPanel?: boolean }
  ) => Promise<string | null>
  getBrowserTabIdForExtension: (extensionId: string) => string | null
}

const ExtensionBrowserSessionContext =
  createContext<ExtensionBrowserSessionContextValue | null>(null)

export function ExtensionBrowserSessionProvider({
  children,
}: {
  children: ReactNode
}) {
  const { createBrowserTab, activateBrowserTab, openBrowserPanel } =
    useBrowserTabs()
  const [sessions, setSessions] = useState(readExtensionBrowserSessionMap)
  const sessionsRef = useRef(sessions)
  const pendingSessionsRef = useRef<Record<string, Promise<string | null>>>({})

  const ensureBrowserSession = useCallback(
    async (extensionId: string, options?: { openPanel?: boolean }) => {
      const openPanel = options?.openPanel ?? true
      const existingTabId = sessionsRef.current[extensionId]
      if (existingTabId) {
        if (openPanel) {
          openBrowserPanel()
        }
        activateBrowserTab(existingTabId, { openPanel })
        return existingTabId
      }

      const pending = pendingSessionsRef.current[extensionId]
      if (pending) {
        const pendingTabId = await pending
        if (pendingTabId) {
          if (openPanel) {
            openBrowserPanel()
          }
          activateBrowserTab(pendingTabId, { openPanel })
        }
        return pendingTabId
      }

      const creation = (async () => {
        const newTabId = await createBrowserTab({ openPanel })
        if (!newTabId) return null

        const next = { ...sessionsRef.current, [extensionId]: newTabId }
        sessionsRef.current = next
        setSessions(next)
        writeExtensionBrowserSessionMap(next)
        return newTabId
      })()

      pendingSessionsRef.current[extensionId] = creation

      try {
        const newTabId = await creation
        if (newTabId) {
          if (openPanel) {
            openBrowserPanel()
          }
          activateBrowserTab(newTabId, { openPanel })
        }
        return newTabId
      } finally {
        delete pendingSessionsRef.current[extensionId]
      }
    },
    [activateBrowserTab, createBrowserTab, openBrowserPanel],
  )

  const value = useMemo<ExtensionBrowserSessionContextValue>(
    () => ({
      ensureBrowserSession,
      getBrowserTabIdForExtension: (extensionId) => sessions[extensionId] ?? null,
    }),
    [ensureBrowserSession, sessions],
  )

  return (
    <ExtensionBrowserSessionContext.Provider value={value}>
      {children}
    </ExtensionBrowserSessionContext.Provider>
  )
}

export function useExtensionBrowserSession(): ExtensionBrowserSessionContextValue {
  const value = useContext(ExtensionBrowserSessionContext)
  if (!value) {
    throw new Error(
      'useExtensionBrowserSession must be used within ExtensionBrowserSessionProvider',
    )
  }
  return value
}
