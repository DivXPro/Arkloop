import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getDesktopPlatform } from '@arkloop/shared/desktop'

export function MacTitleSlot({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (getDesktopPlatform() !== 'darwin') return
    setEl(document.getElementById('mac-titlebar-slot'))
  }, [])

  if (!el) return <>{children}</>
  return createPortal(children, el)
}
