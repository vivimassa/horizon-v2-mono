'use client'

import { useState, useRef, useCallback } from 'react'

const MIN_DELAY_MS = 3000
const HOLD_MS = 800

interface RunwayLoadingState {
  /** Whether the runway animation is currently active */
  active: boolean
  /** Current progress percent (0–100) */
  percent: number
  /** Current label text */
  label: string
  /**
   * Wrap an async operation with the runway animation.
   * Shows the animation for at least 3 seconds, auto-advances to ~90%,
   * then completes to 100% when the promise resolves.
   * Returns the result of the async function.
   */
  run: <T>(fn: () => Promise<T>, loadingLabel?: string, doneLabel?: string) => Promise<T | undefined>
}

export function useRunwayLoading(): RunwayLoadingState {
  const [active, setActive] = useState(false)
  const [percent, setPercent] = useState(0)
  const [label, setLabel] = useState('')
  const rafRef = useRef(0)

  const run = useCallback(
    async <T>(fn: () => Promise<T>, loadingLabel = 'Loading…', doneLabel = 'Complete'): Promise<T | undefined> => {
      // Start animation
      setActive(true)
      setPercent(0)
      setLabel(loadingLabel)

      const startTime = performance.now()
      const advance = (now: number) => {
        const t = Math.min((now - startTime) / MIN_DELAY_MS, 1)
        const eased = 1 - Math.pow(1 - t, 2.5)
        setPercent(eased * 90)
        if (t < 1) rafRef.current = requestAnimationFrame(advance)
      }
      rafRef.current = requestAnimationFrame(advance)

      const minDelay = new Promise((r) => setTimeout(r, MIN_DELAY_MS))

      try {
        const [result] = await Promise.all([fn(), minDelay])
        cancelAnimationFrame(rafRef.current)
        setPercent(100)
        setLabel(doneLabel)
        await new Promise((r) => setTimeout(r, HOLD_MS))
        setActive(false)
        return result
      } catch (e) {
        cancelAnimationFrame(rafRef.current)
        setPercent(100)
        setLabel('Load failed')
        await new Promise((r) => setTimeout(r, HOLD_MS))
        setActive(false)
        throw e
      }
    },
    [],
  )

  return { active, percent, label, run }
}
