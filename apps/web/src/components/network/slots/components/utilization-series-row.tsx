'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { api } from '@skyhub/api'
import type { SlotUtilizationSummary, SlotSeriesRef, SlotDateRef } from '@skyhub/api'
import { formatSlotTime } from '../slot-types'
import type { OperationStatus } from '../slot-types'

interface UtilizationSeriesRowProps {
  utilization: SlotUtilizationSummary
  series: SlotSeriesRef
  isDark: boolean
}

const STATUS_DOT_COLORS: Record<string, string> = {
  operated: '#06C270',
  cancelled: '#FF3B3B',
  no_show: '#FF3B3B',
  jnus: '#FF8800',
  scheduled: '#8F90A6',
}

export function UtilizationSeriesRow({ utilization, series, isDark }: UtilizationSeriesRowProps) {
  const palette = isDark ? colors.dark : colors.light
  const [expanded, setExpanded] = useState(false)
  const [dates, setDates] = useState<SlotDateRef[]>([])

  useEffect(() => {
    if (expanded && dates.length === 0) {
      api.getSlotDates(series._id).then(setDates)
    }
  }, [expanded, dates.length, series._id])

  const pctColor = utilization.isAtRisk ? '#FF3B3B' : utilization.isClose ? '#FF8800' : '#06C270'
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  return (
    <div className="mb-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${glassBorder}` }}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }}
      >
        {expanded ? (
          <ChevronDown size={14} style={{ color: palette.textSecondary }} />
        ) : (
          <ChevronRight size={14} style={{ color: palette.textSecondary }} />
        )}

        {/* Flight info */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-mono font-semibold" style={{ color: palette.text }}>
            {series.arrivalFlightNumber || '\u2014'} / {series.departureFlightNumber || '\u2014'}
          </div>
          <div className="text-[13px]" style={{ color: palette.textSecondary }}>
            {series.arrivalOriginIata || '?'}
            {' → '}
            {series.airportIata}
            {' → '}
            {series.departureDestIata || '?'}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 shrink-0">
          <StatPill label="Operated" value={utilization.operated} color="#06C270" palette={palette} />
          <StatPill label="Cancelled" value={utilization.cancelled} color="#FF3B3B" palette={palette} />
          <StatPill label="JNUS" value={utilization.jnus} color="#FF8800" palette={palette} />
          <StatPill label="Sched" value={utilization.scheduled} color="#8F90A6" palette={palette} />
        </div>

        {/* Utilization percentage */}
        <div className="w-16 text-right shrink-0">
          <div className="text-[14px] font-bold font-mono" style={{ color: pctColor }}>
            {utilization.utilizationPct}%
          </div>
          <div
            className="h-[3px] rounded-full mt-1 overflow-hidden"
            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${utilization.utilizationPct}%`, background: pctColor }}
            />
          </div>
        </div>
      </button>

      {/* Expanded dates */}
      {expanded && dates.length > 0 && (
        <div className="px-4 pb-3 pt-1 grid grid-cols-7 gap-1">
          {dates.map((d) => {
            const dotColor = STATUS_DOT_COLORS[d.operationStatus] || '#8F90A6'
            const dateLabel = d.slotDate.slice(5) // MM-DD
            return (
              <div
                key={d._id}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded text-[13px]"
                style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                <span className="font-mono" style={{ color: palette.textSecondary }}>
                  {dateLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {expanded && dates.length === 0 && (
        <div className="px-4 pb-3 text-[13px]" style={{ color: palette.textTertiary }}>
          No dates expanded for this series
        </div>
      )}
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
  palette,
}: {
  label: string
  value: number
  color: string
  palette: { textSecondary: string }
}) {
  return (
    <div className="text-center">
      <div className="text-[13px] font-mono font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[13px] uppercase tracking-wide" style={{ color: palette.textSecondary }}>
        {label}
      </div>
    </div>
  )
}
