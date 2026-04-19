'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { api } from '@skyhub/api'
import type { AircraftTypeRef } from '@skyhub/api'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useFrequencyAnalysisStore } from '@/stores/use-frequency-analysis-store'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import {
  applyFilters,
  bucketByPattern,
  buildDayStats,
  computeDetailRoutes,
  computeDowDistribution,
  computeHeatmapMax,
  computeKpis,
  dedupFlights,
  emptyKpis,
  expandScheduledFlightsToRows,
} from './compute-frequency'
import { FrequencyAnalysisFilterPanel } from './frequency-analysis-filter-panel'
import { FrequencyAnalysisToolbar } from './frequency-analysis-toolbar'
import { FrequencyAnalysisPatternChart } from './frequency-analysis-pattern-chart'
import { FrequencyAnalysisHeatmap } from './frequency-analysis-heatmap'
import { FrequencyAnalysisRouteTable } from './frequency-analysis-route-table'
import { exportCsv, exportPdf, exportXlsx } from '@/lib/frequency-analysis-export'

/**
 * Fallback colors when an aircraft type has no DB color configured. Curated
 * SkyHub-family palette — cool blues → teals → violets → amber — so multiple
 * stacked types read as a harmonious gradient rather than clashing primaries.
 * The pattern chart renders each hex as a soft vertical gradient.
 */
const FALLBACK_PALETTE = [
  '#3E7BFA', // SkyHub accent blue
  '#5B8DEF', // accent light
  '#00A6FB', // info cyan
  '#00CFDE', // teal
  '#2DD4BF', // aqua
  '#AC5DD9', // violet
  '#8B5CF6', // indigo violet
  '#F59E0B', // amber
  '#FF8800', // XD warning
  '#64748B', // slate (neutral anchor)
]

function hashIndex(s: string, mod: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % mod
}

function buildTypeColorMap(types: AircraftTypeRef[], seen: string[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of types) if (t.color) m.set(t.icaoType, t.color)
  for (const code of seen) {
    if (!m.has(code)) m.set(code, FALLBACK_PALETTE[hashIndex(code, FALLBACK_PALETTE.length)])
  }
  return m
}

