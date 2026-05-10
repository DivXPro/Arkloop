import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { readExtensionRuntimeState, writeExtensionRuntimeState } from '../storage'
import { getBuiltinExtensionById } from './registry'
import type { ExtensionDefinition, ExtensionPresentation } from './types'

type ExtensionRuntimeContextValue = {
  activeExtensionId: string | null
  activeExtension: ExtensionDefinition | null
  activeExtensionPresentation: ExtensionPresentation | null
  getPresentationForExtension: (extensionId: string) => ExtensionPresentation | null
  openExtension: (extensionId: string, presentation?: ExtensionPresentation) => Promise<void>
  setPresentationForExtension: (extensionId: string, presentation: ExtensionPresentation) => void
  deactivateActiveExtension: () => void
}

const ExtensionRuntimeContext = createContext<ExtensionRuntimeContextValue | null>(null)

export function ExtensionRuntimeProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeExtensionId, setActiveExtensionId] = useState<string | null>(null)
  const [activeExtensionContextPath, setActiveExtensionContextPath] = useState<string | null>(null)
  const [presentationByExtensionId, setPresentationByExtensionId] = useState<
    Record<string, ExtensionPresentation>
  >(() => readExtensionRuntimeState().presentationByExtensionId)
  const lastWorkspacePathRef = useRef('/')

  useEffect(() => {
    if (location.pathname.startsWith('/extensions/')) return
    const nextPath = `${location.pathname}${location.search}${location.hash}` || '/'
    lastWorkspacePathRef.current = nextPath
  }, [location.hash, location.pathname, location.search])

  useEffect(() => {
    if (!location.pathname.startsWith('/extensions/')) return
    const extensionId = decodeURIComponent(location.pathname.slice('/extensions/'.length))
    const extension = getBuiltinExtensionById(extensionId)
    if (!extension) {
      setActiveExtensionId(null)
      setActiveExtensionContextPath(null)
      return
    }
    setActiveExtensionId(extension.id)
    setActiveExtensionContextPath(`/extensions/${encodeURIComponent(extension.id)}`)
  }, [location.pathname])

  useEffect(() => {
    if (!activeExtensionId) return
    const currentPath = `${location.pathname}${location.search}${location.hash}` || '/'
    const activePresentation =
      presentationByExtensionId[activeExtensionId] ??
      getBuiltinExtensionById(activeExtensionId)?.presentation.default ??
      null
    if (!activeExtensionContextPath) return
    if (currentPath === activeExtensionContextPath) return
    if (activePresentation === 'route') {
      setActiveExtensionId(null)
      setActiveExtensionContextPath(null)
      return
    }
    setActiveExtensionId(null)
    setActiveExtensionContextPath(null)
  }, [
    location.hash,
    location.pathname,
    location.search,
  ])

  const setPresentationForExtension = useCallback(
    (extensionId: string, presentation: ExtensionPresentation) => {
      setPresentationByExtensionId((current) => {
        const next = { ...current, [extensionId]: presentation }
        writeExtensionRuntimeState({
          lastExtensionId: activeExtensionId,
          presentationByExtensionId: next,
        })
        return next
      })
    },
    [activeExtensionId],
  )

  const deactivateActiveExtension = useCallback(() => {
    setActiveExtensionId(null)
    setActiveExtensionContextPath(null)
  }, [])

  const openExtension = useCallback(
    async (extensionId: string, presentation?: ExtensionPresentation) => {
      const extension = getBuiltinExtensionById(extensionId)
      if (!extension) return
      const nextPresentation =
        presentation ?? presentationByExtensionId[extensionId] ?? extension.presentation.default
      const nextPresentationMap = {
        ...presentationByExtensionId,
        [extensionId]: nextPresentation,
      }
      setActiveExtensionId(extensionId)
      setActiveExtensionContextPath(
        nextPresentation === 'route'
          ? `/extensions/${encodeURIComponent(extensionId)}`
          : (lastWorkspacePathRef.current || '/'),
      )
      setPresentationByExtensionId(nextPresentationMap)
      writeExtensionRuntimeState({
        lastExtensionId: extensionId,
        presentationByExtensionId: nextPresentationMap,
      })
      if (nextPresentation === 'route') {
        navigate(`/extensions/${encodeURIComponent(extensionId)}`)
        return
      }
      navigate(lastWorkspacePathRef.current || '/')
    },
    [navigate, presentationByExtensionId],
  )

  const value = useMemo<ExtensionRuntimeContextValue>(
    () => ({
      activeExtensionId,
      activeExtension: activeExtensionId ? getBuiltinExtensionById(activeExtensionId) : null,
      activeExtensionPresentation: activeExtensionId
        ? (presentationByExtensionId[activeExtensionId] ??
          getBuiltinExtensionById(activeExtensionId)?.presentation.default ??
          null)
        : null,
      getPresentationForExtension: (extensionId) =>
        presentationByExtensionId[extensionId] ??
        getBuiltinExtensionById(extensionId)?.presentation.default ??
        null,
      openExtension,
      setPresentationForExtension,
      deactivateActiveExtension,
    }),
    [
      activeExtensionId,
      deactivateActiveExtension,
      openExtension,
      presentationByExtensionId,
      setPresentationForExtension,
    ],
  )

  return <ExtensionRuntimeContext.Provider value={value}>{children}</ExtensionRuntimeContext.Provider>
}

export function useExtensionRuntime(): ExtensionRuntimeContextValue {
  const value = useContext(ExtensionRuntimeContext)
  if (!value) {
    throw new Error('useExtensionRuntime must be used within ExtensionRuntimeProvider')
  }
  return value
}
