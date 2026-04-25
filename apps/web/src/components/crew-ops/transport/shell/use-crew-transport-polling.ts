'use client'

import { useEffect } from 'react'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'

interface Options {
  onTick: () => Promise<void> | void
}

/**
 * Polls the crew-transport store on a configurable interval after Go has
 * committed. Pauses when the document is hidden or when the user toggled
 * the Refresh button off.
 */
export function useCrewTransportPolling({ onTick }: Options) {
  const periodCommitted = useCrewTransportStore((s) => s.periodCommitted)
  const pollingPaused = useCrewTransportStore((s) => s.pollingPaused)
  const intervalMs = useCrewTransportStore((s) => s.pollingIntervalMs)

  useEffect(() => {
    if (!periodCommitted || pollingPaused) return
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        await onTick()
      } catch (err) {
        console.warn('[crew-transport] poll tick failed', err)
      }
    }

    const id = setInterval(tick, Math.max(15_000, intervalMs))
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [periodCommitted, pollingPaused, intervalMs, onTick])
}