export function FrequencyAnalysisShell() {
  const runway = useRunwayLoading()

  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const operatorName = useOperatorStore((s) => s.operator?.name ?? 'SkyHub')
  const dateFormat = useOperatorStore((s) => s.dateFormat)

  const loadRefData = useScheduleRefStore((s) => s.loadAll)
  const refLoaded = useScheduleRefStore((s) => s.loaded)
  const aircraftTypes = useScheduleRefStore((s) => s.aircraftTypes)

  const rawRows = useFrequencyAnalysisStore((s) => s.rawRows)
  const hasLoaded = useFrequencyAnalysisStore((s) => s.hasLoaded)
  const committed = useFrequencyAnalysisStore((s) => s.committed)
  const setRawRows = useFrequencyAnalysisStore((s) => s.setRawRows)
  const setHasLoaded = useFrequencyAnalysisStore((s) => s.setHasLoaded)
  const commitFilters = useFrequencyAnalysisStore((s) => s.commitFilters)
  const setAcTypeColors = useFrequencyAnalysisStore((s) => s.setAcTypeColors)
  const acTypeColors = useFrequencyAnalysisStore((s) => s.acTypeColors)

  useEffect(() => {
    loadOperator()
  }, [loadOperator])
  useEffect(() => {
    if (operatorLoaded && !refLoaded) loadRefData()
  }, [operatorLoaded, refLoaded, loadRefData])

  // Keep color map in sync with whichever types appear in rawRows. Uses DB
  // colors where available, falls back to a deterministic palette so the same
  // ICAO code always renders with the same swatch.
  useEffect(() => {
    const seenTypes = new Set<string>()
    for (const r of rawRows) if (r.icaoType) seenTypes.add(r.icaoType)
    setAcTypeColors(buildTypeColorMap(aircraftTypes, [...seenTypes]))
  }, [rawRows, aircraftTypes, setAcTypeColors])

  /* ── Derived views (all memoised) ──────────────────────── */

  const filteredInstances = useMemo(() => applyFilters(rawRows, committed), [rawRows, committed])
  const filteredFlights = useMemo(() => dedupFlights(filteredInstances), [filteredInstances])
  const { byDate: dayStats, dates } = useMemo(
    () => buildDayStats(filteredInstances, committed.dateFrom, committed.dateTo),
    [filteredInstances, committed.dateFrom, committed.dateTo],
  )
  const heatmapMax = useMemo(() => computeHeatmapMax(dayStats), [dayStats])
  const kpis = useMemo(
    () => (hasLoaded ? computeKpis(filteredFlights, filteredInstances, dayStats) : emptyKpis()),
    [hasLoaded, filteredFlights, filteredInstances, dayStats],
  )
  const patterns = useMemo(() => bucketByPattern(filteredFlights), [filteredFlights])
  const dowDistribution = useMemo(() => computeDowDistribution(filteredInstances), [filteredInstances])
  const detailRoutes = useMemo(
    () => computeDetailRoutes(filteredFlights, filteredInstances, committed.sortBy),
    [filteredFlights, filteredInstances, committed.sortBy],
  )

  /* ── Load handler ──────────────────────────────────────── */

  const handleGo = useCallback(
    async (dateFrom: string, dateTo: string) => {
      commitFilters()
      try {
        const data = await runway.run(
          async () => {
            const operatorId = getOperatorId()
            const [scheduledFlights, airports] = await Promise.all([
              api.getScheduledFlights({
                operatorId,
                dateFrom,
                dateTo,
              }),
              api.getAirports(),
            ])
            return { scheduledFlights, airports }
          },
          'Computing frequency analysis…',
          'Analysis ready',
        )
        if (data) {
          const rows = expandScheduledFlightsToRows(
            data.scheduledFlights.filter((sf) => !sf.scenarioId),
            dateFrom,
            dateTo,
            { airports: data.airports },
          )
          setRawRows(rows)
          setHasLoaded(true)
          commitFilters()
        }
      } catch (e) {
        console.error('Failed to load frequency analysis:', e)
      }
    },
    [runway, commitFilters, setRawRows, setHasLoaded],
  )

  /* ── Export handler ────────────────────────────────────── */

  const handleExport = useCallback(
    (format: 'csv' | 'xlsx' | 'pdf') => {
      const ctx = {
        flights: filteredFlights,
        instances: filteredInstances,
        dateFormat,
        periodFrom: committed.dateFrom,
        periodTo: committed.dateTo,
        operatorName,
      }
      if (format === 'csv') exportCsv(ctx)
      else if (format === 'xlsx') exportXlsx(ctx)
      else exportPdf(ctx)
    },
    [filteredFlights, filteredInstances, dateFormat, committed.dateFrom, committed.dateTo, operatorName],
  )

  /* ── Right-panel content ───────────────────────────────── */

  let content: React.ReactNode
  if (runway.active) {
    content = <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
  } else if (!hasLoaded) {
    content = <EmptyPanel message="Pick a period and click Run Analysis to see frequency patterns." />
  } else if (filteredInstances.length === 0) {
    content = (
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <FrequencyAnalysisToolbar kpis={kpis} onExport={handleExport} />
        <EmptyPanel message="No flights match the current filters. Adjust filters or reload the period." />
      </div>
    )
  } else {
    content = (
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
        <FrequencyAnalysisToolbar kpis={kpis} onExport={handleExport} />
        <FrequencyAnalysisPatternChart
          dowDistribution={dowDistribution}
          patterns={patterns}
          acTypeColors={acTypeColors}
        />
        <FrequencyAnalysisHeatmap
          dayStats={dayStats}
          dates={dates}
          maxTotal={heatmapMax.total}
          maxByType={heatmapMax.byType}
          acTypeColors={acTypeColors}
        />
        <FrequencyAnalysisRouteTable routes={detailRoutes} acTypeColors={acTypeColors} />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      <FrequencyAnalysisFilterPanel onGo={handleGo} loading={runway.active} />
      {content}
    </div>
  )
}
