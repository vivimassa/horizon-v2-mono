'use client'

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'
import type { MxGanttAircraftRow } from '@skyhub/api'
import { PlanningGanttRow } from './planning-gantt-row'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface DayCol {
  date: Date
  dateStr: string
  isToday: boolean
  isWeekend: boolean
}

export function PlanningGantt() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const rows = useMaintenancePlanningStore((s) => s.rows)
  const periodFrom = useMaintenancePlanningStore((s) => s.committedFrom)
  const periodTo = useMaintenancePlanningStore((s) => s.committedTo)
  const zoomDays = useMaintenancePlanningStore((s) => s.zoomDays)
  const collapsedTypes = useMaintenancePlanningStore((s) => s.collapsedTypes)
  const rowHeight = useMaintenancePlanningStore((s) => s.rowHeight)
  const colorMode = useMaintenancePlanningStore((s) => s.colorMode)
  const toggleCollapsedType = useMaintenancePlanningStore((s) => s.toggleCollapsedType)
  const selectedEvent = useMaintenancePlanningStore((s) => s.selectedEvent)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const hScrollRef = useRef<HTMLDivElement>(null)
  const headerDateRef = useRef<HTMLDivElement>(null)
  const bodyDateRef = useRef<HTMLDivElement>(null)
  const monthRowRef = useRef<HTMLDivElement>(null)

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerWidth(Math.max(200, el.offsetWidth - 200))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const dayWidth = zoomDays > 0 ? Math.max(40, Math.floor(containerWidth / zoomDays)) : 80

  // Compute day columns
  const { days, ganttStartMs, totalMs, todayStr, todayPct } = useMemo(() => {
    const [sy, sm, sd] = periodFrom.split('-').map(Number)
    const [ey, em, ed] = periodTo.split('-').map(Number)
    const startMs = Date.UTC(sy, sm - 1, sd)
    const endMs = Date.UTC(ey, em - 1, ed) + 86400000
    const total = endMs - startMs
    const numDays = Math.round(total / 86400000)
    const today = new Date().toISOString().slice(0, 10)

    const dayList: DayCol[] = []
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startMs + i * 86400000)
      const ds = d.toISOString().slice(0, 10)
      const dow = d.getUTCDay()
      dayList.push({ date: d, dateStr: ds, isToday: ds === today, isWeekend: dow === 0 || dow === 6 })
    }
    const todayPctVal = Math.max(0, Math.min(100, ((Date.now() - startMs) / total) * 100))
    return { days: dayList, ganttStartMs: startMs, totalMs: total, todayStr: today, todayPct: todayPctVal }
  }, [periodFrom, periodTo])

  // Month spans
  const monthSpans = useMemo(() => {
    const spans: { month: number; year: number; span: number }[] = []
    for (const day of days) {
      const m = day.date.getUTCMonth()
      const y = day.date.getUTCFullYear()
      const last = spans[spans.length - 1]
      if (last && last.month === m && last.year === y) last.span++
      else spans.push({ month: m, year: y, span: 1 })
    }
    return spans
  }, [days])

  // Group aircraft by type
  const acTypeGroups = useMemo(() => {
    const groupMap = new Map<string, { active: MxGanttAircraftRow[]; empty: MxGanttAircraftRow[]; color: string }>()
    for (const row of rows) {
      const type = row.icaoType || 'UNKN'
      if (!groupMap.has(type)) groupMap.set(type, { active: [], empty: [], color: row.acTypeColor || '' })
      const group = groupMap.get(type)!
      if (row.events.length > 0 || row.forecasts.length > 0) group.active.push(row)
      else group.empty.push(row)
    }
    return Array.from(groupMap.entries()).sort((a, b) => {
      if (a[1].active.length > 0 && b[1].active.length === 0) return -1
      if (a[1].active.length === 0 && b[1].active.length > 0) return 1
      return a[0].localeCompare(b[0])
    })
  }, [rows])

  const totalWidth = days.length * dayWidth

  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const headerText = isDark ? '#F5F2FD' : '#1C1C28'
  const muted = isDark ? '#8F90A6' : '#555770'
  const todayBg = isDark ? 'rgba(62,123,250,0.06)' : 'rgba(30,64,175,0.04)'
  const weekendBg = isDark ? 'rgba(62,123,250,0.03)' : 'rgba(30,64,175,0.02)'
  const accentColor = 'var(--module-accent, #1e40af)'

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0" ref={containerRef}>
      {/* Header: month row + day row */}
      <div className="shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
        {/* Month row */}
        <div className="flex h-[22px]">
          <div className="w-[200px] shrink-0" style={{ borderRight: `1px solid ${border}` }} />
          <div className="flex-1 overflow-hidden min-w-0">
            <div ref={monthRowRef} className="flex h-[22px]" style={{ width: totalWidth }}>
              {monthSpans.map((ms, i) => (
                <div
                  key={i}
                  className="text-[13px] font-bold flex items-center px-2 shrink-0 overflow-hidden"
                  style={{
                    width: ms.span * dayWidth,
                    color: `${headerText}B3`,
                    borderRight: `1px solid ${border}`,
                  }}
                >
                  {MONTH_NAMES[ms.month]} {ms.year}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Day row */}
        <div className="flex h-[24px]" style={{ borderTop: `1px solid ${border}` }}>
          <div
            className="w-[200px] shrink-0 px-3 flex items-center text-[13px] font-bold uppercase tracking-wider"
            style={{ color: muted, borderRight: `1px solid ${border}` }}
          >
            Aircraft
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <div ref={headerDateRef} className="flex h-[24px]" style={{ width: totalWidth }}>
              {days.map((day) => (
                <div
                  key={day.dateStr}
                  className="text-center font-mono flex items-center justify-center shrink-0 overflow-hidden gap-0.5"
                  style={{
                    width: dayWidth,
                    borderRight: `1px solid ${border}`,
                    background: day.isToday ? todayBg : day.isWeekend ? weekendBg : undefined,
                    color: day.isToday ? accentColor : day.isWeekend ? `${accentColor}99` : muted,
                    fontWeight: day.isToday ? 600 : 400,
                  }}
                >
                  {dayWidth >= 60 && (
                    <span className="text-[11px] uppercase opacity-50">{DAY_NAMES[day.date.getUTCDay()]}</span>
                  )}
                  <span className="text-[13px] font-bold leading-none">{day.date.getUTCDate()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body: flex row — labels pinned left, grid scrolls both axes */}
      <div className="flex-1 flex min-h-0">
        {/* Aircraft labels (pinned, vertical-scroll synced) */}
        <div className="w-[200px] shrink-0 overflow-hidden" style={{ borderRight: `1px solid ${border}` }}>
          <div ref={bodyDateRef} className="overflow-hidden">
            {acTypeGroups.map(([type, group]) => {
              const isCollapsed = collapsedTypes.has(type)
              const allRows = [...group.active, ...group.empty]
              const visibleRows = isCollapsed ? [] : allRows
              return (
                <div key={type}>
                  <button
                    onClick={() => toggleCollapsedType(type)}
                    className="w-full flex items-center gap-1.5 px-3 h-[28px] text-[13px] font-semibold"
                    style={{
                      color: group.color || muted,
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      borderBottom: `1px solid ${border}`,
                    }}
                  >
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    {type}
                    <span className="text-[11px] font-normal" style={{ color: muted }}>
                      ({allRows.length})
                    </span>
                  </button>
                  {visibleRows.map((row) => (
                    <div
                      key={row.aircraftId}
                      className="flex items-center px-3 text-[13px] font-mono"
                      style={{
                        height: rowHeight,
                        color: row.events.length > 0 ? headerText : `${muted}80`,
                        borderBottom: `1px solid ${border}`,
                        borderLeft: `3px solid ${row.acTypeColor || 'transparent'}`,
                      }}
                    >
                      {row.registration}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* Date grid area — scrolls both X and Y, labels scroll is synced */}
        <div
          className="flex-1 min-w-0 overflow-auto"
          data-mx-gantt-scroll
          ref={hScrollRef}
          onScroll={() => {
            const el = hScrollRef.current
            if (!el) return
            // Sync horizontal scroll to headers
            const sl = el.scrollLeft
            const tx = `translateX(-${sl}px)`
            if (headerDateRef.current) headerDateRef.current.style.transform = tx
            if (monthRowRef.current) monthRowRef.current.style.transform = tx
            // Sync vertical scroll to labels
            if (bodyDateRef.current) bodyDateRef.current.style.transform = `translateY(-${el.scrollTop}px)`
          }}
        >
          <div style={{ width: totalWidth, position: 'relative' }}>
            {/* Today line */}
            {todayPct > 0 && todayPct < 100 && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: `${todayPct}%`, width: 2, background: '#FF3B3B' }}
              />
            )}

            {acTypeGroups.map(([type, group]) => {
              const isCollapsed = collapsedTypes.has(type)
              const allRows = [...group.active, ...group.empty]
              const visibleRows = isCollapsed ? [] : allRows
              return (
                <div key={type}>
                  <div className="h-[28px]" style={{ borderBottom: `1px solid ${border}` }} />
                  {visibleRows.map((row) => (
                    <PlanningGanttRow
                      key={row.aircraftId}
                      row={row}
                      days={days}
                      dayWidth={dayWidth}
                      ganttStartMs={ganttStartMs}
                      totalMs={totalMs}
                      rowHeight={rowHeight}
                      colorMode={colorMode}
                      selectedEventId={selectedEvent?.id ?? null}
                      isDark={isDark}
                      border={border}
                      todayBg={todayBg}
                      weekendBg={weekendBg}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className="shrink-0 flex items-center gap-4 px-4 py-1.5 text-[11px]"
        style={{ borderTop: `1px solid ${border}`, color: muted }}
      >
        <LegendItem label="Auto-proposed" dashed color="#3B82F6" />
        <LegendItem label="Planned / Confirmed" color="#6b7280" />
        <LegendItem label="In progress" color="#06C270" filled />
        <LegendDot label="Hours limit" color="#FF3B3B" />
        <LegendDot label="Cycles limit" color="#FF8800" />
        <LegendDot label="Calendar limit" color="#7C3AED" />
      </div>
    </div>
  )
}

function LegendItem({
  label,
  color,
  dashed,
  filled,
}: {
  label: string
  color: string
  dashed?: boolean
  filled?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-[20px] h-[10px] rounded-sm"
        style={{
          background: filled ? color : `${color}30`,
          border: `1.5px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }}
      />
      <span>{label}</span>
    </div>
  )
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[3px] h-[12px] rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  )
}
