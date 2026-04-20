'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@skyhub/api'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { usePairingStore } from '@/stores/use-pairing-store'
import { usePairingFilterStore } from '@/stores/use-pairing-filter-store'
import { usePairingGanttStore } from '@/stores/use-pairing-gantt-store'
import { getOperatorId } from '@/stores/use-operator-store'
import { PairingFilterPanel } from '../filter-panel/pairing-filter-panel'
import { PairingGanttToolbar } from '../gantt-view/pairing-gantt-toolbar'
import { PairingGanttCanvas } from '../gantt-view/pairing-gantt-canvas'
import { PairingGanttInspector } from '../gantt-view/gantt-inspector-panel'
import { toGanttFlight, toGanttAircraft, toGanttAircraftType } from '../gantt-view/pairing-flight-adapter'
import { buildMockFlights, buildMockPairings } from '../mocks'
import { pairingFromApi } from '../adapters'
import type { PairingFlight } from '../types'

/** IANA timezone → UTC offset (hours) for *right now*. Accurate enough for
 *  tooltip display — callers don't need historical DST precision. */
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
 * 4.1.5.2 Crew Pairing — Gantt Chart
 *
 * Reuses Movement Control's canvas + layout engine wholesale. Data flow:
 *   1. User hits Go → fetch flight pool + pairings + aircraft regs + aircraft types
 *   2. Convert `PairingFlight`/`AircraftRegistrationRef`/`AircraftTypeRef`
 *      into Movement Control's `GanttFlight`/`GanttAircraft`/`GanttAircraftType`
 *      via `pairing-flight-adapter`
 *   3. Push converted records into `usePairingGanttStore` which triggers
 *      `computeLayout` — the same greedy rotation-block virtual placement
 *      Movement Control uses.
 *   4. Canvas paints via `drawGrid` / `drawGroupHeaders` / `drawBars`,
 *      then overlays the pairing-zone deck on top.
 */
