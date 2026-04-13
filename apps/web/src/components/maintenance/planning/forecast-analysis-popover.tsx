'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Activity, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { api, type MxEventDetail } from '@skyhub/api'
import { useMaintenancePlanningStore } from '@/stores/use-maintenance-planning-store'

const TRIGGER_COLORS: Record<string, string> = {
  hours: '#FF3B3B',
  cycles: '#FF8800',
  calendar: '#7C3AED',
}

const TRIGGER_LABELS: Record<string, string> = {
  hours: 'Flight Hours',
  cycles: 'Flight Cycles',
  calendar: 'Calendar Days',
}

export function ForecastAnalysisPopover() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const popover = useMaintenancePlanningStore((s) => s.forecastPopover)
  const close = useMaintenancePlanningStore((s) => s.closeForecastPopover)

  const [detail, setDetail] = useState<MxEventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popover) return
    setLoading(true)
    setDetail(null)
    api
      .getMaintenanceEvent(popover.eventId)
      .then((d) => {
        setDetail(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [popover])

  if (!popover) return null

  const ev = popover.event
  const fc = detail?.forecast

  const bg = isDark ? 'rgba(25,25,33,0.96)' : 'rgba(255,255,255,0.98)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const text = isDark ? '#F5F2FD' : '#1C1C28'
  const muted = isDark ? '#8F90A6' : '#555770'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const accent = 'var(--module-accent, #1e40af)'

  // Position: anchor near where user right-clicked, clamp to viewport
  const w = 380
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 800
  const left = popover.x + w > vpW ? vpW - w - 16 : popover.x
  const top = Math.min(popover.y, vpH - 500)

  const isProposed = ev.source === 'auto_proposed'
  const tier = isProposed ? (ev.notes?.includes('Tier 1') ? 1 : 2) : null

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9998] rounded-2xl overflow-hidden"
      style={{
        top,
        left,
        width: w,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(24px)',
        boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.6)' : '0 12px 40px rgba(96,97,112,0.18)',
        animation: 'bc-dropdown-in 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: ev.checkColor || muted }} />
          <span className="text-[15px] font-bold" style={{ color: text }}>
            {ev.checkName} — {ev.registration}
          </span>
          {isProposed && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.10)', color: '#3B82F6' }}
            >
              Auto-proposed
            </span>
          )}
        </div>
        <button onClick={close} className="p-1.5 rounded-lg hover:bg-hz-border/20 transition-colors">
          <X size={16} style={{ color: muted }} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)', borderTopColor: accent }}
          />
        </div>
      ) : (
        <div className="px-4 py-3 space-y-4 max-h-[420px] overflow-y-auto">
          {/* Event details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <InfoItem label="Aircraft" value={ev.registration} muted={muted} text={text} />
            <InfoItem label="Check" value={ev.checkCode} muted={muted} text={text} />
            <InfoItem label="Station" value={ev.station || '—'} muted={muted} text={text} />
            <InfoItem label="Status" value={ev.status.replace('_', ' ')} muted={muted} text={text} />
            <InfoItem
              label="Planned"
              value={`${ev.plannedStart}${ev.plannedEnd ? ` → ${ev.plannedEnd}` : ''}`}
              muted={muted}
              text={text}
            />
            <InfoItem label="Source" value={ev.source.replace('_', ' ')} muted={muted} text={text} />
          </div>

          {/* Forecast analysis card */}
          {fc && (
            <>
              <div style={{ borderTop: `1px solid ${border}` }} />
              <div className="rounded-xl p-3 space-y-2" style={{ background: cardBg, border: `1px solid ${border}` }}>
                <div className="flex items-center gap-2">
                  <Activity size={14} style={{ color: accent }} />
                  <span className="text-[13px] font-semibold" style={{ color: accent }}>
                    Forecast analysis
                  </span>
                </div>

                {/* AI explanation text */}
                <p className="text-[13px] leading-relaxed" style={{ color: text }}>
                  {tier === 2 && (
                    <>
                      No tail assignment found for {ev.registration} in this period. Using{' '}
                      <strong>average daily utilization</strong> to estimate.
                    </>
                  )}
                  {tier === 1 && (
                    <>
                      Tail assignment found for {ev.registration}. Using <strong>assigned flight schedule</strong> for
                      precise forecast.
                    </>
                  )}
                  {tier === null && <>Manually scheduled maintenance event.</>}
                </p>

                {fc.triggerAxis &&
                  (fc.remainingHours != null || fc.remainingCycles != null || fc.remainingDays != null) && (
                    <p className="text-[13px] leading-relaxed" style={{ color: text }}>
                      At current rate, the <strong>{fc.triggerAxis}</strong> limit will be reached
                      {fc.bufferDays > 0 && (
                        <>
                          {' '}
                          in approximately <strong>{fc.bufferDays} days</strong>
                        </>
                      )}
                      .
                    </p>
                  )}

                {/* Trigger badge */}
                {fc.triggerAxis && (
                  <div className="flex items-center gap-2 pt-1">
                    <AlertTriangle size={14} style={{ color: TRIGGER_COLORS[fc.triggerAxis] || '#FF8800' }} />
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: TRIGGER_COLORS[fc.triggerAxis] || '#FF8800' }}
                    >
                      Trigger: {fc.triggerAxis} (
                      {fc.triggerAxis === 'hours' &&
                        fc.remainingHours != null &&
                        `${Math.round(fc.remainingHours)}h remaining`}
                      {fc.triggerAxis === 'cycles' &&
                        fc.remainingCycles != null &&
                        `${Math.round(fc.remainingCycles)} cycles remaining`}
                      {fc.triggerAxis === 'calendar' &&
                        fc.remainingDays != null &&
                        `${fc.remainingDays} days remaining`}
                      )
                    </span>
                  </div>
                )}
              </div>

              {/* Threshold bars */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: muted }}>
                  Check Thresholds
                </span>

                {fc.hoursLimit > 0 && (
                  <ThresholdBar
                    label="Flight Hours"
                    used={fc.hoursUsed}
                    limit={fc.hoursLimit}
                    remaining={fc.remainingHours}
                    unit="h"
                    color="#FF3B3B"
                    isTrigger={fc.triggerAxis === 'hours'}
                    isDark={isDark}
                    text={text}
                    muted={muted}
                  />
                )}
                {fc.cyclesLimit > 0 && (
                  <ThresholdBar
                    label="Cycles"
                    used={fc.cyclesUsed}
                    limit={fc.cyclesLimit}
                    remaining={fc.remainingCycles}
                    unit="cyc"
                    color="#FF8800"
                    isTrigger={fc.triggerAxis === 'cycles'}
                    isDark={isDark}
                    text={text}
                    muted={muted}
                  />
                )}
                {fc.daysLimit > 0 && (
                  <ThresholdBar
                    label="Calendar Days"
                    used={fc.daysUsed}
                    limit={fc.daysLimit}
                    remaining={fc.remainingDays}
                    unit="d"
                    color="#7C3AED"
                    isTrigger={fc.triggerAxis === 'calendar'}
                    isDark={isDark}
                    text={text}
                    muted={muted}
                  />
                )}
              </div>
            </>
          )}

          {/* Notes */}
          {ev.notes && (
            <>
              <div style={{ borderTop: `1px solid ${border}` }} />
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: muted }}>
                  Notes
                </span>
                <p className="text-[13px] leading-relaxed" style={{ color: text }}>
                  {ev.notes}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}

