'use client'

import { Plane, Clock, PlaneLanding, AlertTriangle, Hourglass, Users, Shield } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { FlightDetail } from '@/lib/gantt/flight-detail-types'

function fmtUtc(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtBlock(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function fmtOffset(hours: number | null): string {
  if (hours == null) return ''
  const sign = hours >= 0 ? '+' : '-'
  const abs = Math.abs(hours)
  const h = Math.floor(abs)
  const m = Math.round((abs - h) * 60)
  return `UTC${sign}${h}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}`
}

function statusColor(s: string): string {
  switch (s) {
    case 'active':
      return '#06C270'
    case 'draft':
      return '#3B82F6'
    case 'suspended':
      return '#FF8800'
    case 'cancelled':
      return '#FF3B3B'
    default:
      return '#64748B'
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case 'active':
      return 'Active'
    case 'draft':
      return 'Draft'
    case 'suspended':
      return 'Suspended'
    case 'cancelled':
      return 'Cancelled'
    default:
      return s
  }
}

const OOOI_PHASES = [
  { key: 'doorCloseUtc' as const, label: 'D.CLOSE', isFirst: true },
  { key: 'atdUtc' as const, label: 'OUT', isFirst: false },
  { key: 'offUtc' as const, label: 'OFF', isFirst: false },
  { key: 'onUtc' as const, label: 'ON', isFirst: false },
  { key: 'ataUtc' as const, label: 'IN', isFirst: false },
] as const

export function InfoHeader({ data }: { data: FlightDetail }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const accent = 'var(--module-accent, #1e40af)'
  const muted = isDark ? '#8F90A6' : '#555770'
  const mutedLight = isDark ? 'rgba(143,144,166,0.5)' : 'rgba(85,87,112,0.5)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'

  const depOffset = fmtOffset(data.depAirport?.utcOffsetHours ?? null)
  const arrOffset = fmtOffset(data.arrAirport?.utcOffsetHours ?? null)
  const depName = data.depAirport?.name?.toUpperCase() ?? data.depStation
  const arrName = data.arrAirport?.name?.toUpperCase() ?? data.arrStation

  const regDisplay = data.aircraftReg
    ? `${data.aircraftReg} · ${data.aircraftTypeIcao ?? ''}`
    : `(No Tail Assigned) ${data.aircraftTypeIcao ?? ''}`

  const atdValue = data.actual.atdUtc ? fmtUtc(data.actual.atdUtc) : fmtUtc(data.stdUtc)
  const ataValue = data.actual.ataUtc ? fmtUtc(data.actual.ataUtc) : fmtUtc(data.staUtc)
  const atdLabel = data.actual.atdUtc ? 'ATD' : 'STD'
  const ataLabel = data.actual.ataUtc ? 'ATA' : 'STA'
  const delayMin = data.delays.reduce((sum, d) => sum + d.minutes, 0)
  const hasDelay = delayMin > 0
  const sColor = statusColor(data.status)

  const kpis = [
    { icon: Clock, label: atdLabel, value: atdValue, alert: false },
    { icon: PlaneLanding, label: ataLabel, value: ataValue, alert: false },
    { icon: AlertTriangle, label: 'DELAY', value: fmtBlock(delayMin), alert: hasDelay },
    { icon: Hourglass, label: 'BLOCK', value: fmtBlock(data.blockMinutes), alert: false },
    { icon: Users, label: 'PAX', value: '—', alert: false },
    { icon: Shield, label: 'CREW', value: data.crew.length > 0 ? String(data.crew.length) : '—', alert: false },
  ]

  return (
    <div className="px-7 pt-6 pb-2">
      {/* Row 1: Flight identity — matches V1 exactly */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[22px] font-mono font-bold tracking-tight" style={{ color: accent }}>
          {data.airlineCode}
          {data.flightNumber}
        </span>
        <span className="text-[16px] font-mono font-bold" style={{ color: muted }}>
          {regDisplay}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: sColor }}>
          {statusLabel(data.status)}
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-6" style={{ color: muted }}>
        <span className="text-[14px] font-medium">{fmtDate(data.operatingDate)}</span>
        <span className="text-[13px] font-mono" style={{ color: mutedLight }}>
          STD {fmtUtc(data.stdUtc)} · STA {fmtUtc(data.staUtc)}
        </span>
      </div>

      {/* Row 2: Route — large IATA codes with dashed connector, airport names below */}
      <div className="flex items-start justify-between w-full mb-1">
        <div className="text-left">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[40px] font-mono font-semibold tracking-tighter leading-none"
              style={{ color: textPrimary }}
            >
              {data.depStation}
            </span>
            <span className="text-[13px] font-mono" style={{ color: mutedLight }}>
              {depOffset}
            </span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pt-3">
          <div
            className="flex-1 h-0"
            style={{ borderTop: `2px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}` }}
          />
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mx-3 shrink-0"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            <Plane size={20} className="rotate-45" style={{ color: muted, fill: muted }} />
          </div>
          <div
            className="flex-1 h-0"
            style={{ borderTop: `2px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}` }}
          />
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-1.5 justify-end">
            <span className="text-[13px] font-mono" style={{ color: mutedLight }}>
              {arrOffset}
            </span>
            <span
              className="text-[40px] font-mono font-semibold tracking-tighter leading-none"
              style={{ color: textPrimary }}
            >
              {data.arrStation}
            </span>
          </div>
        </div>
      </div>
      <div className="flex justify-between mb-5">
        <span className="text-[13px] font-medium uppercase tracking-wider" style={{ color: muted }}>
          {depName}
        </span>
        <span className="text-[13px] font-medium uppercase tracking-wider text-right" style={{ color: muted }}>
          {arrName}
        </span>
      </div>

      {/* Row 3: OOOI Progress Timeline — spans full width, D.CLOSE under DEP, IN under ARR */}
      <div className="relative w-full mb-5" style={{ height: 60 }}>
        {/* Line between first and last dot */}
        <div
          className="absolute h-[2px]"
          style={{
            top: 9,
            left: '5%',
            right: '5%',
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          }}
        />
        {OOOI_PHASES.map((phase, i) => {
          const val = data.actual[phase.key]
          const isComplete = val != null
          const isFirst = phase.isFirst && !isComplete
          const dotBg = isComplete ? '#22c55e' : isFirst ? '#3B82F6' : isDark ? '#1F1F28' : '#F2F2F5'
          // Evenly space from 5% to 95%
          const pct = 5 + i * 22.5

          return (
            <div
              key={phase.key}
              className="absolute flex flex-col items-center z-10"
              style={{ left: `${pct}%`, top: 0, transform: 'translateX(-50%)' }}
            >
              <div
                className="w-5 h-5 rounded-full"
                style={{
                  background: dotBg,
                  border:
                    isComplete || isFirst
                      ? 'none'
                      : `2px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
                  boxShadow: isComplete
                    ? '0 0 8px rgba(34,197,94,0.3)'
                    : isFirst
                      ? '0 0 8px rgba(59,130,246,0.3)'
                      : 'none',
                }}
              />
              <span className="text-[13px] font-mono font-medium mt-1.5 whitespace-nowrap" style={{ color: muted }}>
                {phase.label}
              </span>
              <span
                className="text-[13px] font-mono whitespace-nowrap"
                style={{ color: isComplete ? textPrimary : mutedLight }}
              >
                {val ? fmtUtc(val) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Row 4: KPI Ribbon — 6 metric cards */}
      <div className="grid grid-cols-6 gap-2 pb-1">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-2xl px-3 py-2.5 flex items-center gap-2.5"
              style={{
                background: kpi.alert ? (isDark ? 'rgba(255,59,59,0.08)' : 'rgba(255,59,59,0.06)') : cardBg,
                border: `1px solid ${kpi.alert ? 'rgba(255,59,59,0.2)' : border}`,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: kpi.alert ? 'rgba(255,59,59,0.12)' : `${accent}15` }}
              >
                <Icon size={18} style={{ color: kpi.alert ? '#E63535' : accent }} />
              </div>
              <div>
                <div
                  className="text-[13px] font-bold uppercase tracking-tight leading-none"
                  style={{ color: kpi.alert ? '#E63535' : muted }}
                >
                  {kpi.label}
                </div>
                <div
                  className="text-[18px] font-mono font-bold leading-none mt-1"
                  style={{ color: kpi.alert ? '#E63535' : textPrimary }}
                >
                  {kpi.value}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
