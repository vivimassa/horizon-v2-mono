"use client"

import { useEffect } from 'react'
import { Loader2, GanttChart } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors, glass } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { GanttFilterPanel } from './gantt-filter-panel'
import { GanttToolbar } from './gantt-toolbar'
import { GanttCanvas } from './gantt-canvas'

export function GanttShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const loading = useGanttStore(s => s.loading)
  const error = useGanttStore(s => s.error)
  const layout = useGanttStore(s => s.layout)
  const periodCommitted = useGanttStore(s => s.periodCommitted)
  const flights = useGanttStore(s => s.flights)

  useEffect(() => {
    async function init() {
      const ops = useOperatorStore.getState()
      if (!ops.loaded) await ops.loadOperator()
      useGanttStore.getState().commitPeriod()
    }
    init()
  }, [])

  const glassBg = isDark ? glass.panel : 'rgba(255,255,255,0.90)'

  return (
    <div className="h-full flex">
      <div className="shrink-0 h-full p-2 pr-0">
        <GanttFilterPanel />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        <GanttToolbar />

        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col" style={{ background: palette.background }}>
          {layout ? (
            <GanttCanvas />
          ) : (
            <div className="h-full flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={28} className="animate-spin text-module-accent" />
                  <span className="text-[12px] font-medium" style={{ color: palette.textTertiary }}>Loading flights…</span>
                </div>
              ) : error ? (
                <span className="text-[12px] font-medium" style={{ color: '#FF3B3B' }}>Failed to load: {error}</span>
              ) : !periodCommitted ? (
                <div className="flex flex-col items-center gap-3">
                  <GanttChart size={32} strokeWidth={1.2} style={{ color: palette.textTertiary }} />
                  <span className="text-[12px]" style={{ color: palette.textTertiary }}>Select a period and press Go</span>
                </div>
              ) : flights.length === 0 ? (
                <span className="text-[12px]" style={{ color: palette.textTertiary }}>No flights found for this period</span>
              ) : null}
            </div>
          )}
          {loading && layout && (
            <div className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: isDark ? 'rgba(14,14,20,0.5)' : 'rgba(255,255,255,0.5)' }}>
              <Loader2 size={28} className="animate-spin text-module-accent" />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
