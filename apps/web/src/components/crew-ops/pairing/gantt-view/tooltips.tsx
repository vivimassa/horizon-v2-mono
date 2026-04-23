'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore, resolveComplementCounts } from '@/stores/use-pairing-store'
import { resolvePairingFlights } from '../lib/pairing-metrics'
import { usePairingLegality } from '../use-pairing-legality'
import type { PairingFlight, Pairing } from '../types'

/**
 * Flight + Pairing hover tooltips. Ported 1:1 from Movement Control's
 * `gantt-flight-tooltip.tsx`:
 *   • Inverted glass — dark bg in light mode, light bg in dark mode
 *   • Flight number rendered as a colored status pill
 *   • Large DEP ─── block ─── ARR route block
 *   • 2-column info grid (label left, value right)
 *   • DOM-based positioning via a document-level mousemove listener — zero
 *     React re-renders while the cursor moves.
 */

function fmtBlock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--:--'
  const min = Math.round(ms / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtUtc(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return '--:--'
  const d = new Date(epochMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtLocal(epochMs: number, offsetHours: number): string {
  if (!Number.isFinite(epochMs)) return '--:--'
  const localMs = epochMs + offsetHours * 3_600_000
  const d = new Date(localMs)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtOffset(hours: number): string {
  const sign = hours >= 0 ? '+' : '-'
  const abs = Math.abs(hours)
  const h = Math.floor(abs)
  const m = Math.round((abs - h) * 60)
  return `${sign}${h}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}`
}

function fmtDate(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return '—'
  const d = new Date(epochMs)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  return `${day} ${mon} ${d.getUTCFullYear()}`
}

function fmtBlockMinutes(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '--:--'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function getStatusStyle(status: string, isDark: boolean) {
  switch (status) {
    case 'active':
      return { bg: 'rgba(6,194,112,0.15)', color: '#06C270', text: 'Active' }
    case 'suspended':
      return { bg: 'rgba(255,136,0,0.15)', color: '#FF8800', text: 'Suspended' }
    case 'cancelled':
      return { bg: 'rgba(255,59,59,0.15)', color: '#FF3B3B', text: 'Cancelled' }
    case 'legal':
      return { bg: 'rgba(6,194,112,0.15)', color: '#06C270', text: 'Legal' }
    case 'warning':
      return { bg: 'rgba(255,136,0,0.15)', color: '#FF8800', text: 'Warning' }
    case 'violation':
      return { bg: 'rgba(255,59,59,0.15)', color: '#FF3B3B', text: 'Violation' }
    default:
      return { bg: 'rgba(100,116,139,0.15)', color: '#64748B', text: status }
  }
}

/** Shared positioner — DOM-only, no React state touched. */
function useFollowCursor(initialClientX: number, initialClientY: number, isActive: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !isActive) return

    function reposition(x: number, y: number) {
      if (!el) return
      const tooltipW = el.offsetWidth
      const tooltipH = el.offsetHeight
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
      el.style.left = left + 'px'
      el.style.top = top + 'px'
      el.style.visibility = 'visible'
    }

    reposition(initialClientX, initialClientY)
    const onMove = (e: MouseEvent) => reposition(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [initialClientX, initialClientY, isActive])

  return ref
}

// ── Flight tooltip ───────────────────────────────────────────────────────

interface FlightTooltipProps {
  flight: PairingFlight
  clientX: number
  clientY: number
  /** Per-position required/actual/delta from computeFlightCoverage. Empty when master missing or flight uncovered. */
  coverageDeltas?: Array<{ code: string; required: number; actual: number; delta: number }>
  /** Overall coverage state — used for the color label on the Complement row. */
  coverageState?: 'uncovered' | 'fully' | 'under' | 'over' | 'mixed'
}

export const FlightTooltip = memo(function FlightTooltip({
  flight,
  clientX,
  clientY,
  coverageDeltas,
  coverageState,
}: FlightTooltipProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useFollowCursor(clientX, clientY, true)

  // Station → UTC offset map used to render STD/STA in Local time. Falls back
  // to "UTC only" when we haven't seen the station yet.
  const stationUtcOffsets = usePairingStore((s) => s.stationUtcOffsets)
  const depOffset = stationUtcOffsets[flight.departureAirport] ?? null
  const arrOffset = stationUtcOffsets[flight.arrivalAirport] ?? null

  if (typeof document === 'undefined') return null

  const stdMs = Date.parse(flight.stdUtc)
  const staMs = Date.parse(flight.staUtc)
  const blockMs = staMs - stdMs
  const status = getStatusStyle(flight.status, isDark)

  const bg = isDark ? 'rgba(244,244,245,0.92)' : 'rgba(24,24,27,0.88)'
  const border = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const heading = isDark ? '#18181b' : '#fafafa'
  const body = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const muted = isDark ? 'rgba(24,24,27,0.55)' : 'rgba(250,250,250,0.50)'

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
        minWidth: 380,
      }}
    >
      <div
        className="rounded-xl p-4 space-y-2.5 text-[13px]"
        style={{
          background: bg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header: flight number pill + status */}
        <div className="flex items-center justify-between">
          <span
            className="font-bold text-[14px] px-2 py-0.5 rounded"
            style={{ background: status.bg, color: status.color }}
          >
            {flight.flightNumber}
          </span>
          <span className="text-[13px] font-medium tracking-wider uppercase" style={{ color: status.color }}>
            {status.text}
          </span>
        </div>

        {/* Route — DEP ─── block ─── ARR */}
        <div className="flex items-center justify-between">
          <div className="text-[20px] font-bold" style={{ color: heading }}>
            {flight.departureAirport}
          </div>
          <div className="flex-1 flex items-center justify-center px-3">
            <div className="flex-1 h-px" style={{ background: border }} />
            <span className="px-2 text-[13px] font-medium tabular-nums" style={{ color: muted }}>
              {fmtBlock(blockMs)}
            </span>
            <div className="flex-1 h-px" style={{ background: border }} />
          </div>
          <div className="text-[20px] font-bold" style={{ color: heading }}>
            {flight.arrivalAirport}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <span style={{ color: muted }}>STD (UTC)</span>
            <span className="tabular-nums font-normal" style={{ color: heading }}>
              {fmtUtc(stdMs)}z
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>STA (UTC)</span>
            <span className="tabular-nums font-normal" style={{ color: heading }}>
              {fmtUtc(staMs)}z
            </span>
          </div>
          {depOffset !== null && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>STD (Local)</span>
              <span className="tabular-nums" style={{ color: body }}>
                {fmtLocal(stdMs, depOffset)}{' '}
                <span style={{ color: muted, fontSize: 10 }}>UTC{fmtOffset(depOffset)}</span>
              </span>
            </div>
          )}
          {arrOffset !== null && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>STA (Local)</span>
              <span className="tabular-nums" style={{ color: body }}>
                {fmtLocal(staMs, arrOffset)}{' '}
                <span style={{ color: muted, fontSize: 10 }}>UTC{fmtOffset(arrOffset)}</span>
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: muted }}>Date</span>
            <span className="tabular-nums" style={{ color: body }}>
              {fmtDate(stdMs)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>AC Type</span>
            <span className="tabular-nums" style={{ color: body }}>
              {flight.aircraftType || '—'}
            </span>
          </div>
          {flight.tailNumber && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Aircraft</span>
              <span className="font-mono font-medium" style={{ color: heading }}>
                {flight.tailNumber}
              </span>
            </div>
          )}
          {flight.serviceType && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Service</span>
              <span style={{ color: body }}>{flight.serviceType}</span>
            </div>
          )}
        </div>

        {/* Crew complement coverage — "Fully covered" when every position's
         *  delta is 0, otherwise per-position deltas (negative=under,
         *  positive=over). Replaces the separate "Pairing: Covered" row —
         *  coverage state is already implicit in the complement output. */}
        {coverageDeltas && coverageDeltas.length > 0 && (
          <div
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-1.5 mt-1"
            style={{ borderTop: `1px solid ${border}` }}
          >
            <span style={{ color: muted }}>Complement</span>
            {coverageDeltas.every((d) => d.delta === 0) ? (
              <span className="font-medium" style={{ color: '#06C270' }}>
                Fully covered
              </span>
            ) : (
              coverageDeltas.map((d) => {
                const color = d.delta === 0 ? '#06C270' : d.delta < 0 ? '#FF3B3B' : '#6600CC'
                const sign = d.delta > 0 ? '+' : ''
                return (
                  <span key={d.code} className="font-mono tabular-nums text-[12px]" style={{ color }}>
                    {`${sign}${d.delta} ${d.code}`}
                  </span>
                )
              })
            )}
          </div>
        )}
        {coverageState === 'uncovered' && flight.pairingId == null && (
          <div className="flex items-center gap-2 pt-1.5 mt-1" style={{ borderTop: `1px solid ${border}` }}>
            <span style={{ color: muted }}>Complement</span>
            <span className="font-medium" style={{ color: '#FF3B3B' }}>
              Uncovered
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
})

// ── Pairing tooltip ──────────────────────────────────────────────────────

interface PairingTooltipProps {
  pairing: Pairing
  clientX: number
  clientY: number
}

export const PairingTooltip = memo(function PairingTooltip({ pairing, clientX, clientY }: PairingTooltipProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useFollowCursor(clientX, clientY, true)

  // Resolve the pairing's legs against the loaded flight pool so we can feed
  // the legality engine. Memoized on pairing + pool identity so hovering the
  // same pill doesn't re-run the match.
  const pool = usePairingStore((s) => s.flights)
  const complements = usePairingStore((s) => s.complements)
  const positions = usePairingStore((s) => s.positions)
  const pairingFlights = useMemo(() => resolvePairingFlights(pairing, pool), [pairing, pool])
  const deadheadIds = useMemo(() => new Set(pairing.deadheadFlightIds), [pairing.deadheadFlightIds])
  const { result: legality } = usePairingLegality(pairingFlights, {
    complementKey: pairing.complementKey as 'standard' | 'aug1' | 'aug2' | 'custom',
    facilityClass: pairing.facilityClass ?? undefined,
    cockpitCount: pairing.cockpitCount,
    homeBase: pairing.baseAirport,
    deadheadIds,
  })
  const fdpCheck = legality.checks.find(
    (c) => c.label === 'Flight Duty Period' || c.label.toUpperCase().includes('FDP'),
  )

  // Crew complement — render as "1 CP 1 FO 1 PU 3 CA". Falls back to the
  // 5.4.3 catalog for pairings that haven't stored a per-pairing crewCounts,
  // and filters retired codes against the currently-active 5.4.2 positions
  // so e.g. a stale `PS`/`FA` from an earlier seed doesn't leak through.
  const complementDisplay = useMemo(() => {
    const raw =
      pairing.crewCounts ??
      resolveComplementCounts(
        complements,
        pairing.aircraftTypeIcao ?? pairing.legs[0]?.aircraftTypeIcao ?? null,
        pairing.complementKey,
      )
    if (!raw) return pairing.complementKey
    const activeCodes = positions.length > 0 ? new Set(positions.map((p) => p.code)) : null
    const filtered: Record<string, number> = {}
    for (const [code, n] of Object.entries(raw)) {
      if (!(n > 0)) continue
      if (activeCodes && !activeCodes.has(code)) continue
      filtered[code] = n
    }
    const order = ['CP', 'FO', 'SO', 'CM', 'PU', 'SA', 'FA', 'CA', 'BA']
    const parts: string[] = []
    for (const k of order) {
      if (filtered[k] > 0) parts.push(`${filtered[k]} ${k}`)
    }
    for (const k of Object.keys(filtered)) {
      if (!order.includes(k)) parts.push(`${filtered[k]} ${k}`)
    }
    return parts.length > 0 ? parts.join(' ') : pairing.complementKey
  }, [pairing, complements, positions])

  if (typeof document === 'undefined') return null

  // Prefer live legality so soft rules (4.1.5.4 aircraft-change ground
  // time) downgrade a stored 'legal' pairing to 'warning' in the tooltip.
  const liveStatus =
    legality.overallStatus === 'pass' ? 'legal' : legality.overallStatus === 'warning' ? 'warning' : 'violation'
  const status = getStatusStyle(liveStatus, isDark)

  const bg = isDark ? 'rgba(244,244,245,0.92)' : 'rgba(24,24,27,0.88)'
  const border = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const heading = isDark ? '#18181b' : '#fafafa'
  const body = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const muted = isDark ? 'rgba(24,24,27,0.55)' : 'rgba(250,250,250,0.50)'

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
        minWidth: 380,
      }}
    >
      <div
        className="rounded-xl p-4 space-y-2.5 text-[13px]"
        style={{
          background: bg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header: pairing code pill + route chain on the same row, with
            the workflow · status badge right-aligned. */}
        <div className="flex items-center gap-3">
          <span
            className="font-bold text-[14px] px-2 py-0.5 rounded shrink-0"
            style={{ background: status.bg, color: status.color }}
          >
            {pairing.pairingCode}
          </span>
          {pairing.routeChain && (
            <span
              className="font-mono text-[13px] truncate flex-1"
              style={{ color: heading }}
              title={pairing.routeChain}
            >
              {pairing.routeChain}
            </span>
          )}
          <span className="text-[11px] font-medium tracking-wider uppercase shrink-0" style={{ color: muted }}>
            {status.text}
          </span>
        </div>
        <div className="text-[11px] font-medium" style={{ color: muted }}>
          {pairing.legs.length} {pairing.legs.length === 1 ? 'leg' : 'legs'}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <span style={{ color: muted }}>Block</span>
            <span className="tabular-nums font-normal" style={{ color: heading }}>
              {fmtBlockMinutes(pairing.totalBlockMinutes)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>Duty</span>
            <span className="tabular-nums font-normal" style={{ color: heading }}>
              {fmtBlockMinutes(pairing.totalDutyMinutes)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>Days</span>
            <span className="tabular-nums" style={{ color: body }}>
              {pairing.pairingDays}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>Base</span>
            <span className="tabular-nums font-medium" style={{ color: heading }}>
              {pairing.baseAirport}
            </span>
          </div>
          {fdpCheck && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>FDP</span>
              <span className="tabular-nums font-normal" style={{ color: heading }}>
                {fdpCheck.actual}/{fdpCheck.limit}
              </span>
            </div>
          )}
          {pairing.aircraftTypeIcao && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>AC Type</span>
              <span className="tabular-nums" style={{ color: body }}>
                {pairing.aircraftTypeIcao}
              </span>
            </div>
          )}
          <div className="col-span-2 flex justify-between">
            <span style={{ color: muted }}>Complement</span>
            <span className="tabular-nums" style={{ color: body }}>
              {complementDisplay}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
})
