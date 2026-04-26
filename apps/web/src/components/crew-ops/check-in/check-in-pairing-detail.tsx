'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plane,
  PlaneTakeoff,
  CalendarDays,
  Clock,
  Gauge,
  MapPin,
  Users as UsersIcon,
  CheckCircle2,
  Hourglass,
  AlertTriangle,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import type { PairingRef, CrewAssignmentRef, CrewMemberListItemRef, CrewPositionRef } from '@skyhub/api'
import { computeCheckInStatus, statusVisuals } from '@/lib/crew-checkin/check-in-status'
import { computeRrtMs } from '@/lib/crew-checkin/compute-rrt'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { useCheckInConfigStore } from '@/stores/use-check-in-config-store'

const ICONS = { CheckCircle2, Hourglass, AlertTriangle, XCircle, Plane, Clock }

interface Props {
  pairing: PairingRef | undefined
  assignments: CrewAssignmentRef[]
  crewById: Map<string, CrewMemberListItemRef>
  positionsById: Map<string, CrewPositionRef>
}

/**
 * 4.1.7.1 right pane — Pairing Detail.
 *
 *   Section order:
 *     1. Header chips: Base · Aircraft · Date
 *     2. Duty Information (legs table)
 *     3. Crew Check-In Status (per-crew rows with badge + action button)
 *     4. Summary KPIs (block, duty, FDP, complement, etc.)
 */
