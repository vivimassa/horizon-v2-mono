'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { useScheduleSummaryStore } from '@/stores/use-schedule-summary-store'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'

import { ScheduleSummaryFilterPanel } from './filter-panel'
import { computeSummary, formatLargeNumber } from './compute-schedule-summary'
import { KpiStrip } from './kpi-strip'
import { NetworkSplitCard } from './network-split-card'
import { FleetDeploymentCard } from './fleet-deployment-card'
import { CapacityTrendCard } from './capacity-trend-card'
import { RouteSummaryCard } from './route-summary-card'
import { StationActivityCards } from './station-activity-cards'
import { exportCsv, exportXlsx, exportPdf } from '@/lib/schedule-summary-export'

function isoToDisplay(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

export function ScheduleSummaryShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const runway = useRunwayLoading()

  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const operator = useOperatorStore((s) => s.operator)

  const committed = useScheduleSummaryStore((s) => s.committed)
  const flights = useScheduleSummaryStore((s) => s.flights)
  const aircraftTypes = useScheduleSummaryStore((s) => s.aircraftTypes)
  const registrations = useScheduleSummaryStore((s) => s.registrations)
  const cityPairs = useScheduleSummaryStore((s) => s.cityPairs)
  const commit = useScheduleSummaryStore((s) => s.commit)

  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    loadOperator()
  }, [loadOperator])

  // Filter dropdown options come ONLY from the last loaded dataset.
  // Before the first Go, the AC Type dropdown shows just "All Types" —
  // no background fetches, nothing loads until the user clicks Go.
  const availableAcTypes = useMemo(
    () =>
      aircraftTypes
        .filter((t) => t.isActive)
        .map((t) => t.icaoType)
        .sort(),
    [aircraftTypes],
  )
  const availableServiceTypes = useMemo<string[]>(() => [], [])

  const handleGo = useCallback(async () => {
    const s = useScheduleSummaryStore.getState()
    if (!s.dateFrom || !s.dateTo || s.dateFrom > s.dateTo) return
    const opId = getOperatorId()
    const data = await runway.run(
      async () => {
        const [flts, acTypes, regs, cps] = await Promise.all([
          api.getFlights(opId, s.dateFrom, s.dateTo),
          api.getAircraftTypes(opId),
          api.getAircraftRegistrations(opId),
          api.getCityPairs(opId),
        ])
        return { flts, acTypes, regs, cps }
      },
      'Loading schedule…',
      'Summary ready',
    )
    if (data) {
      commit({
        flights: data.flts,
        aircraftTypes: data.acTypes,
        registrations: data.regs,
        cityPairs: data.cps,
      })
    }
  }, [runway, commit])

  // Summary is computed strictly from the committed snapshot.
  // Live edits in the filter panel do NOT trigger recomputation —
  // the user must click Go again to apply them.
  const summary = useMemo(() => {
    if (!committed) return null
    return computeSummary({
      flights,
      aircraftTypes,
      registrations,
      cityPairs,
      committed,
    })
  }, [committed, flights, aircraftTypes, registrations, cityPairs])

  const handleExport = useCallback(
    async (format: 'csv' | 'xlsx' | 'pdf') => {
      setExportOpen(false)
      if (!summary || !committed) return
      const ctx = {
        rows: summary.routes,
        periodFrom: committed.dateFrom,
        periodTo: committed.dateTo,
        operatorName: operator?.name ?? 'SkyHub',
      }
      try {
        if (format === 'csv') exportCsv(ctx)
        else if (format === 'xlsx') await exportXlsx(ctx)
        else await exportPdf(ctx)
      } catch (err) {
        console.error('Schedule summary export failed:', err)
      }
    },
    [summary, committed, operator?.name],
  )

  const activeFilters = useMemo(() => {
    if (!committed) return [] as string[]
    const out: string[] = []
    if (committed.acType !== 'all') out.push(`AC: ${committed.acType}`)
    if (committed.flightType !== 'all') out.push(`Route: ${committed.flightType.toUpperCase()}`)
    if (committed.serviceType !== 'all') out.push(`Svc: ${committed.serviceType}`)
    return out
  }, [committed])

  const contentBg = isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.85)'
  const contentBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  let content: React.ReactNode
  if (runway.active) {
    content = <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
  } else if (!summary) {
    content = <EmptyPanel message="Select a period and click Go to build the schedule summary" />
  } else if (!summary.kpis) {
    content = <EmptyPanel message="No flights in the selected period. Adjust filters or extend the date range." />
  } else {
    content = (
      <div
        className="flex-1 flex flex-col overflow-hidden rounded-2xl min-w-0"
        style={{
          background: contentBg,
          border: `1px solid ${contentBorder}`,
          backdropFilter: isDark ? 'blur(20px)' : undefined,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}
      >
        {/* Toolbar */}
        <header
          className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
          style={{ borderBottom: `1px solid ${contentBorder}` }}
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {committed && (
              <span className="text-[13px] font-medium tabular-nums text-hz-text-secondary">
                {isoToDisplay(committed.dateFrom)} – {isoToDisplay(committed.dateTo)} ({summary.periodDays}d)
              </span>
            )}
            {activeFilters.map((label) => (
              <span
                key={label}
                className="inline-flex items-center px-2.5 h-7 rounded-full text-[13px] font-semibold"
                style={{
                  background: isDark ? 'rgba(62,123,250,0.15)' : 'rgba(30,64,175,0.10)',
                  color: 'var(--module-accent, #1e40af)',
                  border: `1px solid ${isDark ? 'rgba(62,123,250,0.30)' : 'rgba(30,64,175,0.20)'}`,
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] text-[13px] font-semibold text-hz-text hover:bg-hz-border/30 transition-colors"
              style={{
                border: `1px solid ${contentBorder}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
              }}
            >
              <Download size={14} />
              Export
            </button>
            {exportOpen && (
              <div
                className="absolute right-0 mt-1 w-40 rounded-[8px] overflow-hidden z-30"
                style={{
                  background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.98)',
                  border: `1px solid ${contentBorder}`,
                  boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(96,97,112,0.14)',
                }}
              >
                <ExportMenuItem icon={<FileText size={14} />} label="CSV" onClick={() => handleExport('csv')} />
                <ExportMenuItem
                  icon={<FileSpreadsheet size={14} />}
                  label="Excel (XLSX)"
                  onClick={() => handleExport('xlsx')}
                />
                <ExportMenuItem icon={<FileText size={14} />} label="PDF" onClick={() => handleExport('pdf')} />
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <KpiStrip kpis={summary.kpis} />

          {summary.networkSplit && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <NetworkSplitCard split={summary.networkSplit} />
              {summary.fleet.length > 0 && <FleetDeploymentCard rows={summary.fleet} />}
            </div>
          )}

          {summary.trend.length >= 2 && <CapacityTrendCard trend={summary.trend} />}

          {summary.routes.length > 0 && <RouteSummaryCard rows={summary.routes} acTypeColors={summary.acTypeColors} />}

          {summary.stations.length > 0 && <StationActivityCards stations={summary.stations} />}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center gap-4 px-4 py-2 text-[13px] flex-wrap"
          style={{ borderTop: `1px solid ${contentBorder}` }}
        >
          <FooterMetric label="Routes" value={summary.routes.length.toLocaleString()} />
          {summary.kpis && (
            <>
              <FooterMetric label="Wk Flights" value={formatLargeNumber(summary.kpis.weeklyFlights)} />
              <FooterMetric label="Wk Seats" value={formatLargeNumber(summary.kpis.weeklySeats)} />
              <FooterMetric label="Wk ASK" value={formatLargeNumber(summary.kpis.weeklyAsk)} />
            </>
          )}
          <div className="flex-1" />
          <FooterMetric label="Period" value={`${summary.periodDays} days`} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      <ScheduleSummaryFilterPanel
        onGo={handleGo}
        loading={runway.active}
        availableAcTypes={availableAcTypes}
        availableServiceTypes={availableServiceTypes}
      />
      {content}
    </div>
  )
}

function ExportMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 h-9 px-3 text-[13px] font-medium text-hz-text hover:bg-hz-border/30 transition-colors text-left"
    >
      {icon}
      {label}
    </button>
  )
}

function FooterMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[13px] text-hz-text-secondary">
      {label}: <span className="text-hz-text font-semibold tabular-nums">{value}</span>
    </span>
  )
}
