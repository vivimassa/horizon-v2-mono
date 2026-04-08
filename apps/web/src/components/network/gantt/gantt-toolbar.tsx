"use client"

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Wand2, BarChart3, Search, Settings, Maximize2, LayoutGrid,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useGanttStore } from '@/stores/use-gantt-store'
import { ROW_HEIGHT_LEVELS } from '@/lib/gantt/types'
import type { ZoomLevel } from '@/lib/gantt/types'

const ZOOMS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '14D', '21D', '28D']

export function GanttToolbar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const zoomLevel = useGanttStore(s => s.zoomLevel)
  const rowHeightLevel = useGanttStore(s => s.rowHeightLevel)
  const barLabelMode = useGanttStore(s => s.barLabelMode)
  const setZoom = useGanttStore(s => s.setZoom)
  const zoomRowIn = useGanttStore(s => s.zoomRowIn)
  const zoomRowOut = useGanttStore(s => s.zoomRowOut)
  const goToToday = useGanttStore(s => s.goToToday)
  const setBarLabelMode = useGanttStore(s => s.setBarLabelMode)

  // Format popover state
  const [formatOpen, setFormatOpen] = useState(false)
  const formatBtnRef = useRef<HTMLButtonElement>(null)
  const formatDropRef = useRef<HTMLDivElement>(null)
  const [formatPos, setFormatPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!formatOpen || !formatBtnRef.current) return
    const rect = formatBtnRef.current.getBoundingClientRect()
    setFormatPos({ top: rect.bottom + 6, left: rect.left })
  }, [formatOpen])

  useEffect(() => {
    if (!formatOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        formatBtnRef.current && !formatBtnRef.current.contains(t) &&
        formatDropRef.current && !formatDropRef.current.contains(t)
      ) setFormatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [formatOpen])

  // Zoom stepping
  const zoomIdx = ZOOMS.indexOf(zoomLevel)
  const zoomPrev = () => { if (zoomIdx > 0) setZoom(ZOOMS[zoomIdx - 1]) }
  const zoomNext = () => { if (zoomIdx < ZOOMS.length - 1) setZoom(ZOOMS[zoomIdx + 1]) }

  // Theme for popover
  const panelBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const rowH = ROW_HEIGHT_LEVELS[rowHeightLevel].rowH

  return (
    <div
      className="h-11 shrink-0 flex items-center justify-between px-3 gap-3"
      style={{ borderBottom: `1px solid ${palette.border}` }}
    >
      {/* ── Left: Actions ── */}
      <div className="flex items-center gap-2">
        <button className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-medium opacity-40 cursor-default"
          style={{ border: `1px solid ${palette.border}`, color: palette.textTertiary }} disabled>
          <Wand2 size={13} /> Optimizer
        </button>
        <button className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-medium opacity-40 cursor-default"
          style={{ border: `1px solid ${palette.border}`, color: palette.textTertiary }} disabled>
          <BarChart3 size={13} /> Compare
        </button>
      </div>

      {/* ── Right: Tools ── */}
      <div className="flex items-center gap-1">
        {/* Today */}
        <button onClick={goToToday}
          className="h-7 px-3 rounded-lg text-[11px] font-semibold transition-colors duration-150"
          style={{ background: palette.backgroundHover, color: palette.text }}
        >Today</button>

        {/* Format button */}
        <button
          ref={formatBtnRef}
          onClick={() => setFormatOpen(o => !o)}
          className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors duration-150"
          style={{ color: palette.textSecondary, background: formatOpen ? activeBg : undefined }}
          title="Format"
        >
          <LayoutGrid size={16} strokeWidth={1.6} />
        </button>

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

      {/* ── Format Popover ── */}
      {formatOpen && createPortal(
        <div
          ref={formatDropRef}
          className="fixed z-[9999] rounded-xl p-3 select-none space-y-3"
          style={{
            top: formatPos.top, left: formatPos.left, width: 200,
            background: panelBg, border: `1px solid ${panelBorder}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(96,97,112,0.14)',
          }}
        >
          {/* Row Height */}
          <div>
            <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">Row Height</div>
            <div className="flex items-center justify-center">
              <button
                onClick={zoomRowOut}
                disabled={rowHeightLevel <= 0}
                className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >−</button>
              <div
                className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text"
                style={{ width: 56, height: 36, borderTop: `1px solid ${panelBorder}`, borderBottom: `1px solid ${panelBorder}` }}
              >{rowH}</div>
              <button
                onClick={zoomRowIn}
                disabled={rowHeightLevel >= ROW_HEIGHT_LEVELS.length - 1}
                className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >+</button>
            </div>
          </div>

          {/* Range (Zoom) */}
          <div>
            <div className="text-[13px] font-medium text-hz-text-secondary mb-2 text-center">Range</div>
            <div className="flex items-center justify-center">
              <button
                onClick={zoomPrev}
                disabled={zoomIdx <= 0}
                className="flex items-center justify-center rounded-l-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >−</button>
              <div
                className="flex items-center justify-center text-[13px] font-mono font-medium text-hz-text"
                style={{ width: 56, height: 36, borderTop: `1px solid ${panelBorder}`, borderBottom: `1px solid ${panelBorder}` }}
              >{zoomLevel}</div>
              <button
                onClick={zoomNext}
                disabled={zoomIdx >= ZOOMS.length - 1}
                className="flex items-center justify-center rounded-r-lg text-[14px] font-bold transition-colors disabled:opacity-30"
                style={{ width: 40, height: 36, border: `1px solid ${panelBorder}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >+</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
