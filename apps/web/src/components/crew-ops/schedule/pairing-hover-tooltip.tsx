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
  clientX: number
  clientY: number
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
  const workflow = pairing.workflowStatus === 'committed' ? 'COMMITTED' : 'DRAFT'

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
            {workflow} · {status.text}
          </span>
        </div>
        <div className="text-[11px] font-medium" style={{ color: muted }}>
          {pairing.legs.length} {pairing.legs.length === 1 ? 'leg' : 'legs'}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <span style={{ color: muted }}>Block</span>
            <span className="tabular-nums font-normal" style={{ color: heading }}>
              {fmtMinutes(pairing.totalBlockMinutes)}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: muted }}>Duty</span>
            <span className="tabular-nums font-normal" style={{ color: heading }}>
              {fmtMinutes(pairing.totalDutyMinutes)}
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
          {fdpDisplay && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>FDP</span>
              <span className="tabular-nums font-normal" style={{ color: heading }}>
                {fdpDisplay}
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
          <div className="col-span-2 flex items-start justify-between gap-3">
            <span style={{ color: muted }}>Complement</span>
            <span className="tabular-nums text-right flex flex-wrap justify-end gap-x-2 gap-y-0.5">
              {complementParts.length === 0 ? (
                <span style={{ color: body }}>{pairing.complementKey || '—'}</span>
              ) : (
                complementParts.map((p) => {
                  // Colour code: shortage red, surplus orange, exact neutral.
                  const color = p.delta < 0 ? '#FF3B3B' : p.delta > 0 ? '#FF8800' : body
                  const num = p.delta === 0 ? String(p.required) : p.delta > 0 ? `+${p.delta}` : String(p.delta) // already has leading minus
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
      </div>
    </div>,
    document.body,
  )
})
