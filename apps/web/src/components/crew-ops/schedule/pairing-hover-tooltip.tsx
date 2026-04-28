'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { CrewAssignmentRef, CrewPositionRef, PairingRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'

/**
 * Pairing hover tooltip for 4.1.6 Crew Schedule. Ported from 4.1.5.2's
 * `PairingTooltip`:
 *   • Inverted-glass panel (dark in light mode, light in dark mode)
 *   • Pairing code pill + workflow · legality status line
 *   • Large DEP ─── N legs ─── ARR route block
 *   • Monospace routeChain line
 *   • 2-column info grid + a Complement row
 * Differences from 4.1.5.2:
 *   • Reads from 4.1.6 data shape (no `resolvePairingFlights` /
 *     `usePairingLegality`) — FDP is extracted from the stored
 *     `lastLegalityResult` when available, nothing dynamic.
 *   • Complement renders straight from `pairing.crewCounts` (already
 *     resolved server-side via the CrewComplement master fallback).
 */

interface Props {
  pairing: PairingRef
  positions: CrewPositionRef[]
  /** Active assignments in the current period — used to compute the
   *  per-seat delta (shortage = "-N", surplus = "+N") on the Complement
   *  row. Omit to render required counts only. */
  assignments?: CrewAssignmentRef[]
  /** The specific assignment being hovered — drives the source badge
   *  ("AUTO" vs "ASSIGNED BY USER"). */
  assignment?: CrewAssignmentRef
  clientX: number
  clientY: number
}

/** Trim a long user id like `SKYHUB-ADMIN-001` down to a tooltip-friendly
 *  number. Falls back to the raw id when no trailing digits exist. */
function shortUserId(id: string): string {
  const m = id.match(/(\d+)$/)
  if (!m) return id
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? String(n) : m[1]
}