function InfoItem({ label, value, muted, text }: { label: string; value: string; muted: string; text: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase" style={{ color: muted }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold capitalize" style={{ color: text }}>
        {value}
      </span>
    </div>
  )
}

function ThresholdBar({
  label,
  used,
  limit,
  remaining,
  unit,
  color,
  isTrigger,
  isDark,
  text,
  muted,
}: {
  label: string
  used: number
  limit: number
  remaining: number | null
  unit: string
  color: string
  isTrigger: boolean
  isDark: boolean
  text: string
  muted: string
}) {
  const pct = Math.min(100, (used / limit) * 100)
  const remDisplay = remaining != null ? Math.round(remaining) : limit - used
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium" style={{ color: isTrigger ? color : text }}>
          {label}
          {isTrigger && <span className="ml-1 text-[11px]">⚡</span>}
        </span>
        <span className="text-[13px] font-mono font-semibold" style={{ color: muted }}>
          {remDisplay}
          {unit} left
        </span>
      </div>
      <div
        className="h-[8px] rounded-full overflow-hidden"
        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
      >
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between">
        <span className="text-[11px] font-mono" style={{ color: muted }}>
          {Math.round(used)}
          {unit}
        </span>
        <span className="text-[11px] font-mono" style={{ color: muted }}>
          {limit}
          {unit}
        </span>
      </div>
    </div>
  )
}
