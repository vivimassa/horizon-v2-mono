import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import type { SlotSeriesRef } from '@skyhub/api'
import { STATUS_CHIP_CLASSES, PRIORITY_LABELS, formatSlotTime, formatPeriod } from '../slot-types'
import type { SlotStatus, PriorityCategory } from '../slot-types'

interface SeriesTableRowProps {
  series: SlotSeriesRef
  onViewDetail: (id: string) => void
  isDark: boolean
}

export function SeriesTableRow({ series, onViewDetail, isDark }: SeriesTableRowProps) {
  const [expanded, setExpanded] = useState(false)
  const palette = isDark ? colors.dark : colors.light
  const chipStyle = STATUS_CHIP_CLASSES[series.status] || STATUS_CHIP_CLASSES.draft

  return (
    <>
      <tr
        className="transition-colors duration-100 cursor-pointer"
        style={{
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }}
      >
        <td className="px-3 py-2.5 w-8">
          {expanded ? (
            <ChevronDown size={14} style={{ color: palette.textSecondary }} />
          ) : (
            <ChevronRight size={14} style={{ color: palette.textSecondary }} />
          )}
        </td>
        <td className="px-3 py-2.5 text-[13px] font-mono font-semibold" style={{ color: palette.text }}>
          {series.arrivalFlightNumber || '\u2014'}
        </td>
        <td className="px-3 py-2.5 text-[13px] font-mono font-semibold" style={{ color: palette.text }}>
          {series.departureFlightNumber || '\u2014'}
        </td>
        <td className="px-3 py-2.5 text-[13px]" style={{ color: palette.textSecondary }}>
          {series.arrivalOriginIata || '\u2014'}
        </td>
        <td className="px-3 py-2.5 text-[13px]" style={{ color: palette.textSecondary }}>
          {series.departureDestIata || '\u2014'}
        </td>
        <td className="px-3 py-2.5 text-[13px] font-mono" style={{ color: palette.textSecondary }}>
          {formatSlotTime(series.requestedArrivalTime)}
        </td>
        <td className="px-3 py-2.5 text-[13px] font-mono" style={{ color: palette.textSecondary }}>
          {formatSlotTime(series.requestedDepartureTime)}
        </td>
        <td className="px-3 py-2.5 text-[13px]" style={{ color: palette.textSecondary }}>
          {formatPeriod(series.periodStart, series.periodEnd)}
        </td>
        <td className="px-3 py-2.5">
          <span
            className="text-[13px] font-semibold px-2 py-0.5 rounded-md inline-block"
            style={{ background: chipStyle.bg, color: chipStyle.text, border: `1px solid ${chipStyle.border}` }}
          >
            {series.status}
          </span>
        </td>
        <td className="px-3 py-2.5 text-[13px]" style={{ color: palette.textSecondary }}>
          {PRIORITY_LABELS[series.priorityCategory as PriorityCategory] || series.priorityCategory}
        </td>
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onViewDetail(series._id)
            }}
            className="p-1 rounded-md transition-colors hover:opacity-80"
            style={{ color: MODULE_THEMES.network.accent }}
          >
            <Eye size={14} />
          </button>
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr>
          <td
            colSpan={11}
            className="px-6 py-3"
            style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}
          >
            <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-[13px]">
              <Detail label="Aircraft" value={series.aircraftTypeIcao} palette={palette} />
              <Detail label="Seats" value={series.seats?.toString()} palette={palette} />
              <Detail label="DOW" value={series.daysOfOperation} mono palette={palette} />
              <Detail label="Frequency" value={series.frequencyRate === 1 ? 'Weekly' : 'Biweekly'} palette={palette} />
              <Detail label="Alloc. Arr" value={formatSlotTime(series.allocatedArrivalTime)} mono palette={palette} />
              <Detail label="Alloc. Dep" value={formatSlotTime(series.allocatedDepartureTime)} mono palette={palette} />
              <Detail label="Last Action" value={series.lastActionCode} palette={palette} />
              <Detail label="Coord. Code" value={series.lastCoordinatorCode} palette={palette} />
              {series.notes && (
                <div className="col-span-4 text-[13px]" style={{ color: palette.textSecondary }}>
                  Notes: {series.notes}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Detail({
  label,
  value,
  mono,
  palette,
}: {
  label: string
  value?: string | null
  mono?: boolean
  palette: { text: string; textSecondary: string }
}) {
  return (
    <div>
      <span style={{ color: palette.textSecondary }}>{label}: </span>
      <span className={mono ? 'font-mono' : ''} style={{ color: palette.text }}>
        {value || '\u2014'}
      </span>
    </div>
  )
}
