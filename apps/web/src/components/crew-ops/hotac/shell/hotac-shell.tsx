'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type OperatorHotacConfig } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useHotacFilterStore } from '@/stores/use-hotac-filter-store'
import { useHotacStore } from '@/stores/use-hotac-store'
import { useHotacEmailStore } from '@/stores/use-hotac-email-store'
import { HotacFilterPanel } from '../filter-panel/hotac-filter-panel'
import { HotacTabBar } from '../toolbar/hotac-tab-bar'
import { HotacRibbonToolbar } from '../toolbar/hotac-ribbon-toolbar'
import { PlanningView } from '../views/planning-view'
import { DayToDayView } from '../views/day-to-day-view'
import { CommunicationView } from '../views/communication-view'
import { BookingInspector } from '../views/booking-inspector'
import { useHotacHotels } from '../use-hotac-hotels'
import { deriveBookings, enlistBookings } from '../data/derive-bookings'
import { detectDisruptions } from '../data/detect-disruptions'
import { fromServerRow, indexBookingsByDetKey, toDerivedRow } from '../data/booking-converters'
import { DEFAULT_LAYOVER_CONFIG, type DerivationMode, type HotacBooking, type LayoverConfig } from '../types'
import { useHotacPolling } from './use-hotac-polling'

/**
 * 4.1.8.1 Crew Hotel Management — top-level shell.
 *
 * Mirrors PairingGanttShell:
 *   1. Pre-Go         → EmptyPanel (SkyHub watermark + hint).
 *   2. Go runs        → RunwayLoadingPanel (3s minimum).
 *   3. Post-Go        → tab bar + ribbon toolbar + view + (optional) inspector.
 *   4. Polling        → re-fetches every 60s without the runway overlay,
 *                       runs detect-disruptions to populate the badge.
 *
 * Phase 1 is pure derivation — no booking persistence. `Fetch` calls
 * `api.getCrewSchedule()` (returns pairings + crew + assignments + positions)
 * plus `api.getCrewHotels()` and merges them into HotacBooking rows.
 */
