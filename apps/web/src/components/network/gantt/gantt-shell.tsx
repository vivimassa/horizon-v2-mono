"use client"

import { useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useGanttKeyboard } from '@/hooks/use-gantt-keyboard'
import { GanttFilterPanel } from './gantt-filter-panel'
import { GanttToolbar } from './gantt-toolbar'
import { GanttCanvas } from './gantt-canvas'
import { FlightInformationDialog } from './flight-information/flight-information-dialog'

export function GanttShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const error = useGanttStore(s => s.error)
  const layout = useGanttStore(s => s.layout)
  const flights = useGanttStore(s => s.flights)
  const loading = useGanttStore(s => s.loading)
  const periodCommitted = useGanttStore(s => s.periodCommitted)
  const runway = useRunwayLoading()

  useGanttKeyboard()

  // Load operator + hydrate saved period on mount
  useEffect(() => {
    useGanttStore.getState().hydrate()
    const ops = useOperatorStore.getState()
    if (!ops.loaded) ops.loadOperator()
  }, [])

  const handleGo = useCallback(async () => {
    await runway.run(
      () => useGanttStore.getState().commitPeriod(),
      'Loading flights…',
      'Flights loaded',
    )
  }, [runway])

  return (
    <div className="h-full flex gap-3 p-3">
      <div className="shrink-0 h-full">
        <GanttFilterPanel forceCollapsed={!!layout} onGo={handleGo} />
      </div>

      <div
        className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl"
        style={{
          background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          backdropFilter: 'blur(24px)',
        }}
      >
        <GanttToolbar />

        {/* Runway animation */}
        {runway.active && (
          <RunwayLoadingPanel percent={runway.percent} label={runway.label} />
        )}

        {/* Empty state */}
        {!runway.active && !periodCommitted && !loading && (
          <EmptyPanel />
        )}

        {/* Canvas */}
        {!runway.active && layout && (
          <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
            <GanttCanvas />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10"
                style={{ background: isDark ? 'rgba(14,14,20,0.5)' : 'rgba(255,255,255,0.5)' }}>
                <Loader2 size={28} className="animate-spin text-module-accent" />
              </div>
            )}
          </div>
        )}

        {/* Fallback states */}
        {!runway.active && !layout && (periodCommitted || loading) && (
          <EmptyPanel message={
            loading ? 'Loading flights…'
              : error ? `Failed to load: ${error}`
              : flights.length === 0 ? 'No flights found for this period'
              : ''
          } />
        )}
      </div>

      {/* Flight Information dialog — portaled to body */}
      <FlightInformationDialog />
    </div>
  )
}
