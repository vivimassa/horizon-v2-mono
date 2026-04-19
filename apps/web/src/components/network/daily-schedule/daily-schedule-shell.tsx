'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@skyhub/api'
import {
  useDailyScheduleStore,
  getFilteredFlights,
  getSortedFlights,
  getSummaryStats,
  type TimeMode,
} from '@/stores/use-daily-schedule-store'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { exportCsv, exportXlsx, exportPdf } from '@/lib/daily-schedule-export'
import { FilterPanel } from './filter-panel'
import { ReportToolbar } from './report-toolbar'
import { ReportTable } from './report-table'

export function DailyScheduleShell() {
  const [hasLoaded, setHasLoaded] = useState(false)
  const runway = useRunwayLoading()
  const loadRefData = useScheduleRefStore((s) => s.loadAll)
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  const refLoaded = useScheduleRefStore((s) => s.loaded)

  const flights = useDailyScheduleStore((s) => s.flights)
  const committed = useDailyScheduleStore((s) => s.committed)
  const airportMap = useDailyScheduleStore((s) => s.airportMap)
  const sortSequence = useDailyScheduleStore((s) => s.sortSequence)
  const setFlights = useDailyScheduleStore((s) => s.setFlights)
  const commitFilters = useDailyScheduleStore((s) => s.commitFilters)

  // Load reference data + operator config once
  useEffect(() => {
    loadOperator()
  }, [loadOperator])
  useEffect(() => {
    if (operatorLoaded && !refLoaded) loadRefData()
  }, [operatorLoaded, refLoaded, loadRefData])

  // Derived data — uses committed filter snapshot, not live UI state
  const filtered = useMemo(() => getFilteredFlights(flights, committed, airportMap), [flights, committed, airportMap])
  const sorted = useMemo(() => getSortedFlights(filtered, sortSequence), [filtered, sortSequence])
  const summary = useMemo(() => getSummaryStats(filtered), [filtered])

  const handleGo = useCallback(
    async (dateFrom: string, dateTo: string) => {
      // Snapshot filter state before loading
      commitFilters()
      try {
        const data = await runway.run(
          async () => {
            const opId = getOperatorId()
            const [flightsData, airports, regs] = await Promise.all([
              api.getFlights(opId, dateFrom, dateTo),
              api.getAirports(),
              api.getAircraftRegistrations(opId),
            ])
            return { flights: flightsData, airports, regs }
          },
          'Loading flights...',
          'Flights loaded',
        )
        if (data) {
          const acTypes = useScheduleRefStore.getState().aircraftTypes
          setFlights(data.flights, data.airports, data.regs, acTypes)
          setHasLoaded(true)
        }
      } catch (e) {
        console.error('Failed to load daily schedule:', e)
      }
    },
    [runway, setFlights, commitFilters],
  )

  // Export handler
  const handleExport = useCallback(
    (format: 'csv' | 'xlsx' | 'pdf') => {
      const {
        columnOrder,
        hiddenColumns,
        timeModes,
        airportMap: am,
        homeBaseOffset,
        regToTypeMap,
        dateFrom,
        dateTo,
      } = useDailyScheduleStore.getState()
      const { dateFormat, operator } = useOperatorStore.getState()
      const modeOrder: TimeMode[] = ['utc', 'localBase', 'localStation']
      const activeModes = modeOrder.filter((m) => timeModes.has(m))
      const visibleColumns = columnOrder.filter((c) => !hiddenColumns.has(c))
      const ctx = {
        flights: sorted,
        visibleColumns,
        activeModes,
        homeBaseOffset,
        airportMap: am,
        regToTypeMap,
        dateFormat,
        periodFrom: dateFrom,
        periodTo: dateTo,
        operatorName: operator?.name ?? 'SkyHub',
      }
      if (format === 'csv') exportCsv(ctx)
      else if (format === 'xlsx') exportXlsx(ctx)
      else exportPdf(ctx)
    },
    [sorted],
  )

  // Right-panel content
  let content: React.ReactNode
  if (runway.active) {
    content = <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
  } else if (!hasLoaded) {
    content = <EmptyPanel message="Select a period and click Go to load the daily schedule" />
  } else {
    content = (
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <ReportToolbar stats={summary} onExport={handleExport} />
        <ReportTable flights={sorted} />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      <FilterPanel onGo={handleGo} loading={runway.active} />
      {content}
    </div>
  )
}
