'use client'

// ─── FlightTooltip ────────────────────────────────────────────────────────
// Ported from V1 pairing-gantt-v2. DOM-based positioning — zero React
// re-renders while the cursor moves. Portal to document.body.
// ─────────────────────────────────────────────────────────────────────────

import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GanttFlight } from '@/lib/gantt/types'
import { SLOT_STATUS_COLORS, SLOT_RISK_COLORS } from '@/lib/gantt/colors'
import { useGanttStore } from '@/stores/use-gantt-store'

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtBlock(ms: number): string {
  const min = Math.round(ms / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtUtc(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtLocal(epochMs: number, offsetHours: number): string {
  const localMs = epochMs + offsetHours * 3_600_000
  const d = new Date(localMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtOffset(hours: number): string {
  const sign = hours >= 0 ? '+' : ''
  const h = Math.floor(Math.abs(hours))
  const m = Math.round((Math.abs(hours) - h) * 60)
  return `${sign}${hours < 0 ? '-' : ''}${h}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}`
}

function fmtDate(epochMs: number): string {
  const d = new Date(epochMs)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  return `${day} ${mon} ${d.getUTCFullYear()}`
}

// ─── Status colors ────────────────────────────────────────────────────────

function getStatusStyle(status: string, isDark: boolean) {
  // Tooltip inverts: dark bg in light mode, light bg in dark mode
  switch (status) {
    case 'active':
      return { bg: 'rgba(6,194,112,0.15)', color: '#06C270', text: 'Active' }
    case 'draft':
      return isDark
        ? { bg: 'rgba(30,40,80,0.20)', color: '#1e3a5f', text: 'Draft' } // dark text on light tooltip
        : { bg: 'rgba(255,136,0,0.15)', color: '#FF8800', text: 'Draft' } // orange on dark tooltip
    case 'suspended':
      return { bg: 'rgba(255,136,0,0.15)', color: '#FF8800', text: 'Suspended' }
    case 'cancelled':
      return { bg: 'rgba(255,59,59,0.15)', color: '#FF3B3B', text: 'Cancelled' }
    default:
      return { bg: 'rgba(100,116,139,0.15)', color: '#64748B', text: status }
  }
}

// ─── Props ────────────────────────────────────────────────────────────────

export interface FlightTooltipProps {
  flight: GanttFlight | null
  mousePosRef: React.RefObject<{ x: number; y: number }>
  isDark: boolean
}

// ─── Component ────────────────────────────────────────────────────────────

export const FlightTooltip = memo(function FlightTooltip({ flight, mousePosRef, isDark }: FlightTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // DOM-based positioning — no React state, no re-renders on mouse move
  useEffect(() => {
    const el = tooltipRef.current
    if (!el || !flight) return

    function reposition(x: number, y: number) {
      const tooltipW = el!.offsetWidth
      const tooltipH = el!.offsetHeight
      const MARGIN = 14
      const EDGE_PAD = 8
      const vpW = window.innerWidth
      const vpH = window.innerHeight

      let left = x + MARGIN
      let top = y - MARGIN - tooltipH

      if (top < EDGE_PAD) top = y + MARGIN
      if (top + tooltipH > vpH - EDGE_PAD) top = vpH - tooltipH - EDGE_PAD
      if (top < EDGE_PAD) top = EDGE_PAD
      if (left + tooltipW > vpW - EDGE_PAD) left = x - tooltipW - MARGIN
      if (left < EDGE_PAD) left = EDGE_PAD

      el!.style.left = left + 'px'
      el!.style.top = top + 'px'
      el!.style.visibility = 'visible'
    }

    reposition(mousePosRef.current!.x, mousePosRef.current!.y)

    const onMove = (e: MouseEvent) => reposition(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [flight, mousePosRef])

  // Hide tooltip when any modal/dialog/popover overlay is open
  const hasOverlay = typeof document !== 'undefined' && document.querySelector('[data-gantt-overlay]') !== null
  const swapMode = useGanttStore((s) => s.swapMode)
  const stationUtcOffsetMap = useGanttStore((s) => s.stationUtcOffsetMap)
  if (!mounted || !flight || swapMode || hasOverlay) return null

  const status = getStatusStyle(flight.status, isDark)
  const blockMs = flight.staUtc - flight.stdUtc
  const depOffset = stationUtcOffsetMap[flight.depStation] ?? null
  const arrOffset = stationUtcOffsetMap[flight.arrStation] ?? null

  // Inverted glass: dark bg in light mode, light bg in dark mode
  const bg = isDark ? 'rgba(244,244,245,0.92)' : 'rgba(24,24,27,0.88)'
  const border = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const heading = isDark ? '#18181b' : '#fafafa'
  const body = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const muted = isDark ? 'rgba(24,24,27,0.55)' : 'rgba(250,250,250,0.50)'

  const content = (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        visibility: 'hidden',
        zIndex: 9999,
        pointerEvents: 'none',
        minWidth: 380,
      }}
    >
      <div
        className="rounded-xl p-4 space-y-2.5 text-[12px]"
        style={{
          background: bg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header: flight number badge + status */}
        <div className="flex items-center justify-between">
          <span
            className="font-bold text-[14px] px-2 py-0.5 rounded"
            style={{ background: status.bg, color: status.color }}
          >
            {flight.airlineCode ? `${flight.airlineCode} ${flight.flightNumber}` : flight.flightNumber}
          </span>
          <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: status.color }}>
            {status.text}
          </span>
        </div>

        {/* Route: DEP ——— block ——— ARR */}
        <div className="flex items-center justify-between">
          <div className="text-[20px] font-bold" style={{ color: heading }}>
            {flight.depStation}
          </div>
          <div className="flex-1 flex items-center justify-center px-3">
            <div className="flex-1 h-px" style={{ background: border }} />
            <span className="px-2 text-[11px] font-medium" style={{ color: muted }}>
              {fmtBlock(blockMs)}
            </span>
            <div className="flex-1 h-px" style={{ background: border }} />
          </div>
          <div className="text-[20px] font-bold" style={{ color: heading }}>
            {flight.arrStation}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
          <div className="flex justify-between">
            <span style={{ color: muted }}>STD (UTC)</span>
            <span className="tabular-nums font-normal text-[13px]" style={{ color: heading }}>
              {fmtUtc(flight.stdUtc)}z
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>STA (UTC)</span>
            <span className="tabular-nums font-normal text-[13px]" style={{ color: heading }}>
              {fmtUtc(flight.staUtc)}z
            </span>
          </div>
          {depOffset !== null && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>STD (Local)</span>
              <span className="tabular-nums text-[13px]" style={{ color: body }}>
                {fmtLocal(flight.stdUtc, depOffset)}{' '}
                <span style={{ color: muted, fontSize: 10 }}>UTC{fmtOffset(depOffset)}</span>
              </span>
            </div>
          )}
          {arrOffset !== null && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>STA (Local)</span>
              <span className="tabular-nums text-[13px]" style={{ color: body }}>
                {fmtLocal(flight.staUtc, arrOffset)}{' '}
                <span style={{ color: muted, fontSize: 10 }}>UTC{fmtOffset(arrOffset)}</span>
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: muted }}>Date</span>
            <span className="tabular-nums" style={{ color: body }}>
              {fmtDate(flight.stdUtc)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>AC Type</span>
            <span className="tabular-nums" style={{ color: body }}>
              {flight.aircraftTypeIcao || '—'}
            </span>
          </div>
          {flight.aircraftReg && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Aircraft</span>
              <span className="font-mono font-medium" style={{ color: heading }}>
                {flight.aircraftReg}
              </span>
            </div>
          )}
          {flight.serviceType && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Service</span>
              <span style={{ color: body }}>{flight.serviceType}</span>
            </div>
          )}
          {flight.slotStatus && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Slot</span>
              <span className="font-medium" style={{ color: SLOT_STATUS_COLORS[flight.slotStatus] || body }}>
                {flight.slotStatus.charAt(0).toUpperCase() + flight.slotStatus.slice(1)}
              </span>
            </div>
          )}
          {flight.slotUtilizationPct != null && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Utilization</span>
              <span className="font-medium" style={{ color: SLOT_RISK_COLORS[flight.slotRiskLevel || 'safe'] || body }}>
                {flight.slotUtilizationPct}%
              </span>
            </div>
          )}
          {flight.slotRiskLevel && flight.slotRiskLevel !== 'safe' && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Risk</span>
              <span
                className="font-medium"
                style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: flight.slotRiskLevel === 'at_risk' ? 'rgba(255,59,59,0.15)' : 'rgba(255,136,0,0.15)',
                  color: SLOT_RISK_COLORS[flight.slotRiskLevel],
                }}
              >
                {flight.slotRiskLevel === 'at_risk' ? 'AT RISK' : 'CLOSE'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
})
