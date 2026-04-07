"use client"

import { useEffect, useRef } from 'react'
import { Loader2, GanttChart } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { GanttFilterPanel } from './gantt-filter-panel'
import { GanttToolbar } from './gantt-toolbar'
import { GanttHistogram } from './gantt-histogram'
import { GanttStatusBar } from './gantt-status-bar'

export function GanttShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const canvasRef = useRef<HTMLDivElement>(null)

  const loading = useGanttStore(s => s.loading)
  const error = useGanttStore(s => s.error)
  const layout = useGanttStore(s => s.layout)
  const periodCommitted = useGanttStore(s => s.periodCommitted)
  const flights = useGanttStore(s => s.flights)

  // Load operator + auto-commit on mount
  useEffect(() => {
    const ops = useOperatorStore.getState()
    if (!ops.loaded) ops.loadOperator()
    useGanttStore.getState().commitPeriod()
  }, [])

  // ResizeObserver on canvas area
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) useGanttStore.getState().setContainerWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const canvasBg = isDark ? '#0E0E14' : '#fafafa'
  const mutedText = isDark ? '#8C90A2' : '#9ca3af'

  // Canvas placeholder content
  let placeholder: React.ReactNode
  if (loading) {
    placeholder = (
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: '#0061FF' }} />
        <span className="text-[12px] font-medium" style={{ color: mutedText }}>Loading flights…</span>
      </div>
    )
  } else if (error) {
    placeholder = (
      <div className="flex flex-col items-center gap-2">
        <span className="text-[12px] font-medium text-red-400">Failed to load: {error}</span>
      </div>
    )
  } else if (!periodCommitted) {
    placeholder = (
      <div className="flex flex-col items-center gap-3">
        <GanttChart size={32} style={{ color: mutedText }} strokeWidth={1.2} />
        <span className="text-[12px]" style={{ color: mutedText }}>Select a period and press Go to load flights</span>
      </div>
    )
  } else if (flights.length === 0) {
    placeholder = (
      <div className="flex flex-col items-center gap-2">
        <span className="text-[12px]" style={{ color: mutedText }}>No flights found for this period</span>
      </div>
    )
  } else {
    placeholder = (
      <div className="flex flex-col items-center gap-3">
        <GanttChart size={32} style={{ color: mutedText }} strokeWidth={1.2} />
        <span className="text-[12px] font-mono" style={{ color: mutedText }}>
          Gantt canvas — {flights.length} flights · {layout?.rows.length ?? 0} rows
        </span>
      </div>
    )
  }

  return (
    <div className="h-full flex gap-2 p-2">
      {/* Filter panel */}
      <GanttFilterPanel />

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: isDark ? 'rgba(25,25,33,0.60)' : 'rgba(255,255,255,0.60)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <GanttToolbar />

        {/* Canvas area */}
        <div
          ref={canvasRef}
          className="flex-1 min-h-0 overflow-hidden flex items-center justify-center"
          style={{ background: canvasBg }}
        >
          {placeholder}
        </div>

        <GanttHistogram />
        <GanttStatusBar />
      </div>
    </div>
  )
}
