'use client'

import { memo, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useStatusBoardStore } from '@/stores/use-status-board-store'
import type { StatusBoardRow } from '@/stores/use-status-board-store'
import { RotationChips } from './rotation-chips'

interface AircraftStripRowProps {
  row: StatusBoardRow
  isExpanded: boolean
}

// Health badge colors
const HEALTH_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  serviceable: { bg: 'rgba(6,194,112,0.12)', text: '#06C270', label: 'Serviceable' },
  attention: { bg: 'rgba(255,136,0,0.12)', text: '#FF8800', label: 'Attention' },
  critical: { bg: 'rgba(255,59,59,0.12)', text: '#FF3B3B', label: 'Critical' },
}

// Operational status FIDS-style config
const OP_STATUS_CONFIG: Record<string, { letters: string; bg: string; text: string }> = {
  AIRBORNE: { letters: 'AIRBORNE', bg: '#FFCC00', text: '#1C1C28' },
  ON_GROUND: { letters: 'ON GROUND', bg: '#6b7280', text: '#ffffff' },
  MAINTENANCE: { letters: 'MAINTENANCE', bg: '#7c3aed', text: '#ffffff' },
  AOG: { letters: 'AOG', bg: '#dc2626', text: '#ffffff' },
}

function fmtDelays(minutes: number): string {
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtDate(ms: number): string {
  const d = new Date(ms)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

function progressColor(pct: number): string {
  if (pct >= 100) return '#FF3B3B'
  if (pct >= 80) return '#FF8800'
  return '#06C270'
}

export const AircraftStripRow = memo(function AircraftStripRow({ row, isExpanded }: AircraftStripRowProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const expandAircraft = useStatusBoardStore((s) => s.expandAircraft)
  const collapseAircraft = useStatusBoardStore((s) => s.collapseAircraft)
  const openContextMenu = useStatusBoardStore((s) => s.openContextMenu)

  const handleClick = useCallback(() => {
    if (isExpanded) collapseAircraft()
    else expandAircraft(row.id)
  }, [isExpanded, row.id, expandAircraft, collapseAircraft])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      openContextMenu({ x: e.clientX, y: e.clientY, aircraftId: row.id, registration: row.registration })
    },
    [row.id, row.registration, openContextMenu],
  )

  const hoverBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const health = HEALTH_COLORS[row.healthStatus] ?? HEALTH_COLORS.serviceable
  const opStatus = OP_STATUS_CONFIG[row.operationalStatus] ?? OP_STATUS_CONFIG.ON_GROUND

  return (
    <div
      className="flex items-center cursor-pointer transition-colors"
      style={{
        minHeight: 48,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Col 1: Aircraft Identity */}
      <div className="shrink-0 flex flex-col justify-center px-3" style={{ width: 130 }}>
        <span className="text-[14px] font-bold font-mono" style={{ color: isDark ? '#5B8DEF' : '#1e40af' }}>
          {row.registration}
        </span>
        <span className="text-[13px]" style={{ color: palette.textTertiary }}>
          {row.icaoType} · {row.homeBase ?? '—'}
        </span>
      </div>

      {/* Col 2: Status */}
      <div className="shrink-0 flex flex-col gap-1 justify-center" style={{ width: 200 }}>
        {/* FIDS-style letter blocks */}
        <div className="flex items-center gap-[2px]">
          {opStatus.letters.split('').map((ch, i) => (
            <span
              key={i}
              className="inline-flex items-center justify-center text-[10px] font-bold rounded-[2px]"
              style={{
                width: ch === ' ' ? 4 : 14,
                height: 16,
                background: ch === ' ' ? 'transparent' : opStatus.bg,
                color: opStatus.text,
              }}
            >
              {ch === ' ' ? '' : ch}
            </span>
          ))}
        </div>
        {/* Health badge */}
        <span
          className="text-[13px] font-medium px-1.5 py-0 rounded self-start"
          style={{ background: health.bg, color: health.text }}
        >
          {health.label}
        </span>
      </div>

      {/* Col 3: Today's Rotation */}
      <div className="flex-1 min-w-0 flex items-center overflow-hidden px-2">
        <RotationChips flights={row.rotationFlights} />
      </div>

      {/* Col 4: Delays */}
      <div className="shrink-0 flex items-center justify-end px-2 font-mono" style={{ width: 90 }}>
        <span
          className="text-[13px] font-medium"
          style={{ color: row.accumulatedDelayMinutes > 0 ? '#FF3B3B' : palette.textTertiary }}
        >
          {fmtDelays(row.accumulatedDelayMinutes)}
        </span>
      </div>

      {/* Col 5: Most Urgent Check */}
      <div className="shrink-0 flex items-center gap-2 px-2" style={{ width: 140 }}>
        {row.urgentCheck ? (
          <>
            <span
              className="text-[13px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: row.urgentCheck.color ?? (isDark ? '#3B82F6' : '#2563eb'),
                color: '#ffffff',
                minWidth: 28,
                textAlign: 'center',
              }}
            >
              {row.urgentCheck.code}
            </span>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              {/* Progress bar */}
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(row.urgentCheck.percentConsumed, 100)}%`,
                    background: progressColor(row.urgentCheck.percentConsumed),
                  }}
                />
              </div>
              <span className="text-[11px] font-mono" style={{ color: palette.textTertiary }}>
                {row.urgentCheck.remainingHours != null
                  ? `${Math.round(row.urgentCheck.remainingHours)}h left`
                  : row.urgentCheck.remainingDays != null
                    ? `${Math.round(row.urgentCheck.remainingDays)}d left`
                    : row.urgentCheck.remainingCycles != null
                      ? `${Math.round(row.urgentCheck.remainingCycles)}c left`
                      : '—'}
              </span>
            </div>
          </>
        ) : (
          <span className="text-[13px]" style={{ color: palette.textTertiary }}>
            —
          </span>
        )}
      </div>

      {/* Col 6: Next Event */}
      <div className="shrink-0 flex flex-col justify-center px-2" style={{ width: 120 }}>
        {row.nextEvent ? (
          <>
            <span className="text-[13px] font-medium truncate" style={{ color: palette.text }}>
              {row.nextEvent.checkName}
            </span>
            <span className="text-[11px] font-mono" style={{ color: palette.textTertiary }}>
              {row.nextEvent.station} · {fmtDate(row.nextEvent.plannedStartUtc)}
            </span>
          </>
        ) : (
          <span className="text-[13px]" style={{ color: palette.textTertiary }}>
            —
          </span>
        )}
      </div>

      {/* Col 7: FH / Cycles */}
      <div className="shrink-0 flex flex-col items-end justify-center px-3" style={{ width: 100 }}>
        <span className="text-[13px] font-mono font-medium" style={{ color: palette.text }}>
          {fmtNumber(row.flightHours)}h
        </span>
        <span className="text-[11px] font-mono" style={{ color: palette.textTertiary }}>
          {fmtNumber(row.cycles)}c
        </span>
      </div>
    </div>
  )
})
