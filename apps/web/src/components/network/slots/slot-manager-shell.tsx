'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotFleetAirportStats, SlotSeriesRef, SlotPortfolioStats } from '@skyhub/api'
import * as XLSX from 'xlsx'
import { SlotSearch } from './slot-search'
import { SlotFilterPanel } from './slot-filter-panel'
import type { SlotFilterState } from './slot-filter-panel'
import { SlotToolbar } from './slot-toolbar'
import { FleetOverview } from './fleet-overview'
import { AirportSlotView } from './airport-slot-view'
import { SlotRequestDialog } from './slot-request-dialog'
import { ImportMessageDialog } from './import-message-dialog'
import { GenerateSCRDialog } from './generate-scr-dialog'

export function SlotManagerShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const runway = useRunwayLoading()

  // Data state
  const [airports, setAirports] = useState<SlotCoordinatedAirport[]>([])
  const [fleetStats, setFleetStats] = useState<SlotFleetAirportStats[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const [filters, setFilters] = useState<SlotFilterState | null>(null)

  // View state
  const [selectedIata, setSelectedIata] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showSlotFlags, setShowSlotFlags] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog state
  const [requestOpen, setRequestOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [scrOpen, setScrOpen] = useState(false)
  const [seriesForSCR, setSeriesForSCR] = useState<SlotSeriesRef[]>([])

  useEffect(() => {
    loadOperator()
  }, [loadOperator])

  const handleGo = useCallback(
    async (f: SlotFilterState) => {
      setFilters(f)
      const data = await runway.run(
        async () => {
          const opId = getOperatorId()
          const [airportData, statsData] = await Promise.all([
            api.getSlotAirports(),
            opId ? api.getSlotFleetStats(opId, f.seasonCode) : Promise.resolve([]),
          ])
          return { airportData, statsData }
        },
        'Loading slot data\u2026',
        'Data loaded',
      )

      setAirports(data.airportData)

      // Apply client-side filters to fleet stats
      let stats = data.statsData
      if (f.airports) stats = stats.filter((s) => f.airports!.includes(s.airportIata))
      if (f.riskLevel !== 'all') {
        stats = stats.filter((s) => {
          if (f.riskLevel === 'safe') return s.utilizationPct >= 85
          if (f.riskLevel === 'close') return s.utilizationPct >= 80 && s.utilizationPct < 85
          if (f.riskLevel === 'at_risk') return s.utilizationPct < 80 && s.totalDates > 0
          return true
        })
      }

      setFleetStats(stats)
      setDataLoaded(true)
      setSelectedIata(null)
    },
    [runway],
  )

  const handleDataChanged = useCallback(() => {
    setRefreshKey((k) => k + 1)
    // Reload fleet stats in background
    if (filters) {
      const opId = getOperatorId()
      if (opId) api.getSlotFleetStats(opId, filters.seasonCode).then(setFleetStats)
    }
  }, [filters])

  const selectedAirport = airports.find((a) => a.iataCode === selectedIata) ?? null

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const glassStyle = { background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }

  // Load series for SCR dialog when an airport is selected
  useEffect(() => {
    if (selectedIata && filters) {
      const opId = getOperatorId()
      if (opId) api.getSlotSeries(opId, selectedIata, filters.seasonCode).then(setSeriesForSCR)
    }
  }, [selectedIata, filters, refreshKey])

  return (
    <div className="h-full flex gap-3 p-3">
      {/* Left filter panel */}
      <div className="shrink-0 h-full">
        <SlotFilterPanel forceCollapsed={dataLoaded} loading={runway.active} onGo={handleGo} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {/* Toolbar */}
        {!runway.active && dataLoaded && (
          <div className="shrink-0 rounded-2xl overflow-hidden" style={glassStyle}>
            <SlotToolbar
              onNewRequest={() => setRequestOpen(true)}
              onImportSchedule={
                selectedIata && filters
                  ? async () => {
                      await api.importSlotsFromSchedule(getOperatorId(), selectedIata, filters.seasonCode)
                      handleDataChanged()
                    }
                  : undefined
              }
              onImportSAL={selectedIata ? () => setImportOpen(true) : undefined}
              onGenerateSCR={selectedIata ? () => setScrOpen(true) : undefined}
              onExport={async () => {
                const opId = getOperatorId()
                if (!filters || !opId) return
                const airportsToExport = selectedIata ? [selectedIata] : fleetStats.map((s) => s.airportIata)
                const data = []
                for (const iata of airportsToExport) {
                  const series = await api.getSlotSeries(opId, iata, filters.seasonCode)
                  data.push(...series)
                }
                if (!data.length) return

                const fmtTime = (v: number | null) => {
                  if (v == null) return ''
                  const h = Math.floor(v / 100)
                  const m = v % 100
                  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                }

                // Sheet 1: Series Summary
                const seriesRows = data.map((s) => ({
                  Airport: s.airportIata,
                  Season: s.seasonCode,
                  'Arr Flight': s.arrivalFlightNumber || '',
                  'Dep Flight': s.departureFlightNumber || '',
                  Origin: s.arrivalOriginIata || '',
                  Destination: s.departureDestIata || '',
                  'Req Arr Time': fmtTime(s.requestedArrivalTime),
                  'Req Dep Time': fmtTime(s.requestedDepartureTime),
                  'Alloc Arr Time': fmtTime(s.allocatedArrivalTime),
                  'Alloc Dep Time': fmtTime(s.allocatedDepartureTime),
                  'Period Start': s.periodStart,
                  'Period End': s.periodEnd,
                  'Days of Op': s.daysOfOperation,
                  'AC Type': s.aircraftTypeIcao || '',
                  Seats: s.seats ?? '',
                  Status: s.status,
                  Priority: s.priorityCategory,
                  'Coordinator Ref': s.coordinatorRef || '',
                  'Waitlist Pos': s.waitlistPosition ?? '',
                }))

                // Sheet 2: Fleet Summary (per airport)
                const fleetRows = fleetStats.map((s) => ({
                  Airport: s.airportIata,
                  'Total Series': s.totalSeries,
                  Confirmed: s.confirmed,
                  Offered: s.offered,
                  Waitlisted: s.waitlisted,
                  Refused: s.refused,
                  Draft: s.draft,
                  Submitted: s.submitted,
                  'Total Dates': s.totalDates,
                  Operated: s.operated,
                  JNUS: s.jnus,
                  Cancelled: s.cancelled,
                  'Utilization %': s.utilizationPct,
                }))

                const wb = XLSX.utils.book_new()
                const ws1 = XLSX.utils.json_to_sheet(seriesRows)
                const ws2 = XLSX.utils.json_to_sheet(fleetRows)

                // Set column widths
                ws1['!cols'] = Object.keys(seriesRows[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 14) }))
                ws2['!cols'] = Object.keys(fleetRows[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 14) }))

                XLSX.utils.book_append_sheet(wb, ws1, 'Slot Series')
                XLSX.utils.book_append_sheet(wb, ws2, 'Fleet Summary')
                XLSX.writeFile(wb, `slots-${filters.seasonCode}-${selectedIata || 'all'}.xlsx`)
              }}
              onSearch={() => setSearchOpen((v) => !v)}
              showSlotFlags={showSlotFlags}
              onToggleSlotFlags={() => setShowSlotFlags((v) => !v)}
              viewMode={viewMode}
              onToggleViewMode={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
            />
          </div>
        )}

        {/* Content panel */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl relative" style={glassStyle}>
          <SlotSearch
            open={searchOpen}
            onClose={() => {
              setSearchOpen(false)
              setSearchQuery('')
            }}
            onQueryChange={setSearchQuery}
          />
          {runway.active ? (
            <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
          ) : !dataLoaded ? (
            <EmptyPanel message="Select a season and click Go to load slot data" />
          ) : (
            <FleetOverview
              airports={airports}
              fleetStats={fleetStats}
              seasonCode={filters?.seasonCode ?? 'S26'}
              onSelectAirport={setSelectedIata}
              isDark={isDark}
              viewMode={viewMode}
              searchQuery={searchQuery}
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      {requestOpen && filters && (
        <SlotRequestDialog
          open
          onOpenChange={setRequestOpen}
          airportIata={selectedIata || ''}
          seasonCode={filters.seasonCode}
          onCreated={handleDataChanged}
          isDark={isDark}
        />
      )}
      {importOpen && selectedIata && filters && (
        <ImportMessageDialog
          open
          onOpenChange={setImportOpen}
          airportIata={selectedIata}
          seasonCode={filters.seasonCode}
          onImported={handleDataChanged}
          isDark={isDark}
        />
      )}
      {scrOpen && selectedIata && filters && (
        <GenerateSCRDialog
          open
          onOpenChange={setScrOpen}
          series={seriesForSCR}
          airportIata={selectedIata}
          seasonCode={filters.seasonCode}
          onGenerated={handleDataChanged}
          isDark={isDark}
        />
      )}
    </div>
  )
}
