'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type AirportRef, type CrewTransportVendorRef, type OperatorHotacConfig } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { useTransportEmailStore } from '@/stores/use-transport-email-store'
import { CrewTransportFilterPanel } from '../filter-panel/crew-transport-filter-panel'
import { CrewTransportSegmentToggle } from '../toolbar/crew-transport-segment-toggle'
import { CrewTransportTabBar } from '../toolbar/crew-transport-tab-bar'
import { CrewTransportRibbonToolbar } from '../toolbar/crew-transport-ribbon-toolbar'
import { GroundPlanningView } from '../views/ground-planning-view'
import { GroundDayToDayView } from '../views/ground-day-to-day-view'
import { GroundCommunicationView } from '../views/ground-communication-view'
import { FlightOpenView } from '../views/flight-open-view'
import { FlightBookedView } from '../views/flight-booked-view'
import { TripInspector } from '../views/trip-inspector'
import { deriveTrips, indexVendorsByIcao } from '../data/derive-trips'
import { fromServerRow, indexTripsByDetKey, indexVendorsById, toDerivedRow } from '../data/trip-converters'
import { DEFAULT_TRANSPORT_CONFIG, type DerivationMode, type TransportConfig, type TransportTrip } from '../types'
import { useCrewTransportPolling } from './use-crew-transport-polling'

/**
 * 4.1.8.2 Crew Transport — top-level shell.
 *
 * Phase C wires Ground transport end-to-end:
 *   1. Pre-Go        → EmptyPanel.
 *   2. Go            → RunwayLoadingPanel + fetch crew-schedule + derive trips
 *                       + upsert-batch + read canonical rows.
 *   3. Post-Go       → segment toggle + tab bar + ribbon + active view.
 *   4. Polling       → 60s tick refetches canonical trips (no runway).
 */
