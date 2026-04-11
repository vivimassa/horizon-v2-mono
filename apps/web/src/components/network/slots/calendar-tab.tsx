'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { colors } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import type { SlotCoordinatedAirport, SlotSeriesRef, SlotCalendarWeekRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'

interface CalendarTabProps {
  airport: SlotCoordinatedAirport
  seasonCode: string
  onNavigateToUtilization: () => void
  isDark: boolean
}

export function CalendarTab({ airport, seasonCode, onNavigateToUtilization, isDark }: CalendarTabProps) {
  const palette = isDark ? colors.dark : colors.light
  const [calendar, setCalendar] = useState<Record<string, SlotCalendarWeekRef[]>>({})
  const [seriesList, setSeriesList] = useState<SlotSeriesRef[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const opId = getOperatorId()
      const [cal, series] = await Promise.all([
        api.getSlotCalendar(opId, airport.iataCode, seasonCode),
        api.getSlotSeries(opId, airport.iataCode, seasonCode),
      ])
      setCalendar(cal)
      setSeriesList(series)
    } finally {
      setLoading(false)
    }
  }, [airport.iataCode, seasonCode])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Compute all week numbers across all series
  const allWeeks = useMemo(() => {
    const weeks = new Set<number>()
    for (const wks of Object.values(calendar)) {
      for (const w of wks) weeks.add(w.weekNumber)
    }
    return Array.from(weeks).sort((a, b) => a - b)
  }, [calendar])

  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  if (seriesList.length === 0 && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[13px]" style={{ color: palette.textTertiary }}>
          No slot series to display
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {/* Fixed left labels */}
      <div className="w-[220px] shrink-0 overflow-y-auto" style={{ borderRight: `1px solid ${glassBorder}` }}>
        {/* Header spacer */}
        <div
          className="h-8 px-3 flex items-center text-[13px] uppercase tracking-wide font-medium"
          style={{ color: palette.textTertiary, borderBottom: `1px solid ${glassBorder}` }}
        >
          Series
        </div>

        {seriesList.map((s) => (
          <div
            key={s._id}
            className="h-7 px-3 flex items-center gap-2 truncate"
            style={{ borderBottom: `1px solid ${glassBorder}` }}
          >
            <span className="text-[13px] font-mono font-semibold truncate" style={{ color: palette.text }}>
              {s.arrivalFlightNumber || ''}
              {s.departureFlightNumber ? `/${s.departureFlightNumber}` : ''}
            </span>
            <span className="text-[13px] shrink-0" style={{ color: palette.textTertiary }}>
              {s.arrivalOriginIata || ''}\u2192{s.departureDestIata || ''}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-auto">
        {/* Week headers */}
        <div
          className="flex sticky top-0"
          style={{ background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)' }}
        >
          {allWeeks.map((wk) => (
            <div
              key={wk}
              className="w-8 h-8 shrink-0 flex items-center justify-center text-[13px] font-mono"
              style={{
                color: palette.textTertiary,
                borderBottom: `1px solid ${glassBorder}`,
                borderRight: `1px solid ${glassBorder}`,
              }}
            >
              {wk}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {seriesList.map((s) => {
          const weeks = calendar[s._id] || []
          const weekMap = new Map(weeks.map((w) => [w.weekNumber, w]))

          return (
            <div key={s._id} className="flex">
              {allWeeks.map((wk) => {
                const w = weekMap.get(wk)
                if (!w) {
                  return (
                    <div
                      key={wk}
                      className="w-8 h-7 shrink-0"
                      style={{ borderBottom: `1px solid ${glassBorder}`, borderRight: `1px solid ${glassBorder}` }}
                    />
                  )
                }

                // Compute color ratio
                const utilPct = w.total > 0 ? (w.operated + w.jnus) / w.total : 0
                let cellColor: string
                if (utilPct >= 0.8) cellColor = '#06C270'
                else if (utilPct >= 0.5) cellColor = '#FF8800'
                else if (w.total > 0) cellColor = '#FF3B3B'
                else cellColor = 'transparent'

                return (
                  <div
                    key={wk}
                    className="w-8 h-7 shrink-0 flex items-center justify-center cursor-pointer"
                    style={{ borderBottom: `1px solid ${glassBorder}`, borderRight: `1px solid ${glassBorder}` }}
                    title={`W${wk}: ${w.operated} operated, ${w.cancelled} cancelled, ${w.jnus} JNUS / ${w.total} total`}
                  >
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ background: cellColor, opacity: 0.7 + utilPct * 0.3 }}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
