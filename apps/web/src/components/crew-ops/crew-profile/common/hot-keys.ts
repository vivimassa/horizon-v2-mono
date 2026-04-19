'use client'

import { useEffect, useRef } from 'react'

/**
 * Register Ctrl+S (⌘+S on macOS) at the window level for the duration of the
 * component's lifetime. The handler ref is kept fresh so the listener always
 * invokes the latest closure — matching the idiom in the Network Schedule
 * Grid's keyboard hook.
 */
export function useCtrlS(handler: (() => void) | null | undefined, enabled = true) {
  const ref = useRef<typeof handler>(handler)
  ref.current = handler
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')
      if (!isSave) return
      e.preventDefault()
      e.stopPropagation()
      ref.current?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])
}

/**
 * beforeunload guard while the profile has unsaved changes. Next.js route
 * changes are handled by the router-guarded Save/Cancel buttons instead.
 */
export function useUnsavedGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
