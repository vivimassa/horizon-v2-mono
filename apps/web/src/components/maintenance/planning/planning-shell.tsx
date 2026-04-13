'use client'

import { useEffect, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'
import { getOperatorId } from '@/stores/use-operator-store'
import { PlanningFilterPanel } from './planning-filter-panel'
import { PlanningToolbar } from './planning-toolbar'
import { PlanningGantt } from './planning-gantt'
import { PlanningFormDialog } from './planning-form-dialog'
import { PlanningContextMenu } from './planning-context-menu'
import { ForecastAnalysisPopover } from './forecast-analysis-popover'

export function PlanningShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const periodCommitted = useMaintenancePlanningStore((s) => s.periodCommitted)
  const rows = useMaintenancePlanningStore((s) => s.rows)
  const formDialog = useMaintenancePlanningStore((s) => s.formDialog)
  const forecastPopover = useMaintenancePlanningStore((s) => s.forecastPopover)
  const loadFilterOptions = useMaintenancePlanningStore((s) => s.loadFilterOptions)
  const runway = useRunwayLoading()

  const hasData = periodCommitted && rows.length >= 0 && !runway.active

  useEffect(() => {
    const opId = getOperatorId()
    if (opId) loadFilterOptions(opId)
  }, [loadFilterOptions])

  const handleGo = useCallback(async () => {
    await runway.run(
      () => useMaintenancePlanningStore.getState().commitPeriod(),
      'Loading maintenance events…',
      'Events loaded',
    )
  }, [runway])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return (
    <div className="h-full flex gap-3 p-3">
      {/* Filter Panel (left) */}
      <div className="shrink-0 h-full">
        <PlanningFilterPanel forceCollapsed={hasData} onGo={handleGo} />
      </div>

      {/* Center: toolbar + gantt (full width, no right panel) */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-3">
        {!runway.active && hasData && (
          <div
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
          >
            <PlanningToolbar />
          </div>
        )}

        {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}

        {!runway.active && !periodCommitted && (
          <EmptyPanel message="Select a date range and click Go to load scheduled maintenance events" />
        )}

        {!runway.active && hasData && (
          <div
            className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl"
            style={{ background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(24px)' }}
          >
            <PlanningGantt />
          </div>
        )}
      </div>

      {/* Overlays */}
      {formDialog && <PlanningFormDialog />}
      <PlanningContextMenu />
      {forecastPopover && <ForecastAnalysisPopover />}
    </div>
  )
}
