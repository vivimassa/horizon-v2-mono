'use client'

import { useCallback, useEffect } from 'react'
import { api } from '@skyhub/api'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { usePairingStore } from '@/stores/use-pairing-store'
import { usePairingFilterStore } from '@/stores/use-pairing-filter-store'
import { PairingFilterPanel } from '../filter-panel/pairing-filter-panel'
import { TextViewLayout } from '../text-view/text-view-layout'
import { buildMockFlights, buildMockPairings } from '../mocks'
import { pairingFromApi } from '../adapters'
import type { PairingFlight } from '../types'

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
