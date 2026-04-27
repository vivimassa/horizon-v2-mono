'use client'

import { useState, useRef, useCallback } from 'react'

const DEFAULT_EXPECTED_MS = 8000
const HOLD_MS = 600
const HISTORY_SAMPLES = 5

interface RunOptions {
  loadingLabel?: string
  doneLabel?: string
  /**
   * Expected duration in ms. Shapes the asymptote so the bar reads
   * ~90% near this mark, but keeps creeping toward 99% if the actual
   * load takes longer (no more "stuck at 90%" complaints).
   */
  expectedMs?: number
  /**
   * Stable key (e.g. "crew-schedule"). When set, the hook persists a
   * moving median of the last few real durations in localStorage and
   * uses that as expectedMs on the next run. Self-calibrates per
   * operator dataset size.
   */
  loadKey?: string
}

interface RunwayLoadingState {
  active: boolean
  percent: number
  label: string
  run: <T>(
    fn: () => Promise<T>,
    loadingLabelOrOptions?: string | RunOptions,
    doneLabel?: string,
  ) => Promise<T | undefined>
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getStoredMedian(key: string, fallback: number): number {
  const ls = safeStorage()
  if (!ls) return fallback
  try {
    const raw = ls.getItem(`runway-load:${key}`)
    if (!raw) return fallback
    const arr = JSON.parse(raw) as number[]
    if (!Array.isArray(arr) || arr.length === 0) return fallback
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  } catch {
    return fallback
  }
}

function pushDuration(key: string, ms: number) {
  const ls = safeStorage()
  if (!ls) return
  try {
    const raw = ls.getItem(`runway-load:${key}`)
    const arr = raw ? (JSON.parse(raw) as number[]) : []
    arr.push(ms)
    while (arr.length > HISTORY_SAMPLES) arr.shift()
    ls.setItem(`runway-load:${key}`, JSON.stringify(arr))
  } catch {
    // localStorage write failed (quota / private mode) — non-fatal.
  }
}

function normalizeOptions(
  loadingLabelOrOptions: string | RunOptions | undefined,
  doneLabel: string | undefined,
): Required<Pick<RunOptions, 'loadingLabel' | 'doneLabel' | 'expectedMs'>> & { loadKey?: string } {
  if (typeof loadingLabelOrOptions === 'object' && loadingLabelOrOptions !== null) {
    return {
      loadingLabel: loadingLabelOrOptions.loadingLabel ?? 'Loading…',
      doneLabel: loadingLabelOrOptions.doneLabel ?? 'Complete',
      expectedMs: loadingLabelOrOptions.expectedMs ?? DEFAULT_EXPECTED_MS,
      loadKey: loadingLabelOrOptions.loadKey,
    }
  }
  return {
    loadingLabel: loadingLabelOrOptions ?? 'Loading…',
    doneLabel: doneLabel ?? 'Complete',
    expectedMs: DEFAULT_EXPECTED_MS,
  }
}

export function useRunwayLoading(): RunwayLoadingState {
  const [active, setActive] = useState(false)
  const [percent, setPercent] = useState(0)
  const [label, setLabel] = useState('')
  const rafRef = useRef(0)

  const run = useCallback(
    async <T>(
      fn: () => Promise<T>,
      loadingLabelOrOptions?: string | RunOptions,
      doneLabel?: string,
    ): Promise<T | undefined> => {
      const opts = normalizeOptions(loadingLabelOrOptions, doneLabel)
      const expectedMs = opts.loadKey ? getStoredMedian(opts.loadKey, opts.expectedMs) : opts.expectedMs

      setActive(true)
      setPercent(0)
      setLabel(opts.loadingLabel)

      // Asymptotic curve: percent = 100 * (1 - exp(-elapsed / tau))
      // tau chosen so percent ≈ 90% at expectedMs (since 1 - exp(-2.3) ≈ 0.9).
      // Always clamped at 99% so the bar still reads "almost done" even
      // when the real load runs 5× longer than expected — never freezes.
      const tau = expectedMs / 2.3
      const startTime = performance.now()
      const advance = (now: number) => {
        const elapsed = now - startTime
        const p = 100 * (1 - Math.exp(-elapsed / tau))
        setPercent(Math.min(p, 99))
        rafRef.current = requestAnimationFrame(advance)
      }
      rafRef.current = requestAnimationFrame(advance)

      try {
        const result = await fn()
        const actualMs = performance.now() - startTime
        if (opts.loadKey) pushDuration(opts.loadKey, actualMs)
        cancelAnimationFrame(rafRef.current)
        setPercent(100)
        setLabel(opts.doneLabel)
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
