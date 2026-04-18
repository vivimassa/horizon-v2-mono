'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchGanttFlights } from '@/lib/gantt/api'
import type { GanttApiResponse, GanttFlight } from '@/lib/gantt/types'

export type OccWindow = 'today' | '6h' | '24h'

/** Returns the ISO `YYYY-MM-DD` for the operator's "today" (UTC). */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function utcYesterday(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
}

/** Translate the dashboard's window filter into a `[fromMs, toMs]` slice. */
export function windowBoundsMs(win: OccWindow, now = Date.now()): { fromMs: number; toMs: number } {
  switch (win) {
    case '6h':
      return { fromMs: now - 6 * 60 * 60 * 1000, toMs: now }
    case '24h':
      return { fromMs: now - 24 * 60 * 60 * 1000, toMs: now }
    case 'today':
    default: {
      const startOfToday = Date.UTC(
        new Date(now).getUTCFullYear(),
        new Date(now).getUTCMonth(),
        new Date(now).getUTCDate(),
      )
      return { fromMs: startOfToday, toMs: startOfToday + 24 * 60 * 60 * 1000 }
    }
  }
}

/** Slice the full day's flights down to the active window using STD. */
export function filterFlightsByWindow(flights: GanttFlight[], win: OccWindow): GanttFlight[] {
  const { fromMs, toMs } = windowBoundsMs(win)
  return flights.filter((f) => f.stdUtc >= fromMs && f.stdUtc < toMs)
}

/**
 * One-shot fetch for the OCC Dashboard. Loads yesterday + today so "Last 24h" spans midnight.
 * Refetches every 30s via React Query to keep the dashboard live without polling manually.
 */
export function useOccFlights(operatorId: string | undefined) {
  return useQuery<GanttApiResponse>({
    queryKey: ['occ', 'flights', operatorId ?? ''],
    enabled: !!operatorId,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: () =>
      fetchGanttFlights({
        operatorId: operatorId!,
        from: utcYesterday(),
        to: utcToday(),
        includeOcc: true,
      }),
  })
}