export function CheckInPairingDetail({ pairing, assignments, crewById, positionsById }: Props) {
  if (!pairing) {
    return (
      <div className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-tertiary px-6 text-center">
          Select a pairing on the left to view its duties and crew
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header pairing={pairing} />

      <div className="flex-1 overflow-auto p-3 space-y-4">
        <DutyInformation pairing={pairing} />
        <CrewCheckInStatus
          pairing={pairing}
          assignments={assignments}
          crewById={crewById}
          positionsById={positionsById}
        />
        <SummaryGrid pairing={pairing} />
      </div>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────

function Header({ pairing }: { pairing?: PairingRef }) {
  const date = pairing?.legs[0]?.flightDate ?? pairing?.startDate ?? ''
  return (
    <div className="border-b border-hz-border">
      <div className="h-9 px-3 flex items-center gap-3 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
        <span className="w-1 h-4 rounded-full" style={{ background: 'var(--module-accent, #1e40af)' }} />
        <span>Pairing Detail</span>
      </div>
      {pairing && (
        <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
          <span
            className="text-[18px] font-bold tracking-tight font-mono"
            style={{ color: 'var(--module-accent, #1e40af)' }}
          >
            {pairing.pairingCode}
          </span>
          <LegalityBadge status={pairing.fdtlStatus} />
          <Chip icon={<MapPin size={11} />} label="BASE" value={pairing.baseAirport || '—'} />
          <Chip icon={<Plane size={11} />} label="AIRCRAFT" value={pairing.aircraftTypeIcao ?? '—'} />
          <Chip icon={<CalendarDays size={11} />} label="DATE" value={fmtDate(date)} />
        </div>
      )}
    </div>
  )
}

function LegalityBadge({ status }: { status: PairingRef['fdtlStatus'] }) {
  const map = {
    legal: { label: 'Legal', color: '#06C270', bg: 'rgba(6,194,112,0.14)' },
    warning: { label: 'Warning', color: '#FF8800', bg: 'rgba(255,136,0,0.14)' },
    violation: { label: 'Violation', color: '#FF3B3B', bg: 'rgba(255,59,59,0.14)' },
  }
  const v = map[status] ?? map.legal
  return (
    <span
      className="inline-flex items-center gap-1 px-2 h-6 rounded-full text-[13px] font-semibold"
      style={{ color: v.color, background: v.bg }}
    >
      <CheckCircle2 size={12} />
      {v.label}
    </span>
  )
}

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[13px] bg-hz-background-hover"
      style={{ border: '1px solid var(--hz-border, rgba(125,125,140,0.2))' }}
    >
      <span className="text-hz-text-tertiary inline-flex items-center">{icon}</span>
      <span className="text-hz-text-tertiary uppercase tracking-wider font-semibold text-[13px]">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  )
}

// ── 1. Duty Information ────────────────────────────────────────────

function DutyInformation({ pairing }: { pairing: PairingRef }) {
  const totalBlock = pairing.legs.reduce((s, l) => s + (l.blockMinutes || 0), 0)
  return (
    <Section icon={<PlaneTakeoff size={14} />} title="Duty Information" badge={`${pairing.legs.length}`}>
      <div className="rounded-xl overflow-hidden border border-hz-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-hz-background-hover text-hz-text-tertiary">
              <Th>#</Th>
              <Th>Date</Th>
              <Th>Flight</Th>
              <Th>Dep</Th>
              <Th>Arr</Th>
              <Th>STD</Th>
              <Th>STA</Th>
              <Th>Block</Th>
              <Th>Tail</Th>
              <Th>DHC</Th>
            </tr>
          </thead>
          <tbody>
            {pairing.legs.map((l, i) => (
              <tr key={i} className="border-t border-hz-border">
                <Td>{i + 1}</Td>
                <Td>{fmtDate(l.flightDate)}</Td>
                <Td className="font-mono font-semibold">{l.flightNumber}</Td>
                <Td className="font-semibold uppercase">{l.depStation}</Td>
                <Td className="font-semibold uppercase">{l.arrStation}</Td>
                <Td className="font-mono">{fmtIsoTime(l.stdUtcIso)}</Td>
                <Td className="font-mono">{fmtIsoTime(l.staUtcIso)}</Td>
                <Td className="font-mono">{minToHM(l.blockMinutes)}</Td>
                <Td className="font-mono text-hz-text-tertiary">{l.tailNumber ?? '—'}</Td>
                <Td className="text-hz-text-tertiary">{l.isDeadhead ? 'YES' : '—'}</Td>
              </tr>
            ))}
            <tr className="border-t border-hz-border" style={{ background: 'rgba(62,123,250,0.06)' }}>
              <Td className="text-hz-text-tertiary uppercase tracking-wider font-semibold">Totals</Td>
              <Td className="text-hz-text-tertiary">{pairing.legs.length} legs</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td className="font-mono font-bold" style={{ color: 'var(--module-accent, #1e40af)' }}>
                {minToHM(totalBlock)}
              </Td>
              <Td>—</Td>
              <Td>—</Td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ── 2. Crew Check-In Status ────────────────────────────────────────

function CrewCheckInStatus({
  pairing,
  assignments,
  crewById,
  positionsById,
}: {
  pairing: PairingRef
  assignments: CrewAssignmentRef[]
  crewById: Map<string, CrewMemberListItemRef>
  positionsById: Map<string, CrewPositionRef>
}) {
  const checkIn = useCrewCheckInStore((s) => s.checkIn)
  const undoCheckIn = useCrewCheckInStore((s) => s.undoCheckIn)
  const checkInAll = useCrewCheckInStore((s) => s.checkInAllForPairing)
  const config = useCheckInConfigStore((s) => s.config)
  const [busy, setBusy] = useState<string | null>(null)
  const [busyAll, setBusyAll] = useState(false)

  // Tick to refresh late states.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const rrtMs = useMemo(() => computeRrtMs(pairing), [pairing])
  const stdMs = pairing.legs[0]?.stdUtcIso ? Date.parse(pairing.legs[0].stdUtcIso) : null

  const rows = useMemo(() => {
    return assignments
      .filter((a) => a.status !== 'cancelled')
      .map((a) => {
        const crew = crewById.get(a.crewId)
        const seat = positionsById.get(a.seatPositionId)
        return {
          assignmentId: a._id,
          checkInUtcMs: a.checkInUtcMs ?? null,
          positionCode: seat?.code ?? '—',
          rankOrder: seat?.rankOrder ?? 99,
          fullName: crew ? `${crew.lastName.toUpperCase()}, ${crew.firstName}` : '—',
          employeeId: crew?.employeeId ?? a.crewId.slice(0, 6),
          base: crew?.baseLabel ?? crew?.base ?? '—',
        }
      })
      .sort((a, b) => a.rankOrder - b.rankOrder || a.fullName.localeCompare(b.fullName))
  }, [assignments, crewById, positionsById])

  const pendingCount = rows.filter((r) => r.checkInUtcMs == null).length

  const headerAction =
    pendingCount > 0 ? (
      <button
        type="button"
        disabled={busyAll}
        onClick={async () => {
          setBusyAll(true)
          try {
            await checkInAll(pairing._id)
          } finally {
            setBusyAll(false)
          }
        }}
        className="h-7 px-2.5 rounded-md text-[13px] font-semibold text-white inline-flex items-center gap-1 transition-opacity disabled:opacity-50"
        style={{ background: '#06C270' }}
      >
        <CheckCircle2 size={11} />
        {busyAll ? 'Checking in…' : `Check-In All (${pendingCount})`}
      </button>
    ) : null

  return (
    <Section icon={<UsersIcon size={14} />} title="Crew Check-In Status" badge={`${rows.length}`} action={headerAction}>
      <div className="rounded-xl overflow-hidden border border-hz-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-hz-background-hover text-hz-text-tertiary">
              <Th>Pos</Th>
              <Th>Name</Th>
              <Th>Employee ID</Th>
              <Th>Base</Th>
              <Th>Check-In</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[13px] text-hz-text-tertiary">
                  No crew assigned
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const status = computeCheckInStatus({
                  rrtMs,
                  stdMs,
                  checkInUtcMs: r.checkInUtcMs,
                  nowMs: Date.now(),
                  thresholds: config
                    ? {
                        lateAfterMinutes: config.lateInfo.lateAfterMinutes,
                        veryLateAfterMinutes: config.lateInfo.veryLateAfterMinutes,
                        noShowAfterMinutes: config.lateInfo.noShowAfterMinutes,
                      }
                    : undefined,
                })
                const v = statusVisuals(status)
                const Icon = ICONS[v.icon as keyof typeof ICONS] ?? Clock
                const checkedIn = r.checkInUtcMs != null
                const rowBusy = busy === r.assignmentId
                return (
                  <tr key={r.assignmentId} className="border-t border-hz-border">
                    <Td>
                      <span
                        className="inline-flex items-center justify-center px-2 h-6 rounded-md text-[13px] font-bold"
                        style={{ background: 'rgba(62,123,250,0.15)', color: 'var(--module-accent, #1e40af)' }}
                      >
                        {r.positionCode}
                      </span>
                    </Td>
                    <Td className="font-medium">{r.fullName}</Td>
                    <Td className="font-mono text-hz-text-tertiary">{r.employeeId}</Td>
                    <Td className="font-semibold uppercase">{r.base}</Td>
                    <Td>
                      <span
                        className="inline-flex items-center gap-1 px-2 h-6 rounded-full text-[13px] font-semibold"
                        style={{ color: v.color, background: v.bg }}
                      >
                        <Icon size={12} />
                        {v.label}
                      </span>
                    </Td>
                    <Td>
                      {checkedIn ? (
                        <button
                          type="button"
                          disabled={rowBusy}
                          onClick={async () => {
                            setBusy(r.assignmentId)
                            try {
                              await undoCheckIn(r.assignmentId)
                            } finally {
                              setBusy(null)
                            }
                          }}
                          className="h-7 px-2.5 rounded-md text-[13px] font-semibold inline-flex items-center gap-1 transition-opacity disabled:opacity-50"
                          style={{
                            border: '1px solid var(--module-accent, #1e40af)',
                            color: 'var(--module-accent, #1e40af)',
                          }}
                        >
                          <RotateCcw size={11} />
                          Undo
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={rowBusy}
                          onClick={async () => {
                            setBusy(r.assignmentId)
                            try {
                              await checkIn(r.assignmentId)
                            } finally {
                              setBusy(null)
                            }
                          }}
                          className="h-7 px-2.5 rounded-md text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
                          style={{ background: '#06C270' }}
                        >
                          Check-In
                        </button>
                      )}
                    </Td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ── 3. Summary ─────────────────────────────────────────────────────

function SummaryGrid({ pairing }: { pairing: PairingRef }) {
  const block = pairing.totalBlockMinutes
  const duty = pairing.totalDutyMinutes
  const sectors = pairing.numberOfSectors
  const days = pairing.pairingDays
  const complement = formatComplement(pairing.crewCounts)

  return (
    <Section icon={<Gauge size={14} />} title="Summary">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Metric icon={<Clock size={13} />} label="Block Time" value={minToHM(block)} accent />
        <Metric icon={<Clock size={13} />} label="Duty Time" value={minToHM(duty)} />
        <Metric icon={<PlaneTakeoff size={13} />} label="Sectors" value={String(sectors)} />
        <Metric icon={<CalendarDays size={13} />} label="Pairing Days" value={String(days)} />
        <Metric icon={<MapPin size={13} />} label="Route" value={pairing.routeChain || '—'} className="col-span-2" />
        <Metric icon={<UsersIcon size={13} />} label="Complement" value={complement} className="col-span-2" />
      </div>
    </Section>
  )
}

function Metric({
  icon,
  label,
  value,
  accent,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-hz-border p-3 ${className}`}>
      <div className="flex items-center gap-1.5 text-[13px] text-hz-text-tertiary uppercase tracking-wider font-semibold mb-1">
        <span className="inline-flex items-center">{icon}</span>
        {label}
      </div>
      <div
        className="text-[18px] font-bold font-mono"
        style={{ color: accent ? 'var(--module-accent, #1e40af)' : undefined }}
      >
        {value}
      </div>
    </div>
  )
}

// ── primitives ─────────────────────────────────────────────────────

function Section({
  icon,
  title,
  badge,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  badge?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-5 rounded-full" style={{ background: 'var(--module-accent, #1e40af)' }} />
        <span className="inline-flex items-center gap-1.5 text-[14px] font-bold tracking-tight">
          <span className="text-hz-text-tertiary inline-flex items-center">{icon}</span>
          {title}
        </span>
        {badge && (
          <span
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[13px] font-bold"
            style={{ background: 'rgba(62,123,250,0.15)', color: 'var(--module-accent, #1e40af)' }}
          >
            {badge}
          </span>
        )}
        <div className="flex-1" />
        {action}
      </div>
      {children}
    </section>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left px-3 py-2 text-[13px] font-semibold uppercase tracking-wider">{children}</th>
}

function Td({
  children,
  className = '',
  style,
}: {
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <td className={`px-3 py-2 ${className}`} style={style}>
      {children}
    </td>
  )
}

// ── helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const d = iso.length >= 10 ? iso.slice(0, 10) : iso
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso
  return `${day}/${m}/${y}`
}
function fmtIsoTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const d = new Date(t)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
function minToHM(mins: number | null | undefined): string {
  if (mins == null || !Number.isFinite(mins)) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
function formatComplement(counts: Record<string, number> | null | undefined): string {
  if (!counts) return '—'
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n}${k.toUpperCase()}`)
  return parts.length > 0 ? parts.join(' · ') : '—'
}
