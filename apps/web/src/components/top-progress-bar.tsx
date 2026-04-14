'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Honest load indicator. A 2px accent-colored bar at the very top of the
 * viewport that only appears when a navigation takes longer than SHOW_AFTER_MS
 * to commit — so fast/cached navigations don't flash it. Listens for the
 * global `sky:nav-start` / `sky:nav-end` events emitted by revealNavigate,
 * and also auto-completes on pathname change (covers browser-back and any
 * nav we didn't route through the helper).
 */
export function TopProgressBar() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const SHOW_AFTER_MS = 180
  const MAX_FAUX_PROGRESS = 85

  useEffect(() => {
    const clearAll = () => {
      if (showTimer.current) clearTimeout(showTimer.current)
      if (tickTimer.current) clearInterval(tickTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      showTimer.current = null
      tickTimer.current = null
      hideTimer.current = null
    }

    const onStart = () => {
      clearAll()
      setProgress(0)
      showTimer.current = setTimeout(() => {
        setVisible(true)
        setProgress(10)
        tickTimer.current = setInterval(() => {
          setProgress((p) => {
            // Ease towards 85%: fast early, slow late, never reaches 100 until end.
            const next = p + (MAX_FAUX_PROGRESS - p) * 0.08
            return Math.min(next, MAX_FAUX_PROGRESS)
          })
        }, 140)
      }, SHOW_AFTER_MS)
    }

    const onEnd = () => {
      if (showTimer.current) {
        clearTimeout(showTimer.current)
        showTimer.current = null
      }
      if (tickTimer.current) {
        clearInterval(tickTimer.current)
        tickTimer.current = null
      }
      if (!visible) return
      setProgress(100)
      hideTimer.current = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 260)
    }

    window.addEventListener('sky:nav-start', onStart)
    window.addEventListener('sky:nav-end', onEnd)
    return () => {
      window.removeEventListener('sky:nav-start', onStart)
      window.removeEventListener('sky:nav-end', onEnd)
      clearAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pathname change = nav committed. Fire the nav-end just in case.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sky:nav-end'))
  }, [pathname])

  if (!visible && progress === 0) return null

  return (
    <div className="skyhub-topbar" aria-hidden>
      <div
        className="skyhub-topbar__fill"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  )
}
