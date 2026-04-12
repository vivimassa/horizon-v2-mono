'use client'

/**
 * 2.1.1 Movement Control shell — forked from GanttShell.
 * Uses OpsToolbar (OCC workflow) instead of GanttToolbar (network planning).
 * Canvas, search, dialogs, and stores remain shared with 1.1.2.
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useGanttKeyboard, registerSearchToggle, unregisterSearchToggle } from '@/hooks/use-gantt-keyboard'
import { GanttFilterPanel } from '@/components/network/gantt/gantt-filter-panel'
import { GanttCanvas } from '@/components/network/gantt/gantt-canvas'
import { AddFlightPanel } from '@/components/network/gantt/add-flight-panel'
import { GanttSearch } from '@/components/network/gantt/gantt-search'
import { FlightInformationDialog } from '@/components/network/gantt/flight-information/flight-information-dialog'
import { OpsToolbar } from './ops-toolbar'

export function MovementControlShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const error = useGanttStore((s) => s.error)
  const layout = useGanttStore((s) => s.layout)
  const flights = useGanttStore((s) => s.flights)
  const aircraft = useGanttStore((s) => s.aircraft)
  const loading = useGanttStore((s) => s.loading)
  const periodCommitted = useGanttStore((s) => s.periodCommitted)
  const runway = useRunwayLoading()
  const [searchOpen, setSearchOpen] = useState(false)
  const [addFlightOpen, setAddFlightOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    if (!shellRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      shellRef.current.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useGanttKeyboard()

  useEffect(() => {
    registerSearchToggle(() => setSearchOpen((v) => !v))
    return () => unregisterSearchToggle()
  }, [])

  useEffect(() => {
    useGanttStore.getState().hydrate()
    const ops = useOperatorStore.getState()
    if (!ops.loaded) ops.loadOperator()
  }, [])

  const handleGo = useCallback(async () => {
    await runway.run(() => useGanttStore.getState().commitPeriod(), 'Loading flights…', 'Flights loaded')
  }, [runway])

  return (
    <div
      ref={shellRef}
      className="h-full flex gap-3 p-3"
      style={{ background: isFullscreen ? (isDark ? '#0E0E14' : '#FAFAFC') : undefined }}
    >
      <div className="shrink-0 h-full">
        <GanttFilterPanel forceCollapsed={!!layout} onGo={handleGo} mode="ops" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {!runway.active && layout && (
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{
              background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <OpsToolbar
              onSearch={() => setSearchOpen((v) => !v)}
              onFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              onAddFlight={() => setAddFlightOpen((v) => !v)}
            />
          </div>
        )}

        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl"
          style={{
            background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
            backdropFilter: 'blur(24px)',
          }}
        >
          {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}
          {!runway.active && !periodCommitted && !loading && <EmptyPanel />}
          {!runway.active && layout && (
            <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
              <GanttCanvas />
              <GanttSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
              {loading && (
                <div
                  className="absolute inset-0 flex items-center justify-center z-10"
                  style={{ background: isDark ? 'rgba(14,14,20,0.5)' : 'rgba(255,255,255,0.5)' }}
                >
                  <Loader2 size={28} className="animate-spin text-module-accent" />
                </div>
              )}
            </div>
          )}
          {!runway.active && !layout && (periodCommitted || loading) && (
            <EmptyPanel
              message={
                loading
                  ? 'Loading flights…'
                  : error
                    ? `Failed to load: ${error}`
                    : flights.length === 0 && aircraft.length === 0
                      ? 'No flights found for this period'
                      : ''
              }
            />
          )}
        </div>
      </div>

      {addFlightOpen && <AddFlightPanel onClose={() => setAddFlightOpen(false)} />}
      <FlightInformationDialog />
    </div>
  )
}
