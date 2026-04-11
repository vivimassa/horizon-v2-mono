'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { fetchCancelImpact } from '@/lib/gantt/api'
import type { SlotCancelImpact } from '@/lib/gantt/api'

export function GanttCancelDialog() {
  const cancelDialog = useGanttStore((s) => s.cancelDialog)
  const closeCancelDialog = useGanttStore((s) => s.closeCancelDialog)
  const confirmCancel = useGanttStore((s) => s.confirmCancel)
  const flights = useGanttStore((s) => s.flights)
  const barLabelMode = useGanttStore((s) => s.barLabelMode)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [executing, setExecuting] = useState(false)

  // Slot impact state
  const [impacts, setImpacts] = useState<SlotCancelImpact[]>([])
  const [impactLoading, setImpactLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!cancelDialog) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCancelDialog()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [cancelDialog, closeCancelDialog])

  // Fetch slot cancel impact when dialog opens
  useEffect(() => {
    if (!cancelDialog) {
      setImpacts([])
      return
    }
    const operatorId = useOperatorStore.getState().operator?._id
    if (!operatorId) return

    setImpactLoading(true)
    const timeout = setTimeout(() => setImpactLoading(false), 3000) // 3s max wait

    fetchCancelImpact(operatorId, cancelDialog.flightIds)
      .then((data) => {
        clearTimeout(timeout)
        setImpacts(data.impacts || [])
      })
      .catch((err) => {
        console.warn('Slot impact check failed (non-blocking):', err)
        setImpacts([])
      })
      .finally(() => setImpactLoading(false))

    return () => clearTimeout(timeout)
  }, [cancelDialog])

  const affected = useMemo(() => {
    if (!cancelDialog) return null
    const flts = flights.filter((f) => cancelDialog.flightIds.includes(f.id))
    const dates = [...new Set(flts.map((f) => f.operatingDate))].sort()
    const totalBlock = flts.reduce((sum, f) => sum + (f.blockMinutes ?? 0), 0)
    return { flts, dates, totalBlock }
  }, [cancelDialog, flights])

  if (!mounted || !cancelDialog || !affected) return null

  const bg = isDark ? 'rgba(24,24,27,0.95)' : 'rgba(255,255,255,0.97)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textColor = isDark ? '#fafafa' : '#18181b'
  const textMuted = isDark ? 'rgba(250,250,250,0.45)' : 'rgba(24,24,27,0.45)'
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'

  const blockH = String(Math.floor(affected.totalBlock / 60)).padStart(2, '0')
  const blockM = String(affected.totalBlock % 60).padStart(2, '0')

  const dateRange =
    affected.dates.length === 1
      ? formatDate(affected.dates[0])
      : `${formatDate(affected.dates[0])} \u2014 ${formatDate(affected.dates[affected.dates.length - 1])}`

  // Check if any impact will breach or is already at risk
  const riskyImpacts = impacts.filter((i) => i.willBreachThreshold || i.isAlreadyAtRisk)
  const hasSlotRisk = riskyImpacts.length > 0

  async function handleConfirm() {
    setExecuting(true)
    try {
      await confirmCancel()
    } catch (e) {
      console.error('Cancel failed:', e)
    } finally {
      setExecuting(false)
    }
  }

  return createPortal(
    <div
      data-gantt-overlay
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        ref={ref}
        className="rounded-2xl overflow-hidden"
        style={{
          width: 520,
          maxHeight: '85vh',
          background: bg,
          border: `1px solid ${border}`,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
          animation: 'bc-dropdown-in 150ms ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <Trash2 size={18} style={{ color: '#E63535' }} />
          <span className="text-[15px] font-semibold flex-1" style={{ color: textColor }}>
            Cancel Flight{affected.flts.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={closeCancelDialog}
            className="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X size={16} style={{ color: textMuted }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
          {/* Description */}
          <div className="text-[13px]" style={{ color: textColor }}>
            {affected.flts.length === 1
              ? 'This will cancel the flight from its operating date. The schedule pattern will not be affected.'
              : `This will cancel ${affected.flts.length} flights from their operating dates. The schedule patterns will not be affected.`}
          </div>

          {/* Affected flights card */}
          <div className="rounded-xl p-3 space-y-2.5" style={{ background: cardBg, border: `1px solid ${border}` }}>
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-medium" style={{ color: textMuted }}>
                {dateRange}
              </div>
              <div className="flex items-center gap-2.5 text-[13px]" style={{ color: textMuted }}>
                <span>
                  <span className="font-semibold" style={{ color: textColor }}>
                    {affected.flts.length}
                  </span>{' '}
                  flt{affected.flts.length !== 1 ? 's' : ''}
                </span>
                <span style={{ opacity: 0.3 }}>&middot;</span>
                <span>
                  <span className="font-semibold" style={{ color: textColor }}>
                    {blockH}:{blockM}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {affected.flts.map((f) => {
                const label = barLabelMode === 'sector' ? `${f.depStation}-${f.arrStation}` : f.flightNumber
                return (
                  <span
                    key={f.id}
                    className="px-2 py-1 rounded-md text-[13px] font-medium text-white"
                    style={{ background: '#E63535' }}
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Slot utilization warning */}
          {impactLoading && (
            <div className="flex items-center gap-2 text-[13px]" style={{ color: textMuted }}>
              <Loader2 size={14} className="animate-spin" />
              Checking slot impact...
            </div>
          )}

          {!impactLoading &&
            riskyImpacts.map((impact) => (
              <div
                key={impact.seriesId}
                className="rounded-xl overflow-hidden"
                style={{
                  border: `1px solid ${impact.willBreachThreshold ? 'rgba(255,59,59,0.3)' : 'rgba(255,136,0,0.3)'}`,
                }}
              >
                {/* Warning header */}
                <div
                  className="flex items-center gap-2.5 px-4 py-2.5"
                  style={{
                    background: impact.willBreachThreshold
                      ? isDark
                        ? 'rgba(255,59,59,0.08)'
                        : 'rgba(255,59,59,0.05)'
                      : isDark
                        ? 'rgba(255,136,0,0.08)'
                        : 'rgba(255,136,0,0.05)',
                  }}
                >
                  <AlertTriangle size={16} style={{ color: impact.willBreachThreshold ? '#FF3B3B' : '#FF8800' }} />
                  <span className="text-[14px] font-semibold" style={{ color: textColor }}>
                    Slot Utilization Warning
                  </span>
                </div>

                {/* Warning content */}
                <div className="px-4 py-3 space-y-2.5">
                  {/* Airport info */}
                  <div className="text-[13px]" style={{ color: textColor }}>
                    <span className="font-bold">{impact.airportIata}</span>
                    {' \u2014 '}
                    {impact.airportName}{' '}
                    <span
                      className="font-medium px-1.5 py-0.5 rounded text-[13px]"
                      style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}
                    >
                      Level {impact.coordinationLevel}
                    </span>
                  </div>

                  {/* Utilization breakdown */}
                  <div className="text-[13px]" style={{ color: textMuted }}>
                    Current:{' '}
                    <span className="font-semibold" style={{ color: textColor }}>
                      {impact.currentPct}%
                    </span>{' '}
                    ({impact.operated} operated + {impact.jnus} JNUS / {impact.total} total)
                  </div>

                  {/* Before → After with visual bar */}
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[15px] font-bold"
                      style={{ color: impact.currentPct >= 80 ? '#06C270' : '#FF3B3B' }}
                    >
                      {impact.currentPct}%
                    </span>
                    <span className="text-[13px]" style={{ color: textMuted }}>
                      {'\u2192'}
                    </span>
                    <span
                      className="text-[15px] font-bold"
                      style={{ color: impact.afterPct < 80 ? '#FF3B3B' : '#FF8800' }}
                    >
                      {impact.afterPct}%
                    </span>
                    <div
                      className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${impact.afterPct}%`,
                          background: impact.afterPct < 80 ? '#FF3B3B' : '#FF8800',
                        }}
                      />
                    </div>
                  </div>

                  {/* Threshold breach warning */}
                  {impact.willBreachThreshold && (
                    <div
                      className="rounded-lg px-3 py-2.5 text-[13px]"
                      style={{ background: isDark ? 'rgba(255,59,59,0.1)' : 'rgba(255,59,59,0.06)', color: '#FF3B3B' }}
                    >
                      Cancelling {impact.cancelledCount > 1 ? `these ${impact.cancelledCount} dates` : 'this flight'}{' '}
                      will drop utilization below the 80% threshold. Historic rights for{' '}
                      <span className="font-bold">{impact.nextSeason}</span> are at risk.
                    </div>
                  )}

                  {impact.isAlreadyAtRisk && !impact.willBreachThreshold && (
                    <div
                      className="rounded-lg px-3 py-2.5 text-[13px]"
                      style={{ background: isDark ? 'rgba(255,136,0,0.1)' : 'rgba(255,136,0,0.06)', color: '#FF8800' }}
                    >
                      This slot is already below the 80% threshold. Cancelling will further reduce utilization.
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3" style={{ borderTop: `1px solid ${border}` }}>
          <button
            onClick={closeCancelDialog}
            className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style={{
              color: hasSlotRisk ? '#fff' : textColor,
              background: hasSlotRisk ? '#2563eb' : 'transparent',
              border: hasSlotRisk ? 'none' : `1px solid ${border}`,
            }}
          >
            {hasSlotRisk ? 'Keep Flight' : 'No, Keep'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={executing}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors flex items-center gap-2"
            style={{ background: '#E63535', opacity: executing ? 0.7 : 1 }}
          >
            {executing && <Loader2 size={14} className="animate-spin" />}
            {hasSlotRisk ? 'Cancel Anyway' : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getUTCDay()]} ${d.getUTCDate().toString().padStart(2, '0')} ${months[d.getUTCMonth()]}`
}
