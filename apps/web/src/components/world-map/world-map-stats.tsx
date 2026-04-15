'use client'

import type { WorldMapFlight, KpiMode } from './world-map-types'
import { getFlightMapStatus } from './world-map-types'

const DELAY_THRESHOLD_MIN = 15

/** Parse HH:MM on an instance date to a UTC timestamp in ms. */
function hhmmToMs(hhmm: string, instanceDate: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(instanceDate + 'T00:00:00Z')
  d.setUTCHours(h, m, 0, 0)
  return d.getTime()
}

/** True if either actual arrival or actual departure is > 15 min late vs schedule. */
export function isDelayedFlight(f: WorldMapFlight): boolean {
  // Arrival delay from ATA if landed
  const arrActual = f.actualIn || f.actualOn
  if (arrActual && f.staUtc) {
    let diff = (hhmmToMs(arrActual, f.instanceDate) - hhmmToMs(f.staUtc, f.instanceDate)) / 60_000
    if (diff < -720) diff += 1440
    if (diff > DELAY_THRESHOLD_MIN) return true
  }
  // Otherwise use departure delay
  const depActual = f.actualOff || f.actualOut
  if (depActual && f.stdUtc) {
    let diff = (hhmmToMs(depActual, f.instanceDate) - hhmmToMs(f.stdUtc, f.instanceDate)) / 60_000
    if (diff < -720) diff += 1440
    if (diff > DELAY_THRESHOLD_MIN) return true
  }
  return false
}
import { useMemo, useState } from 'react'
import { Clock, Fuel, Timer, Users } from 'lucide-react'

interface WorldMapStatsProps {
  flights: WorldMapFlight[]
  utcTime: string
  now: Date
  isDark?: boolean
  activeKpis: KpiMode[]
  onToggleKpi: (mode: KpiMode) => void
  uiZoom?: number
}

const KPI_BUTTONS: { mode: KpiMode; label: string; tooltip: string; icon: typeof Clock }[] = [
  { mode: 'otp', label: 'OTP', tooltip: 'On-Time Performance', icon: Clock },
  { mode: 'fuel', label: 'Fuel', tooltip: 'Fuel Management', icon: Fuel },
  { mode: 'tat', label: 'TAT', tooltip: 'Turnaround Monitor', icon: Timer },
  { mode: 'loadfactor', label: 'Load', tooltip: 'Load Factor', icon: Users },
]

export function WorldMapStats({
  flights,
  utcTime,
  now,
  isDark = true,
  activeKpis,
  onToggleKpi,
  uiZoom = 1,
}: WorldMapStatsProps) {
  const panelBg = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.80)'
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  const valueColor = isDark ? 'text-white' : 'text-foreground'
  const labelColor = isDark ? 'text-white/40' : 'text-muted-foreground'
  const dividerColor = isDark ? 'bg-white/10' : 'bg-black/10'
  const counts = useMemo(() => {
    let airborne = 0,
      ground = 0,
      delayed = 0
    for (const f of flights) {
      const s = getFlightMapStatus(f, now)
      if (s === 'airborne') airborne++
      else if (s === 'ground' || s === 'scheduled') ground++

      // Delayed counter = any flight with a known late arrival OR departure,
      // regardless of current status. Matches the OTP panel's delay buckets.
      if (isDelayedFlight(f)) delayed++
    }
    return { airborne, ground, delayed, total: flights.length }
  }, [flights, now])

  // KPI pill button styling
  const pillBase = isDark
    ? 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
    : 'bg-black/5 hover:bg-black/10 text-black/50 hover:text-black/80'

  const pillActive = isDark
    ? 'bg-white/20 text-white ring-1 ring-white/20'
    : 'bg-primary/10 text-primary ring-1 ring-primary/20'

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-6 px-8 py-3 rounded-full shadow-2xl select-none transition-all duration-300"
      style={{
        background: panelBg,
        backdropFilter: 'blur(24px) saturate(1.4)',
        border: `1px solid ${borderColor}`,
        zoom: uiZoom,
      }}
    >
      <StatItem
        color="#f5c842"
        label="Airborne"
        value={counts.airborne}
        valueClass={valueColor}
        labelClass={labelColor}
      />
      <div className={`w-px h-6 ${dividerColor}`} />
      <StatItem color="#3b82f6" label="Ground" value={counts.ground} valueClass={valueColor} labelClass={labelColor} />
      <div className={`w-px h-6 ${dividerColor}`} />
      <StatItem
        color="#ef4444"
        label="Delayed"
        value={counts.delayed}
        valueClass={valueColor}
        labelClass={labelColor}
      />
      <div className={`w-px h-6 ${dividerColor}`} />
      <StatItem
        color={isDark ? '#ffffff' : '#18181b'}
        label="Total"
        value={counts.total}
        valueClass={valueColor}
        labelClass={labelColor}
      />
      {/* KPI toggle buttons */}
      <div className={`w-px h-6 ${dividerColor}`} />
      <div
        className={`flex items-center gap-1.5 px-1.5 py-1 rounded-full ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}`}
      >
        {KPI_BUTTONS.map(({ mode, icon: Icon, tooltip }) => {
          const isActive = activeKpis.includes(mode)
          return (
            <KpiButton
              key={mode}
              onClick={() => onToggleKpi(mode)}
              isActive={isActive}
              icon={Icon}
              tooltip={tooltip}
              isDark={isDark}
            />
          )
        })}
      </div>
    </div>
  )
}

function StatItem({
  color,
  label,
  value,
  valueClass,
  labelClass,
}: {
  color: string
  label: string
  value: number
  valueClass?: string
  labelClass?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
      />
      <div className="flex flex-col">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest leading-none ${labelClass || 'text-white/40'}`}
        >
          {label}
        </span>
        <span className={`text-[16px] font-mono font-bold leading-none mt-0.5 ${valueClass || 'text-white'}`}>
          {value}
        </span>
      </div>
    </div>
  )
}

function KpiButton({
  onClick,
  isActive,
  icon: Icon,
  tooltip,
  isDark,
}: {
  onClick: () => void
  isActive: boolean
  icon: typeof Clock
  tooltip: string
  isDark: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const activeBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)'
  const idleBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const activeIcon = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(24,24,27,0.95)'
  const idleIcon = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(24,24,27,0.45)'

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        onClick={onClick}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
        style={{
          backgroundColor: isActive ? activeBg : idleBg,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: isActive ? activeIcon : idleIcon }} />
      </button>

      {/* Inverted tooltip */}
      {hovered && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-50 bg-[rgba(24,24,27,0.88)] dark:bg-[rgba(244,244,245,0.92)] text-[#fafafa] dark:text-[#18181b] text-[11px] font-medium"
          style={{ backdropFilter: 'blur(20px) saturate(1.6)' }}
        >
          {tooltip}
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-[rgba(24,24,27,0.88)] dark:bg-[rgba(244,244,245,0.92)]" />
        </div>
      )}
    </div>
  )
}
