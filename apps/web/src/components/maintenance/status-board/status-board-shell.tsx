'use client'

import { useEffect, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useStatusBoardStore } from '@/stores/use-status-board-store'
import { StatusBoardFilterPanel } from './status-board-filter-panel'
import { StatusBoardKpiSection } from './status-board-kpi-section'
import { StatusBoardStatsBar } from './status-board-stats-bar'
import { AircraftStripList } from './aircraft-strip-list'
import { StatusBoardContextMenu } from './status-board-context-menu'

export function StatusBoardShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const aircraft = useStatusBoardStore((s) => s.aircraft)
  const kpis = useStatusBoardStore((s) => s.kpis)
  const kpisCollapsed = useStatusBoardStore((s) => s.kpisCollapsed)
  const toggleKpis = useStatusBoardStore((s) => s.toggleKpis)
  const contextMenu = useStatusBoardStore((s) => s.contextMenu)
  const lastRefreshMs = useStatusBoardStore((s) => s.lastRefreshMs)
  const loadFilterOptions = useStatusBoardStore((s) => s.loadFilterOptions)

  const runway = useRunwayLoading()

  // Load filter options from master data on mount (before Go)
  useEffect(() => {
    loadFilterOptions()
  }, [loadFilterOptions])

  const dataLoaded = lastRefreshMs > 0 && !runway.active
  const hasData = dataLoaded && aircraft.length >= 0

  const handleGo = useCallback(async () => {
    await runway.run(() => useStatusBoardStore.getState().loadData(), 'Loading fleet health…', 'Dashboard ready')
  }, [runway])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div className="h-full flex gap-3 p-3">
      {/* Filter Panel (left) — always visible */}
      <div className="shrink-0 h-full">
        <StatusBoardFilterPanel onGo={handleGo} forceCollapsed={hasData} />
      </div>

      {/* Center content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {/* Runway loading animation */}
        {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}

        {/* Empty state — before Go is clicked */}
        {!runway.active && !dataLoaded && (
          <EmptyPanel message="Configure filters and click Go to load the fleet health dashboard" />
        )}

        {/* Main dashboard — after data loaded */}
        {!runway.active && hasData && (
          <div
            className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-2xl"
            style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
          >
            {/* Toolbar */}
            <div
              className="shrink-0 flex items-center px-4"
              style={{
                height: 40,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <span className="text-[15px] font-semibold" style={{ color: palette.text }}>
                Aircraft Status Board
              </span>
            </div>

            {/* KPI Cards */}
            <div className="shrink-0 px-3 pt-3">
              <StatusBoardKpiSection kpis={kpis} collapsed={kpisCollapsed} onToggle={toggleKpis} />
            </div>

            {/* Stats Bar */}
            <div className="shrink-0 px-3 pt-2">
              <StatusBoardStatsBar kpis={kpis} />
            </div>

            {/* Aircraft Strip List (scrollable) */}
            <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3 pt-2">
              <AircraftStripList />
            </div>

            {/* Footer */}
            <div
              className="shrink-0 flex items-center px-4 text-[13px]"
              style={{
                height: 32,
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                color: palette.textTertiary,
              }}
            >
              Showing {useStatusBoardStore.getState().filteredAircraft.length} of {aircraft.length} aircraft
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && <StatusBoardContextMenu />}
    </div>
  )
}