export function PairingGanttShell() {
  const periodCommitted = usePairingStore((s) => s.periodCommitted)
  const setFlights = usePairingStore((s) => s.setFlights)
  const setPairings = usePairingStore((s) => s.setPairings)
  const setLoading = usePairingStore((s) => s.setLoading)
  const setError = usePairingStore((s) => s.setError)
  const setComplements = usePairingStore((s) => s.setComplements)
  const setPositions = usePairingStore((s) => s.setPositions)
  const setStationUtcOffsets = usePairingStore((s) => s.setStationUtcOffsets)

  // Gantt view store — push converted records here to trigger layout.
  const setGanttFlights = usePairingGanttStore((s) => s.setFlights)
  const setGanttAircraft = usePairingGanttStore((s) => s.setAircraft)
  const setGanttAircraftTypes = usePairingGanttStore((s) => s.setAircraftTypes)
  const setGanttPeriod = usePairingGanttStore((s) => s.setPeriod)

  const runway = useRunwayLoading()
  const [inspectorOpen, setInspectorOpen] = useState(true)

  const handleGo = useCallback(async () => {
    await runway.run(
      async () => {
        setLoading(true)
        setError(null)
        const { periodFrom, periodTo, filters } = usePairingStore.getState()
        setGanttPeriod(periodFrom, periodTo)

        try {
          const [flightRows, pairingRows, acRegs, acTypesRaw] = await Promise.all([
            api.getPairingFlightPool({
              dateFrom: periodFrom,
              dateTo: periodTo,
              scenarioId: filters.scenarioId,
              aircraftTypes: filters.aircraftTypes ?? undefined,
              // Gantt view wants overnight bars from the prior day to render
              // on the first visible day. Text view opts out so newly-created
              // pairings never carry a prior-period startDate.
              includeBleed: true,
            }),
            api.getPairings({
              dateFrom: periodFrom,
              dateTo: periodTo,
              scenarioId: filters.scenarioId,
            }),
            api.getAircraftRegistrations(),
            api.getAircraftTypes(),
          ])

          setFlights(flightRows as PairingFlight[])
          setPairings(pairingRows.map(pairingFromApi))

          // Convert into Movement Control shapes and push into the gantt store.
          const typeLookup = new Map(acTypesRaw.map((t) => [t._id, t]))
          setGanttAircraftTypes(acTypesRaw.map(toGanttAircraftType))
          setGanttAircraft(acRegs.map((r) => toGanttAircraft(r, typeLookup)))
          setGanttFlights((flightRows as PairingFlight[]).map(toGanttFlight))
        } catch (err) {
          // Dev fallback so the UI is usable without the real backend.
          const flights = buildMockFlights()
          const pairings = buildMockPairings(flights)
          setFlights(flights)
          setPairings(pairings)
          setGanttFlights(flights.map(toGanttFlight))
          // Mock aircraft: one per unique tail on the mock flights.
          const uniqueTails = Array.from(
            new Map(
              flights
                .filter((f) => f.tailNumber)
                .map((f) => [f.tailNumber, { reg: f.tailNumber as string, type: f.aircraftType }]),
            ).values(),
          )
          setGanttAircraft(
            uniqueTails.map((t, i) => ({
              id: `mock-${i}`,
              registration: t.reg,
              aircraftTypeId: `mock-${t.type}`,
              aircraftTypeIcao: t.type,
              aircraftTypeName: t.type,
              status: 'active',
              homeBaseIcao: null,
              color: null,
              fuelBurnRateKgPerHour: null,
              seatConfig: null,
            })),
          )
          setGanttAircraftTypes(
            Array.from(new Set(flights.map((f) => f.aircraftType))).map((icao, i) => ({
              id: `mock-type-${i}`,
              icaoType: icao,
              name: icao,
              category: 'jet',
              color: null,
              tatDefaultMinutes: null,
              tatDomDom: null,
              tatDomInt: null,
              tatIntDom: null,
              tatIntInt: null,
              fuelBurnRateKgPerHour: null,
            })),
          )
          if (err instanceof Error) setError(`Using mock data: ${err.message}`)
        } finally {
          setLoading(false)
        }
      },
      'Loading Gantt…',
      'Ready',
    )
  }, [
    runway,
    setFlights,
    setPairings,
    setLoading,
    setError,
    setGanttFlights,
    setGanttAircraft,
    setGanttAircraftTypes,
    setGanttPeriod,
  ])

  useEffect(() => {
    const s = usePairingStore.getState()
    usePairingFilterStore.getState().hydrate({ from: s.periodFrom, to: s.periodTo }, s.filters)
    usePairingGanttStore.getState().setPeriod(s.periodFrom, s.periodTo)
  }, [])

  // Load crew complement catalog, position definitions, and the airport
  // offset map once on mount. Mirrors the Text-view shell — drives the
  // complement breakdown in the Pairing Details dialog and hover tooltip
  // plus the STD/STA (Local) rows in the flight tooltip.
  useEffect(() => {
    let cancelled = false
    Promise.all([api.getCrewComplements(getOperatorId()), api.getCrewPositions(getOperatorId()), api.getAirports()])
      .then(([complements, positions, airports]) => {
        if (cancelled) return
        setComplements(complements)
        setPositions(positions)
        // Prefer the explicit `utcOffsetHours` on the airport record; fall
        // back to computing it from the IANA `timezone` string so stations
        // that haven't had the numeric offset seeded still render local time.
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
        console.warn('Failed to load pairing workspace reference data:', err)
      })
    return () => {
      cancelled = true
    }
  }, [setComplements, setPositions, setStationUtcOffsets])

  // Layout is computed by the gantt store once data arrives. We use it as the
  // "ready" signal (matches Movement Control): toolbar + inspector only show
  // after the first successful fetch.
  const layout = usePairingGanttStore((s) => s.layout)
  const hasLayout = !!layout
  const showCanvas = !runway.active && periodCommitted && hasLayout

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <PairingFilterPanel onGo={handleGo} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
        {/* Toolbar — hidden until first successful Go, matching Movement Control */}
        {showCanvas && <PairingGanttToolbar />}

        <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {runway.active ? (
              <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
            ) : showCanvas ? (
              <PairingGanttCanvas />
            ) : (
              <EmptyPanel />
            )}
          </div>

          {/* Inspector only after Go so the empty state gets the full width */}
          {showCanvas && <PairingGanttInspector open={inspectorOpen} onToggle={() => setInspectorOpen((v) => !v)} />}
        </div>
      </div>
    </div>
  )
}
