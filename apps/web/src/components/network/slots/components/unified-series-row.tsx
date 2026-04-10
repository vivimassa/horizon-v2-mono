"use client"

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, Clock } from 'lucide-react'
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

const STATUS_BG: Record<string, { light: string; dark: string }> = {
  operated:  { light: 'rgba(6,194,112,0.12)',  dark: 'rgba(6,194,112,0.15)' },
  cancelled: { light: 'rgba(255,59,59,0.12)',  dark: 'rgba(255,59,59,0.15)' },
  no_show:   { light: 'rgba(255,59,59,0.12)',  dark: 'rgba(255,59,59,0.15)' },
  jnus:      { light: 'rgba(255,136,0,0.12)',  dark: 'rgba(255,136,0,0.15)' },
  scheduled: { light: 'rgba(143,144,166,0.10)', dark: 'rgba(143,144,166,0.12)' },
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
            {series.status.charAt(0).toUpperCase() + series.status.slice(1)}
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

      {/* Expanded detail — 3 glass cards */}
      {expanded && (
        <div className="mx-4 mb-4 mt-1 grid grid-cols-3 gap-3">
          {/* Card 1: Series Detail */}
          <GlassCard title="Series Detail" accent={accent} palette={palette} isDark={isDark} glassBorder={glassBorder}>
            <div className="space-y-1.5 text-[13px]">
              <DetailRow label="Allocated Arrival Time" value={formatSlotTime(series.allocatedArrivalTime)} palette={palette} />
              <DetailRow label="Allocated Departure Time" value={formatSlotTime(series.allocatedDepartureTime)} palette={palette} />
              <DetailRow label="Seats" value={series.seats?.toString()} palette={palette} />
              <DetailRow label="Aircraft Type" value={series.aircraftTypeIcao} palette={palette} />
              <DetailRow label="Frequency" value={series.frequencyRate === 1 ? 'Weekly' : 'Biweekly'} palette={palette} />
              <DetailRow label="Overnight Indicator" value={series.overnightIndicator ? 'Yes' : 'No'} palette={palette} />
              {series.flexibilityArrival && <DetailRow label="Flexibility Arrival" value={series.flexibilityArrival} palette={palette} />}
              {series.flexibilityDeparture && <DetailRow label="Flexibility Departure" value={series.flexibilityDeparture} palette={palette} />}
              {series.minTurnaroundMinutes && <DetailRow label="Min Turnaround" value={`${series.minTurnaroundMinutes} min`} palette={palette} />}
              {series.coordinatorRef && <DetailRow label="Coordinator Reference" value={series.coordinatorRef} palette={palette} />}
              {series.coordinatorReasonArrival && <DetailRow label="Coordinator Reason (Arr)" value={series.coordinatorReasonArrival} palette={palette} />}
              {series.coordinatorReasonDeparture && <DetailRow label="Coordinator Reason (Dep)" value={series.coordinatorReasonDeparture} palette={palette} />}
              {series.waitlistPosition && <DetailRow label="Waitlist Position" value={`#${series.waitlistPosition}`} palette={palette} />}
              {series.notes && <DetailRow label="Notes" value={series.notes} palette={palette} />}
            </div>
          </GlassCard>

          {/* Card 2: Dates */}
          <GlassCard title="Slot Historical Performance" accent={accent} palette={palette} isDark={isDark} glassBorder={glassBorder}>
            {dates.length > 0 ? (
              <DateCalendarGrid dates={dates} isDark={isDark} palette={palette} />
            ) : (
              <div className="text-[13px] py-4 text-center" style={{ color: palette.textTertiary }}>No dates expanded</div>
            )}
          </GlassCard>

          {/* Card 3: Action History */}
          <GlassCard title="Action History" accent={accent} palette={palette} isDark={isDark} glassBorder={glassBorder}>
            {actionLog.length > 0 ? (
              <div className="space-y-1.5">
                {actionLog.slice(0, 20).map(a => (
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
              <div className="text-[13px] py-4 text-center" style={{ color: palette.textTertiary }}>No actions recorded</div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  )
}

function GlassCard({ title, accent, palette, isDark, glassBorder, children }: {
  title: string; accent: string
  palette: { text: string }; isDark: boolean; glassBorder: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex items-center gap-1.5 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${glassBorder}` }}>
        <div className="w-0.5 h-3 rounded-full" style={{ background: accent }} />
        <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: palette.text }}>{title}</span>
      </div>
      <div className="p-3.5">
        {children}
      </div>
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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function DateCalendarGrid({ dates, isDark, palette }: {
  dates: SlotDateRef[]
  isDark: boolean
  palette: { text: string; textSecondary: string; textTertiary: string }
}) {
  const dateMap = new Map<string, string>()
  for (const d of dates) dateMap.set(d.slotDate, d.operationStatus)

  // Collect unique months
  const monthKeys: { key: string; year: number; month: number }[] = []
  const seen = new Set<string>()
  for (const d of dates) {
    const dt = new Date(d.slotDate)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    if (!seen.has(key)) { seen.add(key); monthKeys.push({ key, year: dt.getFullYear(), month: dt.getMonth() }) }
  }
  monthKeys.sort((a, b) => a.key.localeCompare(b.key))

  const [monthIdx, setMonthIdx] = useState(0)
  const current = monthKeys[monthIdx] || monthKeys[0]
  if (!current) return <div className="text-[13px]" style={{ color: palette.textTertiary }}>No dates</div>

  const { year, month } = current
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-1.5">
        <button type="button" onClick={() => setMonthIdx(i => Math.max(0, i - 1))}
          disabled={monthIdx === 0}
          className="p-0.5 rounded transition-colors disabled:opacity-20 hover:bg-hz-border/20">
          <ChevronLeft size={14} style={{ color: palette.textSecondary }} />
        </button>
        <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button type="button" onClick={() => setMonthIdx(i => Math.min(monthKeys.length - 1, i + 1))}
          disabled={monthIdx >= monthKeys.length - 1}
          className="p-0.5 rounded transition-colors disabled:opacity-20 hover:bg-hz-border/20">
          <ChevronRight size={14} style={{ color: palette.textSecondary }} />
        </button>
      </div>

      {/* DOW header */}
      <div className="grid grid-cols-7 gap-px mb-0.5">
        {DOW_HEADERS.map((d, i) => (
          <div key={i} className="text-center text-[13px] font-medium" style={{ color: palette.textTertiary }}>{d}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} className="h-[32px]" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const status = dateMap.get(iso)
          const bg = status ? STATUS_BG[status] : null
          const textColor = status ? (STATUS_DOT[status] || '#8F90A6') : palette.textTertiary
          return (
            <div key={day} className="flex items-center justify-center h-[32px] rounded-md"
              style={{
                background: bg ? (isDark ? bg.dark : bg.light) : undefined,
              }}>
              <span className="text-[13px] font-medium leading-none"
                style={{ color: textColor, opacity: status ? 1 : 0.25 }}>{day}</span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-2 justify-center">
        <LegendItem color="#06C270" label="Operated" isDark={isDark} palette={palette} />
        <LegendItem color="#FF3B3B" label="Cancelled" isDark={isDark} palette={palette} />
        <LegendItem color="#FF8800" label="JNUS" isDark={isDark} palette={palette} />
        <LegendItem color="#8F90A6" label="Scheduled" isDark={isDark} palette={palette} />
      </div>

    </div>
  )
}

function LegendItem({ color, label, isDark, palette }: { color: string; label: string; isDark: boolean; palette: { textTertiary: string } }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[14px] h-[14px] rounded-sm"
        style={{ background: `${color}${isDark ? '26' : '1F'}` }} />
      <span className="text-[13px]" style={{ color: palette.textTertiary }}>{label}</span>
    </div>
  )
}
