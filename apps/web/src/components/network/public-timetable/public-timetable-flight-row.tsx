'use client'

import { memo } from 'react'
import { useTheme } from '@/components/theme-provider'
import {
  countOperatingDays,
  expandDowBitmap,
  formatDurationHm,
  getFrequencyTags,
  type TimetableFlight,
} from '@/lib/public-timetable/logic'

interface RowProps {
  flight: TimetableFlight
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function formatShortDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()
}

function PublicTimetableFlightRowImpl({ flight }: RowProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const rowBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.75)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const dows = expandDowBitmap(flight.daysOfWeek)
  const totalDays = countOperatingDays(flight.daysOfWeek)
  const tags = getFrequencyTags(flight.daysOfWeek)
  const isNonstop = true

  const accent = 'var(--module-accent, #2563eb)'
  const pillActiveBg = isDark ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.12)'
  const pillActiveText = 'var(--module-accent, #2563eb)'
  const pillInactiveBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const pillInactiveText = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'

  return (
    <div
      className="relative grid items-center rounded-xl overflow-hidden"
      style={{
        gridTemplateColumns: '140px 120px 1fr 120px 200px 220px 110px',
        gap: 16,
        background: rowBg,
        border: `1px solid ${border}`,
        padding: '14px 18px',
        boxShadow: isDark ? 'none' : '0 1px 2px rgba(96,97,112,0.06)',
      }}
    >
      <span
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 3, background: accent, opacity: totalDays === 0 ? 0.25 : 0.85 }}
        aria-hidden
      />

      {/* Flight */}
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-hz-text-tertiary">{flight.airlineCode}</span>
        <span className="text-[18px] font-bold text-hz-text">{flight.flightNumber}</span>
      </div>

      {/* Departs */}
      <div className="flex flex-col items-center">
        <span className="text-[18px] font-bold text-hz-text tabular-nums">{flight.stdLocal}</span>
        <span className="text-[13px] font-medium text-hz-text-tertiary mt-0.5">{flight.depStation}</span>
      </div>

      {/* Duration */}
      <div className="flex items-center justify-center gap-2">
        <span className="flex-1 h-px" style={{ background: border }} />
        <span className="text-[13px] font-medium text-hz-text-secondary tabular-nums">
          {formatDurationHm(flight.blockMinutes)}
        </span>
        <span className="flex-1 h-px" style={{ background: border }} />
      </div>

      {/* Arrives */}
      <div className="flex flex-col items-center">
        <span className="text-[18px] font-bold text-hz-text tabular-nums">
          {flight.staLocal}
          {flight.arrivalDayOffset !== 0 && (
            <span className="text-[13px] font-semibold align-top ml-0.5" style={{ color: accent }}>
              {flight.arrivalDayOffset > 0 ? `+${flight.arrivalDayOffset}` : `${flight.arrivalDayOffset}`}
            </span>
          )}
        </span>
        <span className="text-[13px] font-medium text-hz-text-tertiary mt-0.5">{flight.arrStation}</span>
      </div>

      {/* Aircraft */}
      <div className="flex flex-col">
        <span className="text-[13px] font-semibold text-hz-text">{flight.aircraftName || '--'}</span>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[13px] font-semibold rounded-md px-1.5 py-0.5"
            style={{
              color: 'var(--module-accent, #2563eb)',
              background: isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.10)',
            }}
          >
            {flight.aircraftTypeIcao || '---'}
          </span>
          {flight.paxCapacity > 0 && (
            <span className="text-[13px] font-medium text-hz-text-tertiary">{flight.paxCapacity} pax</span>
          )}
        </div>
      </div>

      {/* Operates */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          {DOW_LABELS.map((d, i) => {
            const active = dows[i]
            return (
              <span
                key={i}
                className="inline-flex items-center justify-center rounded-md text-[13px] font-medium"
                style={{
                  width: 24,
                  height: 22,
                  background: active ? pillActiveBg : pillInactiveBg,
                  color: active ? pillActiveText : pillInactiveText,
                }}
              >
                {d}
              </span>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[13px] font-semibold uppercase tracking-wide px-1.5 rounded"
              style={{ color: pillActiveText }}
            >
              {t}
            </span>
          ))}
          {isNonstop && (
            <span
              className="text-[13px] font-semibold uppercase tracking-wide px-1.5 rounded"
              style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
            >
              Nonstop
            </span>
          )}
        </div>
      </div>

      {/* Effective dates */}
      <div className="flex flex-col items-end">
        <span className="text-[13px] font-medium text-hz-text-tertiary uppercase tracking-wide">Effective</span>
        <span className="text-[13px] font-semibold text-hz-text tabular-nums mt-0.5">
          {formatShortDate(flight.effectiveFrom)} – {formatShortDate(flight.effectiveUntil)}
        </span>
      </div>
    </div>
  )
}

export const PublicTimetableFlightRow = memo(PublicTimetableFlightRowImpl)
