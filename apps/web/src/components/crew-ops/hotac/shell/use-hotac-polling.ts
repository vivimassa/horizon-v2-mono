'use client'

import { useEffect } from 'react'
import { useHotacStore } from '@/stores/use-hotac-store'

interface Options {
  /** Function called on each tick to re-fetch bookings (skips runway animation). */
  onTick: () => Promise<void> | void
}

/**
 * Polls the HOTAC store on a configurable interval after Go has committed.
 * Pauses when the document is hidden or the user toggled the Refresh button
 * to off. The runway animation is intentionally skipped on tick — the user
 * shouldn't see a full-screen overlay every minute.
 */
export function useHotacPolling({ onTick }: Options) {
  const periodCommitted = useHotacStore((s) => s.periodCommitted)
  const pollingPaused = useHotacStore((s) => s.pollingPaused)
  const intervalMs = useHotacStore((s) => s.pollingIntervalMs)

  useEffect(() => {
    if (!periodCommitted || pollingPaused) return
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        await onTick()
      } catch (err) {
        console.warn('[hotac] poll tick failed', err)
      }
    }

    const id = setInterval(tick, Math.max(15_000, intervalMs))
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [periodCommitted, pollingPaused, intervalMs, onTick])
}