function fmtMinutes(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '--:--'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function getStatusPill(fdtlStatus: string, isDark: boolean) {
  if (fdtlStatus === 'warning') return { bg: 'rgba(255,136,0,0.15)', color: '#FF8800', text: 'Warning' }
  if (fdtlStatus === 'violation') return { bg: 'rgba(255,59,59,0.15)', color: '#FF3B3B', text: 'Violation' }
  return { bg: 'rgba(6,194,112,0.15)', color: '#06C270', text: 'Legal' }
  void isDark
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

export const PairingHoverTooltip = memo(function PairingHoverTooltip({
  pairing,
  positions,
  assignments,
  assignment,
  clientX,
  clientY,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const ref = useFollowCursor(clientX, clientY)

  /** Complement row with coverage status per seat code.
   *    - shortage: `-N CP` (missing N CPs)
   *    - surplus:  `+N CA` (N more than required)
   *    - exact:    `1 CP` (no prefix)
   *  Derived from pairing.crewCounts (required) vs non-cancelled
   *  assignments on this pairing grouped by seat position. */
  const complementParts = useMemo(() => {
    const required = (pairing.crewCounts ?? {}) as Record<string, number>
    const activeCodes = positions.length > 0 ? new Set(positions.map((p) => p.code)) : null

    // Assigned count by position code.
    const assigned: Record<string, number> = {}
    if (assignments && assignments.length > 0) {
      const positionById = new Map(positions.map((p) => [p._id, p]))
      for (const a of assignments) {
        if (a.pairingId !== pairing._id) continue
        if (a.status === 'cancelled') continue
        const pos = positionById.get(a.seatPositionId)
        if (!pos) continue
        assigned[pos.code] = (assigned[pos.code] ?? 0) + 1
      }
    }

    // Union of codes that matter (required OR currently assigned).
    const codes = new Set<string>()
    for (const [c, n] of Object.entries(required)) if (n > 0) codes.add(c)
    for (const c of Object.keys(assigned)) codes.add(c)

    type Part = { code: string; required: number; filled: number; delta: number }
    const rows: Part[] = []
    for (const code of codes) {
      if (activeCodes && !activeCodes.has(code)) continue
      const req = required[code] ?? 0
      const fil = assigned[code] ?? 0
      rows.push({ code, required: req, filled: fil, delta: fil - req })
    }

    const order = ['CP', 'FO', 'SO', 'CM', 'PU', 'SA', 'FA', 'CA', 'BA']
    rows.sort((a, b) => {
      const ai = order.indexOf(a.code)
      const bi = order.indexOf(b.code)
      if (ai === -1 && bi === -1) return a.code.localeCompare(b.code)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    return rows
  }, [pairing, positions, assignments])

  // FDP from stored legality result (if present) — keep it simple.
  const fdpDisplay = useMemo(() => {
    const r = pairing.lastLegalityResult as unknown as {
      checks?: Array<{ label?: string; actual?: string | number; limit?: string | number }>
    } | null
    if (!r || !Array.isArray(r.checks)) return null
    const c = r.checks.find((x) => x.label === 'Flight Duty Period' || (x.label ?? '').toUpperCase().includes('FDP'))
    if (!c) return null
    return `${c.actual}/${c.limit}`
  }, [pairing])

  if (typeof document === 'undefined') return null

  const status = getStatusPill(pairing.fdtlStatus, isDark)
  const sourceLabel = assignment
    ? assignment.sourceRunId
      ? 'AUTO'
      : assignment.assignedByUserId
        ? `ASSIGNED BY USER ${shortUserId(assignment.assignedByUserId)}`
        : 'MANUAL'
    : pairing.workflowStatus === 'committed'
      ? 'COMMITTED'
      : 'DRAFT'

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
          minWidth: 280,
          maxWidth: 360,
        }}
      >
        {/* Header — code pill + source */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
            style={{ background: status.bg, color: status.color }}
          >
            {pairing.pairingCode}
          </span>
          <span className="flex-1" />
          <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: muted }}>
            {sourceLabel}
          </span>
        </div>

        {pairing.routeChain && (
          <div
            className="mt-1 font-semibold tabular-nums truncate"
            style={{ color: heading }}
            title={pairing.routeChain}
          >
            {pairing.routeChain}
          </div>
        )}

        {/* Compact 2-col stat grid — same row pattern as the POS tooltip's
            STD/STA block: uppercase label + heading-colour value inline. */}
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
          <span style={{ color: muted }}>
            <span className="uppercase tracking-wider mr-1">Block</span>
            <span style={{ color: heading }}>{fmtMinutes(pairing.totalBlockMinutes)}</span>
          </span>
          <span style={{ color: muted }}>
            <span className="uppercase tracking-wider mr-1">Duty</span>
            <span style={{ color: heading }}>{fmtMinutes(pairing.totalDutyMinutes)}</span>
          </span>
          <span style={{ color: muted }}>
            <span className="uppercase tracking-wider mr-1">Days</span>
            <span style={{ color: heading }}>{pairing.pairingDays}</span>
          </span>
          <span style={{ color: muted }}>
            <span className="uppercase tracking-wider mr-1">Base</span>
            <span style={{ color: heading }}>{pairing.baseAirport}</span>
          </span>
          {(() => {
            // Mixed-fleet pairing — distinct non-null AC types across legs.
            // Pairing's top-level `aircraftTypeIcao` is the dominant type;
            // legs can still differ (e.g. A320 leg + A321 leg).
            const distinct = new Set<string>()
            for (const l of pairing.legs) {
              if (l.aircraftTypeIcao) distinct.add(l.aircraftTypeIcao)
            }
            if (pairing.aircraftTypeIcao) distinct.add(pairing.aircraftTypeIcao)
            if (distinct.size === 0) return null
            const label = distinct.size > 1 ? 'MULTI' : (pairing.aircraftTypeIcao ?? [...distinct][0])
            return (
              <span style={{ color: muted }}>
                <span className="uppercase tracking-wider mr-1">AC</span>
                <span style={{ color: heading }}>{label}</span>
              </span>
            )
          })()}
          {fdpDisplay && (
            <span style={{ color: muted }}>
              <span className="uppercase tracking-wider mr-1">FDP</span>
              <span style={{ color: heading }}>{fdpDisplay}</span>
            </span>
          )}
        </div>

        {/* Complement — single line, label left, parts right. */}
        <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px] tabular-nums">
          <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: muted }}>
            Complement
          </span>
          <span className="text-right flex flex-wrap justify-end gap-x-2 gap-y-0.5">
            {complementParts.length === 0 ? (
              <span style={{ color: body }}>{pairing.complementKey || '—'}</span>
            ) : (
              complementParts.map((p) => {
                const color = p.delta < 0 ? '#FF3B3B' : p.delta > 0 ? '#FF8800' : heading
                const num = p.delta === 0 ? String(p.required) : p.delta > 0 ? `+${p.delta}` : String(p.delta)
                return (
                  <span key={p.code} style={{ color }}>
                    {num} {p.code}
                  </span>
                )
              })
            )}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
})
