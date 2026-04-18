'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  api,
  useAircraftRegistrations,
  useFeedStatus,
  useMaintenanceEvents,
  useMovementMessageStats,
} from '@skyhub/api'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useDockStore } from '@/lib/dock-store'
import { WorldMapCanvas } from '@/components/world-map/world-map-canvas'
import { OccToolbar } from './occ-toolbar'
import { BandNetworkPulse } from './band-network-pulse'
import { BandDataFeeds } from './band-data-feeds'
import { AirborneCard } from './cards/airborne-card'
import { DeparturesCard } from './cards/departures-card'
import { ArrivalsCard } from './cards/arrivals-card'
import { ExceptionIropsCard } from './cards/exception-irops-card'
import { ExceptionMaintenanceCard } from './cards/exception-maintenance-card'
import { ExceptionCrewCard } from './cards/exception-crew-card'
import { BandHead } from './lib/occ-helpers'
import { useOccFlights, filterFlightsByWindow, type OccWindow } from './use-occ-flights'
import { computeKpis } from './lib/compute-kpis'
import { rollupMaintenance } from './lib/aog-from-maintenance'
import { detectGateConflicts, flightIdsWithConflict } from './lib/detect-gate-conflicts'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

const GRID_STYLE: CSSProperties = {
  gridTemplateColumns: '400px minmax(0, 1fr) 400px',
  gridTemplateRows: 'auto minmax(500px, 1fr)',
  gridTemplateAreas: `
    "top top top"
    "live map excp"
  `,
}

