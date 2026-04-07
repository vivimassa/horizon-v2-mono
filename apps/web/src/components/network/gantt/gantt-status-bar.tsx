"use client"

import { useEffect, useState } from 'react'
import { Plane, Clock, Radio } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'

function formatUtcClock(): string {
  const d = new Date()
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function formatPeriodShort(from: string, to: string): string {
  const f = new Date(from + 'T12:00:00Z')
  const t = new Date(to + 'T12:00:00Z')
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const fd = String(f.getUTCDate()).padStart(2, '0')
  const td = String(t.getUTCDate()).padStart(2, '0')
  return f.getUTCMonth() === t.getUTCMonth()
    ? `${fd}–${td} ${mon[t.getUTCMonth()]} ${t.getUTCFullYear()}`
    : `${fd} ${mon[f.getUTCMonth()]}–${td} ${mon[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}

export function GanttStatusBar() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const layout = useGanttStore(s => s.layout)
  const zoomLevel = useGanttStore(s => s.zoomLevel)
  const periodFrom = useGanttStore(s => s.periodFrom)
  const periodTo = useGanttStore(s => s.periodTo)
  const flights = useGanttStore(s => s.flights)
  const aircraft = useGanttStore(s => s.aircraft)

  const [utcTime, setUtcTime] = useState(formatUtcClock)

  useEffect(() => {
    const id = setInterval(() => setUtcTime(formatUtcClock()), 60_000)
    return () => clearInterval(id)
  }, [])

  const flightCount = flights.length
  const acCount = aircraft.length
  const bg = isDark ? '#0a0a0f' : '#eeeef1'
  const textColor = isDark ? '#8C90A2' : '#6b7280'
  const dotColor = '#06C270'

  return (
    <div
      className="h-6 shrink-0 flex items-center justify-between px-3 select-none"
      style={{ background: bg, color: textColor, fontSize: 10 }}
    >
      <div className="flex items-center gap-3 font-mono">
        <span className="flex items-center gap-1">
          <Plane size={10} />
          {flightCount} flights
        </span>
        <span className="opacity-30">·</span>
        <span className="flex items-center gap-1">
          <Plane size={10} style={{ transform: 'scaleX(-1)' }} />
          {acCount} aircraft
        </span>
        <span className="opacity-30">·</span>
        <span className="font-semibold">{zoomLevel} view</span>
      </div>

      <div className="flex items-center gap-3 font-mono">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          UTC {utcTime}
        </span>
        <span className="opacity-30">·</span>
        <span>Period: {formatPeriodShort(periodFrom, periodTo)}</span>
        <span className="opacity-30">·</span>
        <span className="flex items-center gap-1">
          <Radio size={8} color={dotColor} />
          Sync Active
        </span>
      </div>
    </div>
  )
}
