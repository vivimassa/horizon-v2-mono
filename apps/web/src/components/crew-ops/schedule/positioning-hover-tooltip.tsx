'use client'

import { memo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { CrewFlightBookingRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'

interface Props {
  /** Hit metadata captured at hover-time (covers both the "no booking yet"
   *  state and the "click an existing chip" state). */
  hit: {
    direction: 'outbound' | 'return'
    depStation: string
    arrStation: string
    flightDate: string
    airportCode: string
    bookingId: string | null
  }
  booking: CrewFlightBookingRef | null
  localOffsetHours: number
  clientX: number
  clientY: number
}

function fmtUtc(ms: number | null | undefined): string {
  if (ms == null) return '—'
  return new Date(ms).toISOString().slice(11, 16).replace(':', '') + 'Z'
}
function fmtLocal(ms: number | null | undefined, offsetHours: number): string {
  if (ms == null) return '—'
  return new Date(ms + offsetHours * 3_600_000).toISOString().slice(11, 16).replace(':', '') + 'L'
}

function useFollowCursor(initialClientX: number, initialClientY: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    function reposition(x: number, y: number) {
      if (!el) return
      const tw = el.offsetWidth
      const th = el.offsetHeight
      const MARGIN = 14
      const EDGE_PAD = 8
      const vpW = window.innerWidth
      const vpH = window.innerHeight
      let left = x + MARGIN
      let top = y - MARGIN - th
      if (top < EDGE_PAD) top = y + MARGIN
      if (top + th > vpH - EDGE_PAD) top = vpH - th - EDGE_PAD
      if (top < EDGE_PAD) top = EDGE_PAD
      if (left + tw > vpW - EDGE_PAD) left = x - tw - MARGIN
      if (left < EDGE_PAD) left = EDGE_PAD
      el.style.left = left + 'px'
      el.style.top = top + 'px'
      el.style.visibility = 'visible'
    }
    reposition(initialClientX, initialClientY)
    const onMove = (e: MouseEvent) => reposition(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [initialClientX, initialClientY])
  return ref
}

export const PositioningHoverTooltip = memo(function PositioningHoverTooltip({
  hit,
  booking,
  localOffsetHours,
  clientX,
  clientY,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useFollowCursor(clientX, clientY)
  if (typeof document === 'undefined') return null

  const directionLabel = hit.direction === 'outbound' ? 'Outbound' : 'Return'

  const bg = isDark ? 'rgba(244,244,245,0.92)' : 'rgba(24,24,27,0.88)'
  const border = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const heading = isDark ? '#18181b' : '#fafafa'
  const muted = isDark ? 'rgba(24,24,27,0.55)' : 'rgba(250,250,250,0.55)'
  const accent = 'var(--module-accent)'

  // Status colour — soft-cancel state goes grey, otherwise accent.
  const cancelled = booking?.status === 'cancelled'
  const statusLabel = booking
    ? cancelled
      ? 'Cancelled'
      : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
    : 'Not booked'

  // Method line: jumpseat (gendec) shows the position; ticket shows PNR.
  const methodLine = booking
    ? booking.method === 'gendec'
      ? `Jumpseat · ${(booking.gendecPosition ?? 'pax-seat').replace(/-/g, ' ')}`
      : `Pax seat${booking.pnr ? ` · PNR ${booking.pnr}` : ''}`
    : null

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        visibility: 'hidden',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        className="rounded-xl px-3 py-2.5 text-[13px]"
        style={{
          background: bg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          minWidth: 220,
          maxWidth: 320,
        }}
      >
        {/* Header — direction + route + date */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
            style={{ background: cancelled ? '#9A9BA8' : accent }}
          >
            {booking ? 'POS' : '+'}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: heading }}>
            {hit.depStation || '—'} → {hit.arrStation || '—'}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: muted }}>
            {hit.flightDate}
          </span>
        </div>

        <div className="mt-1 text-[11px] uppercase tracking-wider font-semibold" style={{ color: muted }}>
          {directionLabel} positioning
        </div>

        {booking ? (
          <>
            {/* Carrier · Flight # */}
            {(booking.carrierCode || booking.flightNumber) && (
              <div className="mt-2 flex items-center gap-2 tabular-nums">
                {booking.carrierCode && (
                  <span className="text-[12px] font-bold" style={{ color: heading }}>
                    {booking.carrierCode}
                  </span>
                )}
                {booking.flightNumber && (
                  <span className="text-[12px] font-bold" style={{ color: heading }}>
                    {booking.flightNumber}
                  </span>
                )}
              </div>
            )}
            {/* STD / STA — UTC + local */}
            {(booking.stdUtcMs != null || booking.staUtcMs != null) && (
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                <span style={{ color: muted }}>
                  <span className="uppercase tracking-wider mr-1">STD</span>
                  <span style={{ color: heading }}>{fmtUtc(booking.stdUtcMs)}</span>
                </span>
                <span style={{ color: muted }}>
                  <span className="uppercase tracking-wider mr-1">STA</span>
                  <span style={{ color: heading }}>{fmtUtc(booking.staUtcMs)}</span>
                </span>
                <span style={{ color: muted }}>
                  <span className="uppercase tracking-wider mr-1">LT</span>
                  <span style={{ color: heading }}>{fmtLocal(booking.stdUtcMs, localOffsetHours)}</span>
                </span>
                <span style={{ color: muted }}>
                  <span className="uppercase tracking-wider mr-1">LT</span>
                  <span style={{ color: heading }}>{fmtLocal(booking.staUtcMs, localOffsetHours)}</span>
                </span>
              </div>
            )}
            {methodLine && (
              <div className="mt-1.5 text-[12px]" style={{ color: heading }}>
                {methodLine}
              </div>
            )}
            <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: muted }}>
              {statusLabel}
            </div>
            {booking.notes && (
              <div className="mt-1.5 text-[12px] italic" style={{ color: muted }}>
                {booking.notes}
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 text-[12px]" style={{ color: heading }}>
            Right-click to assign positioning leg.
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
})
