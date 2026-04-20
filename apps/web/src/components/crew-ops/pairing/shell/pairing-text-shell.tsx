'use client'

import { useCallback, useEffect } from 'react'
import { api } from '@skyhub/api'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { usePairingStore } from '@/stores/use-pairing-store'
import { usePairingFilterStore } from '@/stores/use-pairing-filter-store'
import { getOperatorId } from '@/stores/use-operator-store'
import { PairingFilterPanel } from '../filter-panel/pairing-filter-panel'
import { TextViewLayout } from '../text-view/text-view-layout'
import { buildMockFlights, buildMockPairings } from '../mocks'
import { pairingFromApi } from '../adapters'
import type { PairingFlight } from '../types'

/** IANA timezone → UTC offset (hours) for *right now*. Used as a fallback
 *  when an airport record has null `utcOffsetHours`. */
function offsetFromTz(tz: string): number | null {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
    const y = Number(get('year'))
    const mo = Number(get('month'))
    const d = Number(get('day'))
    let h = Number(get('hour'))
    if (h === 24) h = 0
    const mi = Number(get('minute'))
    const localMs = Date.UTC(y, mo - 1, d, h, mi)
    return Math.round(((localMs - now.getTime()) / 3_600_000) * 100) / 100
  } catch {
    return null
  }
}

/**
 * 4.1.5.1 Crew Pairing — Text-based workspace
 *
 * Layout: left filter panel (shared SkyHub kit) + three-pane body (pairing
 * list | flight pool | inspector). Period + selection are kept in Zustand so
 * they survive navigation to the sibling Gantt / Optimizer views.
 */
export function PairingTextShell() {
  const periodCommitted = usePairingStore((s) => s.periodCommitted)
  const setFlights = usePairingStore((s) => s.setFlights)
  const setPairings = usePairingStore((s) => s.setPairings)
  const setComplements = usePairingStore((s) => s.setComplements)
  const setPositions = usePairingStore((s) => s.setPositions)
  const setLoading = usePairingStore((s) => s.setLoading)
  const setError = usePairingStore((s) => s.setError)
  const runway = useRunwayLoading()

  /** Load flight pool + existing pairings from the real API. Falls back to
   *  mock data if the backend is unreachable so the UI remains usable in
   *  dev without a running server. */
  const handleGo = useCallback(async () => {
    await runway.run(
      async () => {
        setLoading(true)
        setError(null)
        const { periodFrom, periodTo, filters } = usePairingStore.getState()
        try {
          const [flightRows, pairingRows] = await Promise.all([
            api.getPairingFlightPool({
              dateFrom: periodFrom,
              dateTo: periodTo,
              scenarioId: filters.scenarioId,
              aircraftTypes: filters.aircraftTypes ?? undefined,
            }),
            api.getPairings({
              dateFrom: periodFrom,
              dateTo: periodTo,
              scenarioId: filters.scenarioId,
            }),
          ])
          setFlights(flightRows as PairingFlight[])
          setPairings(pairingRows.map(pairingFromApi))
        } catch (err) {
          // Dev fallback: silently fall back to mocks if the server is down or
          // the feature is not yet available for this operator. Real errors
          // still surface via the inspector empty state.
          const flights = buildMockFlights()
          const pairings = buildMockPairings(flights)
          setFlights(flights)
          setPairings(pairings)
          if (err instanceof Error) setError(`Using mock data: ${err.message}`)
        } finally {
          setLoading(false)
        }
      },
      'Loading pairings…',
      'Pairings loaded',
    )
  }, [runway, setFlights, setPairings, setLoading, setError])

  // Hydrate draft filters from the current store state once on mount.
  useEffect(() => {
    const s = usePairingStore.getState()
    usePairingFilterStore.getState().hydrate({ from: s.periodFrom, to: s.periodTo }, s.filters)
  }, [])

  const setStationUtcOffsets = usePairingStore((s) => s.setStationUtcOffsets)

  // Load the crew complement catalog + position columns + airport offset map
  // once. These drive the auto-fill at creation time, the complement panel in
  // the details dialog, and the Gantt/tooltip local-time display — so they
  // need to be present even before the user clicks Go.
  useEffect(() => {
    let cancelled = false
    Promise.all([api.getCrewComplements(getOperatorId()), api.getCrewPositions(getOperatorId()), api.getAirports()])
      .then(([complements, positions, airports]) => {
        if (cancelled) return
        setComplements(complements)
        setPositions(positions)
        const map: Record<string, number> = {}
        for (const a of airports) {
          const offset = a.utcOffsetHours != null ? a.utcOffsetHours : a.timezone ? offsetFromTz(a.timezone) : null
          if (offset == null) continue
          if (a.icaoCode) map[a.icaoCode] = offset
          if (a.iataCode) map[a.iataCode] = offset
        }
        setStationUtcOffsets(map)
      })
      .catch((err) => {
        // Non-fatal — the UI shows "—" for complement counts when missing.
        console.warn('Failed to load pairing workspace reference data:', err)
      })
    return () => {
      cancelled = true
    }
  }, [setComplements, setPositions, setStationUtcOffsets])

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <PairingFilterPanel onGo={handleGo} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {runway.active ? (
          <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
        ) : periodCommitted ? (
          <TextViewLayout />
        ) : (
          <EmptyPanel message="Pick a period and click Go in the filter panel to load the flight pool and existing pairings." />
        )}
      </div>
    </div>
  )
}
