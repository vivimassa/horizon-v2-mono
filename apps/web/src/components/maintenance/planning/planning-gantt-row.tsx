'use client'

import { memo, useMemo } from 'react'
import type { MxGanttAircraftRow, MxEventRow, MxForecastMarker } from '@skyhub/api'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'

interface DayCol {
  date: Date
  dateStr: string
  isToday: boolean
  isWeekend: boolean
}

interface Props {
  row: MxGanttAircraftRow
  days: DayCol[]
  dayWidth: number
  ganttStartMs: number
  totalMs: number
  rowHeight: number
  colorMode: 'check_type' | 'status'
  selectedEventId: string | null
  isDark: boolean
  border: string
  todayBg: string
  weekendBg: string
}

function getContrastText(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff'
}

const STATUS_COLORS: Record<string, string> = {
  proposed: '#3B82F6',
  planned: '#FF8800',
  confirmed: '#06C270',
  in_progress: '#0063F7',
  completed: '#8F90A6',
  deferred: '#7C3AED',
  cancelled: '#FF3B3B',
}

function dateToPct(dateStr: string, ganttStartMs: number, totalMs: number): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d)
  return Math.max(0, Math.min(100, ((ms - ganttStartMs) / totalMs) * 100))
}

function PlanningGanttRowInner({
  row,
  days,
  dayWidth,
  ganttStartMs,
  totalMs,
  rowHeight,
  colorMode,
  selectedEventId,
  isDark,
  border,
  todayBg,
  weekendBg,
}: Props) {
  const selectEvent = useMaintenancePlanningStore((s) => s.selectEvent)
  const setContextMenu = useMaintenancePlanningStore((s) => s.setContextMenu)

  const totalWidth = days.length * dayWidth

  // Compute bar positions
  const bars = useMemo(() => {
    return row.events.map((ev) => {
      const effectiveStart = ev.actualStart || ev.plannedStart
      const effectiveEnd = ev.actualEnd || ev.plannedEnd || effectiveStart

      const startPct = dateToPct(effectiveStart, ganttStartMs, totalMs)
      const endPct = Math.min(100, dateToPct(effectiveEnd, ganttStartMs, totalMs) + (86400000 / totalMs) * 100)
      const widthPct = Math.max(0.5, endPct - startPct)

      // Smart label
      const daysSpan = Math.max(1, Math.round((widthPct / 100) * (totalMs / 86400000)))
      const widthPx = (widthPct / 100) * totalWidth
      let label: string
      if (widthPx >= 200) {
        const startD = effectiveStart.slice(5, 10).replace('-', '/')
        const endD = effectiveEnd.slice(5, 10).replace('-', '/')
        label = `${ev.checkName} — ${startD}–${endD}`
      } else if (widthPx >= 120) {
        label = `${ev.checkCode} — ${daysSpan}d`
      } else if (widthPx >= 50) {
        label = ev.checkCode
      } else {
        label = ''
      }

      return { ev, startPct, widthPct, label, daysSpan }
    })
  }, [row.events, ganttStartMs, totalMs, totalWidth])

  // Forecast markers
  const markers = useMemo(() => {
    return row.forecasts.map((f) => ({
      ...f,
      leftPct: dateToPct(f.dueDate, ganttStartMs, totalMs),
    }))
  }, [row.forecasts, ganttStartMs, totalMs])

  const handleContextMenu = (e: React.MouseEvent, ev?: MxEventRow) => {
    e.preventDefault()
    setContextMenu({
      type: ev ? 'event' : 'aircraft',
      x: e.clientX,
      y: e.clientY,
      aircraftId: row.aircraftId,
      registration: row.registration,
      event: ev,
    })
  }

  return (
    <div
      className="relative"
      style={{ height: rowHeight, borderBottom: `1px solid ${border}` }}
      onContextMenu={(e) => handleContextMenu(e)}
    >
      {/* Day cell backgrounds */}
      <div className="absolute inset-0 flex pointer-events-none">
        {days.map((day) => (
          <div
            key={day.dateStr}
            className="shrink-0 h-full"
            style={{
              width: dayWidth,
              borderRight: `1px solid ${border}`,
              background: day.isToday ? todayBg : day.isWeekend ? weekendBg : undefined,
            }}
          />
        ))}
      </div>

      {/* Forecast markers */}
      {markers.map((m, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 z-[5] pointer-events-none"
          style={{
            left: `${m.leftPct}%`,
            width: 3,
            background: m.trigger === 'hours' ? '#FF3B3B' : m.trigger === 'cycles' ? '#FF8800' : '#7C3AED',
          }}
        >
          <span
            className="absolute -top-0.5 left-1 text-[9px] font-bold whitespace-nowrap"
            style={{
              color: m.trigger === 'hours' ? '#FF3B3B' : m.trigger === 'cycles' ? '#FF8800' : '#7C3AED',
            }}
          >
            {m.checkCode} {m.trigger === 'hours' ? 'h' : m.trigger === 'cycles' ? 'c' : 'cal'}
          </span>
        </div>
      ))}

      {/* Event bars */}
      {bars.map(({ ev, startPct, widthPct, label }) => {
        const isProposed = ev.source === 'auto_proposed'
        const isSelected = selectedEventId === ev.id
        const bgColor = colorMode === 'status' ? STATUS_COLORS[ev.status] || '#6b7280' : ev.checkColor || '#6b7280'
        const textColor = getContrastText(bgColor)

        return (
          <div
            key={ev.id}
            className="absolute z-[6] flex items-center px-1.5 cursor-pointer transition-all"
            style={{
              left: `${startPct}%`,
              width: `${widthPct}%`,
              top: 4,
              bottom: 4,
              borderRadius: 5,
              background: bgColor,
              border: isProposed ? `2px dashed rgba(255,255,255,0.4)` : `1px solid rgba(255,255,255,0.15)`,
              boxShadow: isSelected
                ? `0 0 0 2px var(--module-accent, #1e40af), 0 2px 8px rgba(0,0,0,0.2)`
                : '0 1px 3px rgba(0,0,0,0.15)',
              opacity: isProposed ? 0.85 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation()
              selectEvent(ev)
            }}
            onContextMenu={(e) => {
              e.stopPropagation()
              handleContextMenu(e, ev)
            }}
          >
            {label && (
              <span className="text-[11px] font-semibold truncate leading-none" style={{ color: textColor }}>
                {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export const PlanningGanttRow = memo(PlanningGanttRowInner)