export function CrewTransportShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const periodCommitted = useCrewTransportStore((s) => s.periodCommitted)
  const commitPeriod = useCrewTransportStore((s) => s.commitPeriod)
  const setLoading = useCrewTransportStore((s) => s.setLoading)
  const setError = useCrewTransportStore((s) => s.setError)
  const setTrips = useCrewTransportStore((s) => s.setTrips)
  const setPairings = useCrewTransportStore((s) => s.setPairings)
  const setFlightBookings = useCrewTransportStore((s) => s.setFlightBookings)
  const segment = useCrewTransportStore((s) => s.segment)
  const groundTab = useCrewTransportStore((s) => s.groundTab)
  const flightTab = useCrewTransportStore((s) => s.flightTab)
  const trips = useCrewTransportStore((s) => s.trips)
  const selectedTripId = useCrewTransportStore((s) => s.selectedTripId)

  const runway = useRunwayLoading()

  const [airports, setAirports] = useState<AirportRef[]>([])
  const [vendors, setVendors] = useState<CrewTransportVendorRef[]>([])
  const [referenceLoading, setReferenceLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([api.getAirports(), api.getCrewTransportVendors()])
      .then(([a, v]) => {
        if (!alive) return
        setAirports(a)
        setVendors(v)
      })
      .catch((err) => console.warn('[crew-transport] failed to load reference data', err))
      .finally(() => {
        if (alive) setReferenceLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  // Operator config — drives the (future) transport block + reuses HOTAC's
  // email config for held/release defaults.
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
      .catch((err) => console.warn('[crew-transport] failed to load config', err))
    return () => {
      alive = false
    }
  }, [operator?._id])

  const transportConfig: TransportConfig = useMemo(() => {
    // Phase E populates `config.transport`. Until then we use compiled
    // defaults so the shell renders for operators without a doc.
    const t = (hotacConfig as unknown as { transport?: Partial<TransportConfig> } | null)?.transport
    return t ? { ...DEFAULT_TRANSPORT_CONFIG, ...t } : DEFAULT_TRANSPORT_CONFIG
  }, [hotacConfig])

  const vendorsByIcao = useMemo(() => indexVendorsByIcao(vendors), [vendors])
  const vendorById = useMemo(() => indexVendorsById(vendors), [vendors])

  const prevTripsRef = useRef(trips)
  prevTripsRef.current = trips

  const fetchAndDerive = useCallback(
    async (mode: DerivationMode): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const { periodFrom, periodTo, filters } = useCrewTransportStore.getState()
        const sched = await api.getCrewSchedule({
          from: periodFrom,
          to: periodTo,
          base: filters.baseAirports && filters.baseAirports.length === 1 ? filters.baseAirports[0] : undefined,
          position: filters.positions && filters.positions.length === 1 ? filters.positions[0] : undefined,
          acType: filters.aircraftTypes && filters.aircraftTypes.length === 1 ? filters.aircraftTypes[0] : undefined,
          crewGroup: filters.crewGroupIds && filters.crewGroupIds.length === 1 ? filters.crewGroupIds[0] : undefined,
        })

        const derived = deriveTrips({
          pairings: sched.pairings,
          crew: sched.crew,
          assignments: sched.assignments,
          vendorsByIcao,
          config: transportConfig,
          filters,
          mode,
        })

        // Persist derived rows so multiple HOTAC users see the same view, then
        // pull canonical rows back with manual edits merged in.
        const tripsWithPairing = derived.filter((t) => t.pairingId != null)
        if (tripsWithPairing.length > 0) {
          await api.upsertCrewTransportTripsBatch({ rows: tripsWithPairing.map(toDerivedRow) })
        }
        const serverRows = await api.getCrewTransportTrips({ from: periodFrom, to: periodTo })

        const localByKey = indexTripsByDetKey(derived)
        const merged: TransportTrip[] = serverRows.map((r) => fromServerRow(r, { localByKey, vendorById }))
        setTrips(merged)

        // Cache pairings (Flight views use them) + load flight bookings.
        setPairings(sched.pairings)
        try {
          const bookings = await api.getCrewFlightBookings({ from: periodFrom, to: periodTo })
          setFlightBookings(bookings)
        } catch (e) {
          console.warn('[crew-transport] flight bookings load failed', e)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch'
        setError(msg)
        console.error('[crew-transport] fetch failed', err)
      } finally {
        setLoading(false)
      }
    },
    [vendorsByIcao, vendorById, transportConfig, setLoading, setError, setTrips, setPairings, setFlightBookings],
  )

  const handleGo = useCallback(async () => {
    commitPeriod()
    const mode: DerivationMode = groundTab === 'dayToDay' ? 'dayToDay' : 'planning'
    await runway.run(() => fetchAndDerive(mode), 'Loading transport demand…', 'Loaded')
  }, [runway, fetchAndDerive, groundTab, commitPeriod])

  const handleFetch = useCallback(async () => {
    const mode: DerivationMode = groundTab === 'dayToDay' ? 'dayToDay' : 'planning'
    await fetchAndDerive(mode)
  }, [fetchAndDerive, groundTab])

  const handleExport = useCallback(() => {
    const rows = useCrewTransportStore.getState().trips
    const headers = ['Date', 'Time', 'Type', 'Pairing', 'Pax', 'Vendor', 'Vehicle', 'Status', 'Cost', 'Currency']
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push(
        [
          new Date(r.scheduledTimeUtcMs).toISOString().slice(0, 10),
          new Date(r.scheduledTimeUtcMs).toISOString().slice(11, 16),
          r.tripType,
          r.pairingCode,
          r.paxCount,
          r.vendor?.name ?? '',
          r.vendor?.vehicleTierName ?? '',
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
    a.download = `crew-transport-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const openComposeForSelected = useCallback(() => {
    useCrewTransportStore.getState().setSegment('ground')
    useCrewTransportStore.getState().setGroundTab('communication')
    useTransportEmailStore.getState().setFolder('held')
    useTransportEmailStore.getState().openCompose('new')
  }, [])

  // Polling — refetch canonical rows every minute, merge against last local snapshot.
  useCrewTransportPolling({
    onTick: useCallback(async () => {
      const { periodFrom, periodTo } = useCrewTransportStore.getState()
      try {
        const serverRows = await api.getCrewTransportTrips({ from: periodFrom, to: periodTo })
        const localByKey = indexTripsByDetKey(prevTripsRef.current)
        const merged: TransportTrip[] = serverRows.map((r) => fromServerRow(r, { localByKey, vendorById }))
        setTrips(merged)
      } catch (err) {
        console.warn('[crew-transport] poll failed', err)
      }
    }, [vendorById, setTrips]),
  })

  const showWorkArea = !runway.active && periodCommitted
  const inspectorOpen = useMemo(
    () => !!selectedTripId && segment === 'ground' && groundTab !== 'communication',
    [selectedTripId, segment, groundTab],
  )

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <CrewTransportFilterPanel airports={airports} vendors={vendors} onGo={handleGo} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {showWorkArea && (
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <CrewTransportSegmentToggle />
            <CrewTransportTabBar />
            <CrewTransportRibbonToolbar
              onFetch={handleFetch}
              onBatch={handleFetch}
              onAutoAssign={handleFetch}
              onDispatch={() => undefined}
              onPickedUp={() => undefined}
              onCompleted={() => undefined}
              onNoShow={() => undefined}
              onTrack={() => undefined}
              onDisruption={() => undefined}
              onToggleStatusPanel={() => undefined}
              onCycleGroupBy={() => undefined}
              onCycleDensity={() => undefined}
              onExport={handleExport}
              onOpenIncoming={() => {
                useCrewTransportStore.getState().setGroundTab('communication')
                useTransportEmailStore.getState().setFolder('incoming')
              }}
              onOpenOutgoing={() => {
                useCrewTransportStore.getState().setGroundTab('communication')
                useTransportEmailStore.getState().setFolder('outgoing')
              }}
              onComposeHeld={openComposeForSelected}
              onReleaseSelected={async () => {
                const ids = Array.from(useTransportEmailStore.getState().selectedIds)
                if (ids.length === 0) return
                try {
                  await api.releaseTransportEmails(ids)
                  useTransportEmailStore.getState().clearSelection()
                  const cur = useTransportEmailStore.getState().folder
                  useTransportEmailStore.getState().setFolder(cur)
                } catch (err) {
                  console.warn('[crew-transport] bulk release failed', err)
                }
              }}
              onDiscardSelected={async () => {
                const ids = Array.from(useTransportEmailStore.getState().selectedIds)
                if (ids.length === 0) return
                try {
                  await api.discardTransportEmails(ids)
                  useTransportEmailStore.getState().clearSelection()
                  const cur = useTransportEmailStore.getState().folder
                  useTransportEmailStore.getState().setFolder(cur)
                } catch (err) {
                  console.warn('[crew-transport] bulk discard failed', err)
                }
              }}
              onBookFlight={() => {
                useCrewTransportStore.getState().setSegment('flight')
                useCrewTransportStore.getState().setFlightTab('open')
              }}
              onReplaceTicket={() => {
                useCrewTransportStore.getState().setSegment('flight')
                useCrewTransportStore.getState().setFlightTab('booked')
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
                  referenceLoading
                    ? 'Loading vendors and airports…'
                    : 'Select a period and click Go to load transport demand'
                }
              />
            ) : segment === 'ground' ? (
              groundTab === 'planning' ? (
                <GroundPlanningView />
              ) : groundTab === 'dayToDay' ? (
                <GroundDayToDayView />
              ) : (
                <GroundCommunicationView vendors={vendors} />
              )
            ) : flightTab === 'open' ? (
              <FlightOpenView />
            ) : flightTab === 'booked' ? (
              <FlightBookedView mode="booked" />
            ) : (
              <FlightBookedView mode="history" />
            )}
          </div>

          {inspectorOpen && <TripInspector />}
        </div>
      </div>
    </div>
  )
}
