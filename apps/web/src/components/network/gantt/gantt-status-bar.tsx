"use client"

import { useEffect, useState } from 'react'
import { Plane, Clock, Radio } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
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
  const palette = isDark ? colors.dark : colors.light

  const zoomLevel = useGanttStore(s => s.zoomLevel)
  const periodFrom = useGanttStore(s => s.periodFrom)
  const periodTo = useGanttStore(s => s.periodTo)
  const flights = useGanttStore(s => s.flights)
  const aircraft = useGanttStore(s => s.aircraft)
  const swapMode = useGanttStore(s => s.swapMode)

  const [utcTime, setUtcTime] = useState(formatUtcClock)

  useEffect(() => {
    const id = setInterval(() => setUtcTime(formatUtcClock()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="h-6 shrink-0 flex items-center justify-between px-3 select-none"
      style={{ background: palette.backgroundSecondary, color: palette.textTertiary, fontSize: 11 }}
    >
      <div className="flex items-center gap-3 font-mono">
        {swapMode && (
          <>
            <span className="flex items-center gap-1 font-semibold" style={{ color: '#FF8800' }}>
              SWAP MODE — Click a flight on another aircraft to swap, Escape to cancel
            </span>
            <span style={{ opacity: 0.3 }}>·</span>
          </>
        )}
        <span className="flex items-center gap-1">
          <Plane size={11} /> {flights.length} flights
        </span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="flex items-center gap-1">
          <Plane size={11} style={{ transform: 'scaleX(-1)' }} /> {aircraft.length} aircraft
        </span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="font-semibold">{zoomLevel} view</span>
      </div>

      <div className="flex items-center gap-3 font-mono">
        <span className="flex items-center gap-1"><Clock size={11} /> UTC {utcTime}</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>Period: {formatPeriodShort(periodFrom, periodTo)}</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="flex items-center gap-1"><Radio size={9} color="#06C270" /> Sync Active</span>
      </div>
    </div>
  )
}
