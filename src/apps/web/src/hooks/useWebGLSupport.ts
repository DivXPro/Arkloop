import { useState } from 'react'

export function useWebGLSupport(): { supported: boolean; checked: boolean } {
  const [state] = useState<{ supported: boolean; checked: boolean }>(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      return { supported: !!gl, checked: true }
    } catch {
      return { supported: false, checked: true }
    }
  })

  return state
}