export function OccDashboardShell() {
  const operator = useOperatorStore((s) => s.operator)
  const loaded = useOperatorStore((s) => s.loaded)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const openFlightInfo = useGanttStore((s) => s.openFlightInfo)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!loaded) loadOperator()
  }, [loaded, loadOperator])

  // Always fetch a fresh operator on mount so admin edits (e.g. delay-code
  // adherence) take effect without a hard page reload.
  useEffect(() => {
    api
      .getOperators()
      .then((ops) => {
        if (ops[0]) useOperatorStore.getState().setOperator(ops[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    useDockStore.getState().collapse()
  }, [])

  const [occWindow, setOccWindow] = useState<OccWindow>('today')
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const flightsQ = useOccFlights(operator?._id)
  const aircraftQ = useAircraftRegistrations(operator?._id)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const statsQ = useMovementMessageStats(operator?._id ?? '', { flightDateFrom: today, flightDateTo: today })
  const feedStatusQ = useFeedStatus()
  const maintenanceQ = useMaintenanceEvents({
    operatorId: operator?._id ?? '',
    dateFrom: today,
    dateTo: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  })

  const loading = !operator || flightsQ.isLoading || aircraftQ.isLoading

  const accent = operator?.accentColor ?? '#1e40af'
  const delayStandardLabel = operator?.delayCodeAdherence === 'ahm732' ? 'IATA AHM 732' : 'IATA AHM 730/731'

  const windowed = useMemo(
    () => filterFlightsByWindow(flightsQ.data?.flights ?? [], occWindow),
    [flightsQ.data, occWindow],
  )
  const kpis = useMemo(() => computeKpis(windowed), [windowed])
  const maintenance = useMemo(() => rollupMaintenance(maintenanceQ.data?.rows ?? [], nowMs), [maintenanceQ.data, nowMs])

  const liveOps = useMemo(() => {
    const airborne = windowed.filter((f) => typeof f.atdUtc === 'number' && typeof f.ataUtc !== 'number')
    const departures = windowed
      .filter((f) => f.stdUtc >= nowMs && f.stdUtc <= nowMs + TWO_HOURS_MS && f.status !== 'cancelled')
      .sort((a, b) => a.stdUtc - b.stdUtc)
    const arrivals = windowed
      .filter((f) => f.staUtc >= nowMs && f.staUtc <= nowMs + TWO_HOURS_MS && f.status !== 'cancelled')
      .sort((a, b) => a.staUtc - b.staUtc)
    return {
      airborne,
      departures,
      arrivals,
      depConflictIds: flightIdsWithConflict(detectGateConflicts(departures, 'dep')),
      arrConflictIds: flightIdsWithConflict(detectGateConflicts(arrivals, 'arr')),
    }
  }, [windowed, nowMs])

  const activeAircraft = (aircraftQ.data ?? []).filter((a) => a.status !== 'retired').length
  const availableAircraft = Math.max(0, activeAircraft - maintenance.aogCount - maintenance.inProgressCount)
  const fleet = {
    active: activeAircraft,
    available: availableAircraft,
    aog: maintenance.aogCount,
    maintenance: Math.max(0, maintenance.inProgressCount - maintenance.aogCount),
  }

  return (
    <div
      className="min-h-full flex flex-col"
      style={
        {
          '--occ-accent': accent,
          '--occ-accent-tint': `color-mix(in srgb, ${accent} 14%, transparent)`,
          '--occ-text': 'var(--color-hz-text)',
          '--occ-text-2': 'var(--color-hz-text-secondary)',
          '--occ-text-3': 'color-mix(in srgb, var(--color-hz-text-secondary) 70%, transparent)',
          background:
            'radial-gradient(1200px 700px at 10% -10%, color-mix(in srgb, var(--occ-accent) 8%, transparent), transparent 60%), radial-gradient(900px 500px at 90% 0%, rgba(172,93,217,0.06), transparent 60%)',
        } as CSSProperties
      }
    >
      <OccToolbar
        timezone={operator?.timezone ?? 'UTC'}
        window={occWindow}
        onWindowChange={setOccWindow}
        isFetching={flightsQ.isFetching}
        onRefresh={() => flightsQ.refetch()}
      />

      {loading && <div className="text-[12px] text-[var(--occ-text-3)] px-5 py-1.5">Loading operator data…</div>}

      <main
        className="px-5 pt-1 pb-5 flex flex-col gap-2 xl:grid xl:gap-x-3.5 xl:gap-y-4 xl:min-h-[calc(100vh-72px)] flex-1"
        style={GRID_STYLE}
      >
        <section
          style={{ gridArea: 'top' }}
          className="grid grid-cols-1 xl:grid-cols-[1fr_3fr] gap-3.5 min-w-0 items-stretch"
        >
          <div className="min-w-0 h-full">
            <BandDataFeeds
              acarsCount={statsQ.data?.total ?? 0}
              mvtCount={statsQ.data?.sent ?? 0}
              mvtFailures={(statsQ.data?.failed ?? 0) + (statsQ.data?.rejected ?? 0)}
              outboxPending={(statsQ.data?.held ?? 0) + (statsQ.data?.pending ?? 0)}
              feedStatus={feedStatusQ.data}
            />
          </div>
          <div className="min-w-0 h-full">
            <BandNetworkPulse kpis={kpis} fleet={fleet} />
          </div>
        </section>

        <section style={{ gridArea: 'live' }} className="flex flex-col gap-2.5 min-h-0 min-w-0 xl:overflow-y-auto">
          <BandHead tag="Live Operations · 2.1.1" />
          <AirborneCard flights={liveOps.airborne} nowMs={nowMs} />
          <DeparturesCard flights={liveOps.departures} conflictIds={liveOps.depConflictIds} nowMs={nowMs} />
          <ArrivalsCard flights={liveOps.arrivals} conflictIds={liveOps.arrConflictIds} nowMs={nowMs} />
        </section>

        <section
          style={{ gridArea: 'map' }}
          className="relative rounded-xl overflow-hidden border border-[rgba(17,17,24,0.10)] dark:border-white/10 shadow-[0_1px_3px_rgba(96,97,112,0.10),0_4px_14px_rgba(96,97,112,0.08)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.55)] bg-[#0B0B11] min-h-[450px]"
          aria-label="World Map · 2.1.5"
        >
          <WorldMapCanvas bare isDark={isDark} onFlightClick={(id) => openFlightInfo(id)} />
          <div
            className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-sm border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            aria-hidden
          >
            <span className="w-[3px] h-3.5 rounded-[2px]" style={{ background: 'var(--occ-accent)' }} />
            <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-white/80">World Map · 2.1.5</span>
          </div>
        </section>

        <section style={{ gridArea: 'excp' }} className="flex flex-col gap-2.5 min-h-0 min-w-0 xl:overflow-y-auto">
          <BandHead tag="Exception Queues · 2.1.3" />
          <ExceptionIropsCard flights={windowed} delayStandardLabel={delayStandardLabel} />
          <ExceptionMaintenanceCard maintenance={maintenance} />
          <ExceptionCrewCard />
        </section>
      </main>
    </div>
  )
}
