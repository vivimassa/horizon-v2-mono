"use client"

import {
  ChevronLeft, ChevronRight, Plus, Minus,
  Wand2, BarChart3, Search, Settings, Maximize2,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors, glass } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import type { ZoomLevel } from '@/lib/gantt/types'

const ZOOMS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '7D', '14D', '28D']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function formatRange(from: string, to: string): string {
  const f = new Date(from + 'T12:00:00Z')
  const t = new Date(to + 'T12:00:00Z')
  return `${DOW[f.getUTCDay()]} ${String(f.getUTCDate()).padStart(2, '0')} ${MON[f.getUTCMonth()]} — ${DOW[t.getUTCDay()]} ${String(t.getUTCDate()).padStart(2, '0')} ${MON[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}

export function GanttToolbar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

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

  const glassBg = isDark ? glass.panel : 'rgba(255,255,255,0.90)'

  return (
    <div
      className="h-11 shrink-0 flex items-center justify-between px-3 gap-3"
      style={{ background: glassBg, borderBottom: `1px solid ${palette.border}`, backdropFilter: 'blur(24px)' }}
    >
      {/* ── Left: Zoom + Row height + Actions ── */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${palette.border}` }}>
          {ZOOMS.map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-2 h-7 text-[11px] font-bold transition-colors duration-150 ${z === zoomLevel ? 'bg-module-accent text-white' : ''}`}
              style={z !== zoomLevel ? { color: palette.textTertiary } : undefined}
            >{z}</button>
          ))}
        </div>

        <div className="w-px h-4" style={{ background: palette.border }} />

        <button onClick={zoomRowOut} className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          title="Decrease row height" style={{ color: palette.textSecondary }}>
          <Minus size={14} />
        </button>
        <button onClick={zoomRowIn} className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          title="Increase row height" style={{ color: palette.textSecondary }}>
          <Plus size={14} />
        </button>

        <div className="w-px h-4" style={{ background: palette.border }} />

        <button className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-medium opacity-40 cursor-default"
          style={{ border: `1px solid ${palette.border}`, color: palette.textTertiary }} disabled>
          <Wand2 size={13} /> Optimizer
        </button>
        <button className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-medium opacity-40 cursor-default"
          style={{ border: `1px solid ${palette.border}`, color: palette.textTertiary }} disabled>
          <BarChart3 size={13} /> Compare
        </button>
      </div>

      {/* ── Center: Date navigation ── */}
      <div className="flex items-center gap-1.5">
        <button onClick={() => navigateDate('prev')} className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: palette.textSecondary }}>
          <ChevronLeft size={16} />
        </button>
        <span className="font-mono text-[11px] px-2 select-none" style={{ color: palette.text }}>
          {formatRange(periodFrom, periodTo)}
        </span>
        <button onClick={() => navigateDate('next')} className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: palette.textSecondary }}>
          <ChevronRight size={16} />
        </button>
        <button onClick={goToToday}
          className="h-7 px-3 rounded-lg text-[11px] font-semibold transition-colors duration-150"
          style={{ background: palette.backgroundHover, color: palette.text }}
        >Today</button>
      </div>

      {/* ── Right: Tools ── */}
      <div className="flex items-center gap-1">
        <button className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: palette.textSecondary }} title="Search flights">
          <Search size={14} />
        </button>
        <button onClick={() => setBarLabelMode(barLabelMode === 'flightNo' ? 'sector' : 'flightNo')}
          className="h-7 px-2.5 rounded-lg text-[11px] font-bold tracking-wide transition-colors duration-150"
          style={{ background: palette.backgroundHover, color: palette.textSecondary }}
          title={barLabelMode === 'flightNo' ? 'Showing flight numbers' : 'Showing sectors'}
        >{barLabelMode === 'flightNo' ? 'FLT' : 'SEC'}</button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: palette.textSecondary }} title="Settings">
          <Settings size={14} />
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: palette.textSecondary }} title="Fullscreen">
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  )
}
