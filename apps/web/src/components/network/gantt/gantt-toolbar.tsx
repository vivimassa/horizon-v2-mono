"use client"

import {
  ChevronLeft, ChevronRight, Plus, Minus,
  Wand2, BarChart3, Search, Settings, Maximize2,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import type { ZoomLevel } from '@/lib/gantt/types'

const ZOOMS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '7D', '14D', '28D']

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function formatRange(from: string, to: string): string {
  const f = new Date(from + 'T12:00:00Z')
  const t = new Date(to + 'T12:00:00Z')
  const fd = `${DOW[f.getUTCDay()]} ${String(f.getUTCDate()).padStart(2, '0')} ${MON[f.getUTCMonth()]}`
  const td = `${DOW[t.getUTCDay()]} ${String(t.getUTCDate()).padStart(2, '0')} ${MON[t.getUTCMonth()]} ${t.getUTCFullYear()}`
  return `${fd} — ${td}`
}

export function GanttToolbar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const zoomLevel = useGanttStore(s => s.zoomLevel)
  const barLabelMode = useGanttStore(s => s.barLabelMode)
  const periodFrom = useGanttStore(s => s.periodFrom)
  const periodTo = useGanttStore(s => s.periodTo)
  const setZoom = useGanttStore(s => s.setZoom)
  const zoomRowIn = useGanttStore(s => s.zoomRowIn)
  const zoomRowOut = useGanttStore(s => s.zoomRowOut)
  const navigateDate = useGanttStore(s => s.navigateDate)
  const goToToday = useGanttStore(s => s.goToToday)
  const setBarLabelMode = useGanttStore(s => s.setBarLabelMode)

  const glassBg = isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.80)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const mutedText = isDark ? '#8C90A2' : '#6b7280'
  const pillBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const iconBtn = 'h-7 w-7 flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-white/5'
  const ghostBtn = 'h-7 px-2.5 flex items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors duration-150 border opacity-40 cursor-default'

  return (
    <div
      className="h-11 shrink-0 flex items-center justify-between px-3 gap-3"
      style={{ background: glassBg, borderBottom: `1px solid ${border}`, backdropFilter: 'blur(20px)' }}
    >
      {/* ── Left: Zoom + Row height + Action buttons ── */}
      <div className="flex items-center gap-2">
        {/* Zoom pills */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${pillBorder}` }}>
          {ZOOMS.map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className="px-2 h-6 text-[10px] font-bold transition-colors duration-150"
              style={{
                background: z === zoomLevel ? '#0061FF' : 'transparent',
                color: z === zoomLevel ? '#fff' : mutedText,
              }}
            >
              {z}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-4" style={{ background: border }} />

        {/* Row height */}
        <button onClick={zoomRowOut} className={iconBtn} title="Decrease row height">
          <Minus size={14} color={mutedText} />
        </button>
        <button onClick={zoomRowIn} className={iconBtn} title="Increase row height">
          <Plus size={14} color={mutedText} />
        </button>

        <div className="w-px h-4" style={{ background: border }} />

        {/* Optimizer (disabled placeholder) */}
        <button className={ghostBtn} style={{ borderColor: border, color: mutedText }} disabled>
          <Wand2 size={13} /> Optimizer
        </button>
        <button className={ghostBtn} style={{ borderColor: border, color: mutedText }} disabled>
          <BarChart3 size={13} /> Compare
        </button>
      </div>

      {/* ── Center: Date navigation ── */}
      <div className="flex items-center gap-1.5">
        <button onClick={() => navigateDate('prev')} className={iconBtn}>
          <ChevronLeft size={16} color={mutedText} />
        </button>

        <span className="font-mono text-[11px] px-2 select-none" style={{ color: isDark ? '#C2C6D9' : '#374151' }}>
          {formatRange(periodFrom, periodTo)}
        </span>

        <button onClick={() => navigateDate('next')} className={iconBtn}>
          <ChevronRight size={16} color={mutedText} />
        </button>

        <button
          onClick={goToToday}
          className="h-5 px-2 rounded text-[10px] font-semibold transition-colors duration-150"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: isDark ? '#C2C6D9' : '#374151' }}
        >
          Today
        </button>
      </div>

      {/* ── Right: Tools ── */}
      <div className="flex items-center gap-1">
        <button className={iconBtn} title="Search flights">
          <Search size={14} color={mutedText} />
        </button>

        {/* Label mode toggle */}
        <button
          onClick={() => setBarLabelMode(barLabelMode === 'flightNo' ? 'sector' : 'flightNo')}
          className="h-6 px-2 rounded text-[9px] font-bold tracking-wide transition-colors duration-150"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: mutedText }}
          title={barLabelMode === 'flightNo' ? 'Showing flight numbers' : 'Showing sectors'}
        >
          {barLabelMode === 'flightNo' ? 'FLT' : 'SEC'}
        </button>

        <button className={iconBtn} title="Settings">
          <Settings size={14} color={mutedText} />
        </button>
        <button className={iconBtn} title="Fullscreen">
          <Maximize2 size={14} color={mutedText} />
        </button>
      </div>
    </div>
  )
}
