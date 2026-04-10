"use client"

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, ArrowDown, ArrowUp, Clock } from 'lucide-react'
import { colors, accentTint } from '@skyhub/ui/theme'
import { MODULE_THEMES } from '@skyhub/constants'
import { api } from '@skyhub/api'
import type { SlotSeriesRef, SlotUtilizationSummary, SlotDateRef, SlotActionLogRef } from '@skyhub/api'
import {
  STATUS_CHIP_CLASSES, PRIORITY_LABELS, ACTION_CODE_LABELS,
  formatSlotTime, formatPeriod,
} from '../slot-types'
import type { PriorityCategory } from '../slot-types'

interface UnifiedSeriesRowProps {
  series: SlotSeriesRef
  utilization?: SlotUtilizationSummary
  onDataChanged: () => void
  isDark: boolean
}

const STATUS_DOT: Record<string, string> = {
  operated: '#06C270', cancelled: '#FF3B3B', no_show: '#FF3B3B',
  jnus: '#FF8800', scheduled: '#8F90A6',
}

export function UnifiedSeriesRow({ series, utilization, onDataChanged, isDark }: UnifiedSeriesRowProps) {
  const palette = isDark ? colors.dark : colors.light
  const accent = MODULE_THEMES.network.accent
  const [expanded, setExpanded] = useState(false)
  const [dates, setDates] = useState<SlotDateRef[]>([])
  const [actionLog, setActionLog] = useState<SlotActionLogRef[]>([])
  const [loadedDetail, setLoadedDetail] = useState(false)

  useEffect(() => {
    if (expanded && !loadedDetail) {
      Promise.all([
        api.getSlotDates(series._id),
        api.getSlotActionLog(series._id),
      ]).then(([d, a]) => {
        setDates(d)
        setActionLog(a)
        setLoadedDetail(true)
      })
    }
  }, [expanded, loadedDetail, series._id])

  const chipStyle = STATUS_CHIP_CLASSES[series.status] || STATUS_CHIP_CLASSES.draft
  const pct = utilization?.utilizationPct ?? 0
  const hasDates = (utilization?.totalDates ?? 0) > 0
  const pctColor = pct < 80 ? '#FF3B3B' : pct < 85 ? '#FF8800' : '#06C270'
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  return (
    <div className="mb-2 rounded-xl overflow-hidden transition-all"
      style={{ border: `1px solid ${glassBorder}` }}>
      {/* Main row — grid layout fills full width */}
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full grid items-center gap-x-3 px-4 py-3 text-left transition-colors"
        style={{
          gridTemplateColumns: '20px 2fr 1.2fr 1fr 0.6fr 0.8fr 0.8fr 2fr',
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)' }}
        onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>

        {/* 1. Expand chevron */}
        {expanded
          ? <ChevronDown size={14} style={{ color: palette.textSecondary }} />
          : <ChevronRight size={14} style={{ color: palette.textSecondary }} />
        }

        {/* 2. Flight numbers + route */}
        <div className="min-w-0">
          <div className="text-[13px] font-mono font-bold" style={{ color: palette.text }}>
            {series.arrivalFlightNumber || '\u2014'} / {series.departureFlightNumber || '\u2014'}
          </div>
          <div className="text-[13px] truncate" style={{ color: palette.textSecondary }}>
            {series.arrivalOriginIata || '?'}{' → '}{series.airportIata}{' → '}{series.departureDestIata || '?'}
          </div>
        </div>

        {/* 3. Times + period */}
        <div className="min-w-0">
          <div className="text-[13px]" style={{ color: palette.text }}>
            {formatSlotTime(series.requestedArrivalTime)}{' → '}{formatSlotTime(series.requestedDepartureTime)}
          </div>
          <div className="text-[13px]" style={{ color: palette.textTertiary }}>
            {formatPeriod(series.periodStart, series.periodEnd)}
          </div>
        </div>

        {/* 4. DOW */}
        <div>
          <div className="flex gap-0.5">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
              const active = series.daysOfOperation.includes(String(i + 1))
              return (
                <span key={i} className="w-[18px] h-[22px] rounded text-[13px] font-semibold flex items-center justify-center"
                  style={{
                    background: active ? accentTint(accent, isDark ? 0.2 : 0.12) : 'transparent',
                    color: active ? accent : palette.textTertiary,
                  }}>
                  {d}
                </span>
              )
            })}
          </div>
        </div>

        {/* 5. Aircraft */}
        <span className="text-[13px]" style={{ color: palette.textSecondary }}>
          {series.aircraftTypeIcao || '\u2014'}
        </span>

        {/* 6. Status chip */}
        <div>
          <span className="text-[13px] font-semibold px-2 py-0.5 rounded-md inline-block"
            style={{ background: chipStyle.bg, color: chipStyle.text, border: `1px solid ${chipStyle.border}` }}>
            {series.status}
          </span>
        </div>

        {/* 7. Priority */}
        <span className="text-[13px] truncate" style={{ color: palette.textSecondary }}>
          {PRIORITY_LABELS[series.priorityCategory as PriorityCategory] || series.priorityCategory}
        </span>

        {/* 8. Utilization bar — fills remaining space */}
        <div>
          {hasDates ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-[5px] rounded-full overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pctColor }} />
              </div>
              <span className="text-[13px] font-bold" style={{ color: pctColor }}>
                {pct}%
              </span>
            </div>
          ) : (
            <span className="text-[13px]" style={{ color: palette.textTertiary }}>{'—'}</span>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${glassBorder}` }}>
          <div className="grid grid-cols-3 gap-4">
            {/* Column 1: Series detail */}
            <div>
              <SectionLabel text="Series Detail" accent={accent} palette={palette} />
              <div className="space-y-1 text-[13px]">
                <DetailRow label="Alloc. Arr" value={formatSlotTime(series.allocatedArrivalTime)} palette={palette} mono />
                <DetailRow label="Alloc. Dep" value={formatSlotTime(series.allocatedDepartureTime)} palette={palette} mono />
                <DetailRow label="Seats" value={series.seats?.toString()} palette={palette} />
                <DetailRow label="Frequency" value={series.frequencyRate === 1 ? 'Weekly' : 'Biweekly'} palette={palette} />
                {series.flexibilityArrival && <DetailRow label="Flex Arr" value={series.flexibilityArrival} palette={palette} mono />}
                {series.flexibilityDeparture && <DetailRow label="Flex Dep" value={series.flexibilityDeparture} palette={palette} mono />}
                {series.coordinatorRef && <DetailRow label="Coord Ref" value={series.coordinatorRef} palette={palette} />}
                {series.notes && <div className="text-[13px] mt-2 italic" style={{ color: palette.textTertiary }}>{series.notes}</div>}
              </div>
            </div>

            {/* Column 2: Date grid */}
            <div>
              <SectionLabel text={`Dates (${dates.length})`} accent={accent} palette={palette} />
              {dates.length > 0 ? (
                <div className="grid grid-cols-5 gap-1 max-h-[200px] overflow-y-auto">
                  {dates.map(d => {
                    const dotColor = STATUS_DOT[d.operationStatus] || '#8F90A6'
                    return (
                      <div key={d._id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[13px]"
                        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                        <span style={{ color: palette.textSecondary }}>{d.slotDate.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-[13px]" style={{ color: palette.textTertiary }}>No dates expanded</div>
              )}
            </div>

            {/* Column 3: Action log */}
            <div>
              <SectionLabel text="Action History" accent={accent} palette={palette} />
              {actionLog.length > 0 ? (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {actionLog.slice(0, 10).map(a => (
                    <div key={a._id} className="flex items-center gap-2 text-[13px]">
                      <span className="font-mono font-bold w-4 text-center" style={{ color: accent }}>
                        {a.actionCode}
                      </span>
                      <span className="flex-1 truncate" style={{ color: palette.textSecondary }}>
                        {ACTION_CODE_LABELS[a.actionCode] || a.actionCode}
                      </span>
                      <span className="text-[13px] px-1 py-0.5 rounded shrink-0"
                        style={{
                          background: a.actionSource === 'airline' ? 'rgba(0,99,247,0.1)' : 'rgba(124,58,237,0.1)',
                          color: a.actionSource === 'airline' ? '#0063F7' : '#7c3aed',
                        }}>
                        {a.actionSource === 'airline' ? 'AIR' : 'CRD'}
                      </span>
                      <span className="text-[13px] shrink-0" style={{ color: palette.textTertiary }}>
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px]" style={{ color: palette.textTertiary }}>No actions recorded</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ text, accent, palette }: { text: string; accent: string; palette: { text: string } }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <div className="w-0.5 h-3 rounded-full" style={{ background: accent }} />
      <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: palette.text }}>{text}</span>
    </div>
  )
}

function DetailRow({ label, value, mono, palette }: { label: string; value?: string | null; mono?: boolean; palette: { text: string; textSecondary: string } }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: palette.textSecondary }}>{label}</span>
      <span className={mono ? 'font-mono' : ''} style={{ color: palette.text }}>{value || '\u2014'}</span>
    </div>
  )
}