export function HotacShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const periodCommitted = useHotacStore((s) => s.periodCommitted)
  const commitPeriod = useHotacStore((s) => s.commitPeriod)
  const setBookings = useHotacStore((s) => s.setBookings)
  const setLoading = useHotacStore((s) => s.setLoading)
  const setError = useHotacStore((s) => s.setError)
  const appendDisruptions = useHotacStore((s) => s.appendDisruptions)
  const activeTab = useHotacStore((s) => s.activeTab)
  const selectedBookingId = useHotacStore((s) => s.selectedBookingId)
  const bookings = useHotacStore((s) => s.bookings)

  const runway = useRunwayLoading()

  const { hotelsByIcao, airports, airportByIcao, loading: hotelsLoading, refresh: refreshHotels } = useHotacHotels()

  // Operator config — drives the layover rule. 404 → falls back to compiled
  // defaults so the shell still renders for operators with no doc yet.
  const operator = useOperatorStore((s) => s.operator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  useEffect(() => {
    if (!operatorLoaded) void loadOperator()
  }, [operatorLoaded, loadOperator])

  const [hotacConfig, setHotacConfig] = useState<OperatorHotacConfig | null>(null)
  useEffect(() => {
    if (!operator?._id) return
    let alive = true
    api
      .getOperatorHotacConfig(operator._id)
      .then((doc) => {
        if (alive) setHotacConfig(doc)
      })
      .catch((err) => console.warn('[hotac] failed to load config', err))
    return () => {
      alive = false
    }
  }, [operator?._id])

  const layoverConfig: LayoverConfig = useMemo(
    () =>
      hotacConfig?.layoverRule ? { ...DEFAULT_LAYOVER_CONFIG, ...hotacConfig.layoverRule } : DEFAULT_LAYOVER_CONFIG,
    [hotacConfig],
  )

  // Hold previous bookings snapshot (for detect-disruptions on each tick).
  const prevBookingsRef = useRef(bookings)
  prevBookingsRef.current = bookings

  const fetchAndDerive = useCallback(
    async (mode: DerivationMode): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const { periodFrom, periodTo, filters } = useHotacStore.getState()
        const sched = await api.getCrewSchedule({
          from: periodFrom,
          to: periodTo,
          base: filters.baseAirports && filters.baseAirports.length === 1 ? filters.baseAirports[0] : undefined,
          position: filters.positions && filters.positions.length === 1 ? filters.positions[0] : undefined,
          acType: filters.aircraftTypes && filters.aircraftTypes.length === 1 ? filters.aircraftTypes[0] : undefined,
          crewGroup: filters.crewGroupIds && filters.crewGroupIds.length === 1 ? filters.crewGroupIds[0] : undefined,
        })

        const derived = deriveBookings({
          pairings: sched.pairings,
          crew: sched.crew,
          assignments: sched.assignments,
          positions: sched.positions,
          hotelsByIcao,
          airportByIcao,
          layoverConfig,
          filters,
          mode,
        })

        // Persist (Phase 2): upload derived rows so every HOTAC user sees the
        // same view, then fetch canonical rows back with manual edits merged.
        await api.upsertHotelBookingsBatch({ rows: derived.map(toDerivedRow) })
        const serverRows = await api.getHotelBookings({ from: periodFrom, to: periodTo })

        const localByKey = indexBookingsByDetKey(derived)
        const merged: HotacBooking[] = serverRows.map((r) => fromServerRow(r, { airportByIcao, localByKey }))

        const { disruptions, updated } = detectDisruptions({
          prev: prevBookingsRef.current,
          next: merged,
        })
        setBookings(updated, disruptions)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch'
        setError(msg)
        console.error('[hotac] fetch failed', err)
      } finally {
        setLoading(false)
      }
    },
    [hotelsByIcao, airportByIcao, layoverConfig, setBookings, setLoading, setError],
  )

  const handleGo = useCallback(async () => {
    commitPeriod()
    const mode: DerivationMode = activeTab === 'dayToDay' ? 'dayToDay' : 'planning'
    await runway.run(() => fetchAndDerive(mode), 'Loading hotel demand…', 'Loaded')
  }, [runway, fetchAndDerive, activeTab, commitPeriod])

  const handleFetch = useCallback(async () => {
    const mode: DerivationMode = activeTab === 'dayToDay' ? 'dayToDay' : 'planning'
    await fetchAndDerive(mode)
    void refreshHotels()
  }, [fetchAndDerive, activeTab, refreshHotels])

  const handleEnlist = useCallback(async () => {
    const cur = useHotacStore.getState().bookings
    // Optimistically flip status locally.
    const optimistic = enlistBookings(cur)
    setBookings(optimistic, [])
    // Persist by patching only rows that were in 'demand' state.
    const toPatch = cur.filter((b) => b.status === 'demand')
    try {
      await Promise.all(toPatch.map((b) => api.patchHotelBooking(b.id, { status: 'forecast' })))
    } catch (err) {
      console.warn('[hotac] enlist failed', err)
    }
  }, [setBookings])

  const handleExport = useCallback(() => {
    const rows = useHotacStore.getState().bookings
    const headers = ['Station', 'Night', 'Pairing', 'Pax', 'Hotel', 'Rooms', 'Status', 'Cost', 'Currency']
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.airportIcao,
          new Date(r.layoverNightUtcMs).toISOString().slice(0, 10),
          r.pairingCode,
          r.pax,
          r.hotel?.name ?? '',
          r.rooms,
          r.status,
          r.cost,
          r.costCurrency,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hotac-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Polling — fires every 60s after Go. Reads canonical rows from the server
  // without re-deriving (so manual edits done by other HOTAC users propagate).
  // Crew names persist via the local-snapshot cache populated by the last Fetch.
  useHotacPolling({
    onTick: useCallback(async () => {
      const { periodFrom, periodTo } = useHotacStore.getState()
      try {
        const serverRows = await api.getHotelBookings({ from: periodFrom, to: periodTo })
        const localByKey = indexBookingsByDetKey(prevBookingsRef.current)
        const merged: HotacBooking[] = serverRows.map((r) => fromServerRow(r, { airportByIcao, localByKey }))
        const { disruptions, updated } = detectDisruptions({
          prev: prevBookingsRef.current,
          next: merged,
        })
        setBookings(updated, [])
        if (disruptions.length > 0) appendDisruptions(disruptions)
      } catch (err) {
        console.warn('[hotac] poll failed', err)
      }
    }, [airportByIcao, setBookings, appendDisruptions]),
  })

  const showWorkArea = !runway.active && periodCommitted
  const inspectorOpen = useMemo(
    () => !!selectedBookingId && activeTab !== 'communication',
    [selectedBookingId, activeTab],
  )

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <HotacFilterPanel airports={airports} onGo={handleGo} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {/* Toolbar — only after first successful Go */}
        {showWorkArea && (
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <HotacTabBar />
            <HotacRibbonToolbar
              onFetch={handleFetch}
              onEnlist={handleEnlist}
              onToggleStatusPanel={() => {
                /* Phase 2 wires status side-panel */
              }}
              onCycleGroupBy={() => {
                /* Phase 2 wires grouping cycles */
              }}
              onCycleDensity={() => {
                /* Phase 2 wires density toggle */
              }}
              onExport={handleExport}
              onOpenDisruptions={() => {
                /* Phase 2 — disruptions side panel */
              }}
              onOpenCheckIn={() => {
                /* Phase 2 — check-in monitor */
              }}
              onOpenIncoming={() => {
                useHotacStore.getState().setActiveTab('communication')
                useHotacEmailStore.getState().setFolder('incoming')
              }}
              onOpenOutgoing={() => {
                useHotacStore.getState().setActiveTab('communication')
                useHotacEmailStore.getState().setFolder('outgoing')
              }}
              onComposeHeld={() => {
                useHotacStore.getState().setActiveTab('communication')
                useHotacEmailStore.getState().setFolder('held')
                useHotacEmailStore.getState().openCompose('new')
              }}
              onReleaseSelected={async () => {
                const ids = Array.from(useHotacEmailStore.getState().selectedIds)
                if (ids.length === 0) return
                try {
                  await api.releaseHotelEmails(ids)
                  useHotacEmailStore.getState().clearSelection()
                  // Force a refresh by toggling folder.
                  const cur = useHotacEmailStore.getState().folder
                  useHotacEmailStore.getState().setFolder(cur)
                } catch (err) {
                  console.warn('[hotac] bulk release failed', err)
                }
              }}
              onDiscardSelected={async () => {
                const ids = Array.from(useHotacEmailStore.getState().selectedIds)
                if (ids.length === 0) return
                try {
                  await api.discardHotelEmails(ids)
                  useHotacEmailStore.getState().clearSelection()
                  const cur = useHotacEmailStore.getState().folder
                  useHotacEmailStore.getState().setFolder(cur)
                } catch (err) {
                  console.warn('[hotac] bulk discard failed', err)
                }
              }}
            />
          </div>
        )}

        <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">
          <div
            className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            {runway.active ? (
              <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
            ) : !periodCommitted ? (
              <EmptyPanel
                message={
                  hotelsLoading ? 'Loading hotel master data…' : 'Select a period and click Go to load hotel demand'
                }
              />
            ) : (
              <>
                {activeTab === 'planning' && <PlanningView />}
                {activeTab === 'dayToDay' && <DayToDayView />}
                {activeTab === 'communication' && <CommunicationView />}
              </>
            )}
          </div>

          {inspectorOpen && <BookingInspector />}
        </div>
      </div>
    </div>
  )
}
