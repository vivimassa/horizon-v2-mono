'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileDown, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import {
  api,
  setApiBaseUrl,
  type AirportRef,
  type AircraftTypeRef,
  type CityPairRef,
  type ScheduledFlightRef,
} from '@skyhub/api'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { usePublicTimetableStore } from '@/stores/use-public-timetable-store'
import {
  aggregateRouteStats,
  buildTimetableFlight,
  filterScheduledFlights,
  type TimetableFlight,
} from '@/lib/public-timetable/logic'
import { exportCsv, exportPdf, exportXlsx } from '@/lib/public-timetable/export'
import { PublicTimetableFilterPanel } from './public-timetable-filter-panel'
import { PublicTimetableTicket } from './public-timetable-ticket'
import { PublicTimetableStub } from './public-timetable-stub'
import { PublicTimetableFlightRow } from './public-timetable-flight-row'

setApiBaseUrl('http://localhost:3002')

export function PublicTimetableShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const runway = useRunwayLoading()
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const operator = useOperatorStore((s) => s.operator)

  const committed = usePublicTimetableStore((s) => s.committed)

  const [airports, setAirports] = useState<AirportRef[]>([])
  const [aircraftTypes, setAircraftTypes] = useState<AircraftTypeRef[]>([])
  const [cityPairs, setCityPairs] = useState<CityPairRef[]>([])
  const [patterns, setPatterns] = useState<ScheduledFlightRef[] | null>(null)

  useEffect(() => {
    loadOperator()
  }, [loadOperator])

  useEffect(() => {
    if (!operatorLoaded) return
    const opId = getOperatorId()
    Promise.all([api.getAirports(), api.getAircraftTypes(opId), api.getCityPairs(opId)])
      .then(([ap, ac, cp]) => {
        setAirports(ap)
        setAircraftTypes(ac)
        setCityPairs(cp)
      })
      .catch((e) => console.error('Failed to load ref data', e))
  }, [operatorLoaded])

  const airportMap = useMemo(() => {
    const m = new Map<string, AirportRef>()
    for (const a of airports) {
      if (a.iataCode) m.set(a.iataCode.toUpperCase(), a)
      if (a.icaoCode) m.set(a.icaoCode.toUpperCase(), a)
    }
    return m
  }, [airports])

  const aircraftTypeMap = useMemo(() => {
    const m = new Map<string, AircraftTypeRef>()
    for (const t of aircraftTypes) {
      if (t.icaoType) m.set(t.icaoType.toUpperCase(), t)
    }
    return m
  }, [aircraftTypes])

  const { outbound, returnLeg } = useMemo(() => {
    if (!committed || !patterns) return { outbound: [] as TimetableFlight[], returnLeg: [] as TimetableFlight[] }
    const { outbound: out, return: ret } = filterScheduledFlights(patterns, {
      dateFrom: committed.dateFrom,
      dateTo: committed.dateTo,
      from: committed.from,
      to: committed.to,
      direction: committed.direction,
      effectiveDate: committed.effectiveDate || undefined,
    })
    const sortFn = (a: TimetableFlight, b: TimetableFlight) => a.stdUtc.localeCompare(b.stdUtc)
    const outboundFlights = out
      .map((sf) => buildTimetableFlight(sf, airportMap, aircraftTypeMap, 'outbound'))
      .sort(sortFn)
    const returnFlights = ret.map((sf) => buildTimetableFlight(sf, airportMap, aircraftTypeMap, 'return')).sort(sortFn)
    return { outbound: outboundFlights, returnLeg: returnFlights }
  }, [committed, patterns, airportMap, aircraftTypeMap])

  const outboundStats = useMemo(() => aggregateRouteStats(outbound), [outbound])

  const fromAirport = committed ? airportMap.get(committed.from.toUpperCase()) : undefined
  const toAirport = committed ? airportMap.get(committed.to.toUpperCase()) : undefined

  const handleGo = useCallback(async () => {
    try {
      const data = await runway.run(
        async () => {
          const opId = getOperatorId()
          return api.getScheduledFlights({ operatorId: opId, status: 'active' })
        },
        'Loading timetable...',
        'Timetable ready',
      )
      if (data) setPatterns(data)
    } catch (e) {
      console.error('Failed to load scheduled flights', e)
    }
  }, [runway])

  const handleExport = useCallback(
    (format: 'csv' | 'xlsx' | 'pdf') => {
      if (!committed) return
      const flights = [...outbound, ...returnLeg]
      const ctx = {
        flights,
        periodFrom: committed.dateFrom,
        periodTo: committed.dateTo,
        operatorName: operator?.name ?? 'SkyHub Aviation',
        fromCity: fromAirport?.city ?? committed.from,
        toCity: toAirport?.city ?? committed.to,
      }
      if (format === 'csv') exportCsv(ctx)
      else if (format === 'xlsx') void exportXlsx(ctx)
      else void exportPdf(ctx)
    },
    [committed, outbound, returnLeg, operator, fromAirport, toAirport],
  )

  let content: React.ReactNode
  if (runway.active) {
    content = <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
  } else if (!committed || !patterns) {
    content = <EmptyPanel message="Choose period, origin & destination, then click Go to load the public timetable" />
  } else {
    const total = outbound.length + returnLeg.length
    content = (
      <div className="flex-1 flex flex-col gap-4 min-h-0 min-w-0">
        {/* Frozen region — stays visible while flights scroll */}
        <div className="shrink-0 flex gap-4 relative" style={{ height: 280 }}>
          <div className="flex-1 min-w-0 h-full">
            <PublicTimetableTicket
              operatorName={operator?.name ?? 'SkyHub Aviation'}
              fromCode={committed.from}
              toCode={committed.to}
              fromCity={fromAirport?.city ?? committed.from}
              toCity={toAirport?.city ?? committed.to}
              fromUtcOffset={fromAirport?.utcOffsetHours ?? 0}
              toUtcOffset={toAirport?.utcOffsetHours ?? 0}
              stats={outboundStats}
            />
          </div>
          <div className="shrink-0 h-full">
            <PublicTimetableStub
              operatorName={operator?.name ?? 'SkyHub Aviation'}
              fromCode={committed.from}
              toCode={committed.to}
              effectiveFrom={committed.dateFrom}
              stats={outboundStats}
            />
          </div>

          <ExportMenu onExport={handleExport} isDark={isDark} />
        </div>

        {/* Scrolling region — only the flight list moves */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4">
          {outbound.length > 0 && <FlightsSection title={`${committed.from} → ${committed.to}`} flights={outbound} />}
          {returnLeg.length > 0 && <FlightsSection title={`${committed.to} → ${committed.from}`} flights={returnLeg} />}

          {total === 0 && (
            <div className="flex-1 flex items-center justify-center py-16">
              <EmptyPanel message="No active flights match the selected filters" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      <PublicTimetableFilterPanel airports={airports} cityPairs={cityPairs} onGo={handleGo} loading={runway.active} />
      {content}
    </div>
  )
}

function ExportMenu({ onExport, isDark }: { onExport: (format: 'csv' | 'xlsx' | 'pdf') => void; isDark: boolean }) {
  const [open, setOpen] = useState(false)
  const glassBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.28)'

  return (
    <div className="absolute top-3 right-3 z-30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold text-white hover:bg-white/10 transition-colors"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${glassBorder}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Download size={13} />
        Export
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] rounded-xl overflow-hidden z-50"
          style={{
            background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.98)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
            boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
            minWidth: 160,
          }}
        >
          <ExportItem
            icon={<FileText size={13} />}
            label="CSV"
            onClick={() => {
              setOpen(false)
              onExport('csv')
            }}
          />
          <ExportItem
            icon={<FileSpreadsheet size={13} />}
            label="Excel (.xlsx)"
            onClick={() => {
              setOpen(false)
              onExport('xlsx')
            }}
          />
          <ExportItem
            icon={<FileDown size={13} />}
            label="PDF"
            onClick={() => {
              setOpen(false)
              onExport('pdf')
            }}
          />
        </div>
      )}
    </div>
  )
}

function ExportItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-hz-text hover:bg-hz-border/30 transition-colors text-left"
    >
      {icon}
      {label}
    </button>
  )
}

function FlightsSection({ title, flights }: { title: string; flights: TimetableFlight[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 pl-1">
        <span className="w-[3px] h-4 rounded-sm" style={{ background: 'var(--module-accent, #2563eb)' }} aria-hidden />
        <h2 className="text-[15px] font-bold text-hz-text">{title}</h2>
        <span className="text-[13px] font-medium text-hz-text-tertiary">· {flights.length} flights</span>
      </div>
      <div className="flex flex-col gap-2">
        {flights.map((f) => (
          <PublicTimetableFlightRow key={f.id} flight={f} />
        ))}
      </div>
    </div>
  )
}
