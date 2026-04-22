'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@skyhub/api'
import type {
  ActivityCodeGroupRef,
  ActivityCodeRef,
  CrewExpiryDateFullRef,
  CrewMemberListItemRef,
  CrewPhoneRef,
  CrewPositionRef,
  PairingRef,
} from '@skyhub/api'
import {
  AlertTriangle,
  BedDouble,
  CheckCircle,
  ChevronRight,
  Clock,
  Moon,
  Timer,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import type { LegalityResult } from '../pairing/types'
import { computeNightHours, computeTafb, minutesToHM, resolveRequiredRestMinutes } from '../pairing/lib/pairing-metrics'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'
import { useOperatorStore } from '@/stores/use-operator-store'
import { toUTC } from '@skyhub/logic'
import { CrewScheduleMemoPanel } from './crew-schedule-memo-panel'
import { ActivityCodePicker, type ActivityPickTimes } from './activity-code-picker'

/** Module-level airport _id → IATA cache. Shared across every BioTab mount so
 *  we only fetch once per session, even as the inspector is opened/closed. */
let _airportMapCache: Map<string, string> = new Map()

type Tab = 'duty' | 'assign' | 'bio' | 'expiry'

interface Props {
  onRefresh: () => void
}

/**
 * Right inspector panel for 4.1.6 Crew Schedule. Reads selection + data
 * from the store. Four tabs: Duty (pairing summary + legs + legality),
 * Assign (seat → crew assignment with eligibility filter), Bio (crew
 * profile summary), Expiry (expiry alerts).
 */
export function CrewScheduleRightPanel({ onRefresh }: Props) {
  const tab = useCrewScheduleStore((s) => s.inspectorTab)
  const setTab = useCrewScheduleStore((s) => s.setInspectorTab)

  const pairings = useCrewScheduleStore((s) => s.pairings)
  const crew = useCrewScheduleStore((s) => s.crew)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const positions = useCrewScheduleStore((s) => s.positions)
  const activityCodes = useCrewScheduleStore((s) => s.activityCodes)
  const activityGroups = useCrewScheduleStore((s) => s.activityGroups)
  const selectedCrewId = useCrewScheduleStore((s) => s.selectedCrewId)
  const selectedPairingId = useCrewScheduleStore((s) => s.selectedPairingId)
  const selectedAssignmentId = useCrewScheduleStore((s) => s.selectedAssignmentId)
  const selectedDateIso = useCrewScheduleStore((s) => s.selectedDateIso)
  const clearDateCell = useCrewScheduleStore((s) => s.clearDateCell)
  const rangeSelection = useCrewScheduleStore((s) => s.rangeSelection)
  const clearRangeSelection = useCrewScheduleStore((s) => s.clearRangeSelection)
  const setRightPanelOpen = useCrewScheduleStore((s) => s.setRightPanelOpen)

  const pairing = useMemo(
    () => (selectedPairingId ? (pairings.find((p) => p._id === selectedPairingId) ?? null) : null),
    [selectedPairingId, pairings],
  )
  const selectedCrew = useMemo(
    () => (selectedCrewId ? (crew.find((c) => c._id === selectedCrewId) ?? null) : null),
    [selectedCrewId, crew],
  )
  const assignment = useMemo(
    () => (selectedAssignmentId ? (assignments.find((a) => a._id === selectedAssignmentId) ?? null) : null),
    [selectedAssignmentId, assignments],
  )
  // Auto-switch to the Assign tab whenever a date cell is selected so
  // the activity picker appears without a manual tab click. Same for
  // a multi-day range when the block menu "Assign series" is triggered.
  useEffect(() => {
    if (selectedDateIso || rangeSelection) setTab('assign')
  }, [selectedDateIso, rangeSelection, setTab])

  if (!pairing && !selectedCrew && !selectedDateIso) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-[13px] text-hz-text-tertiary">
          Select a bar, a crew member, or double-click a date to assign an activity.
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-hz-border/30">
        <div className="flex items-center gap-1">
          {(['duty', 'assign', 'bio', 'expiry'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="h-8 px-3 rounded-md text-[13px] font-medium capitalize transition-colors"
              style={{
                background: tab === t ? 'var(--module-accent)' : 'transparent',
                color: tab === t ? '#FFFFFF' : undefined,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="w-8 h-8 rounded-md hover:bg-hz-border/20 flex items-center justify-center"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'duty' && <DutyTab pairing={pairing} positions={positions} />}
        {tab === 'assign' &&
          (rangeSelection ? (
            <ActivityAssignTab
              crew={crew.find((c) => c._id === rangeSelection.crewIds[0]) ?? null}
              positions={positions}
              range={{ fromIso: rangeSelection.fromIso, toIso: rangeSelection.toIso }}
              activityCodes={activityCodes}
              activityGroups={activityGroups}
              onClose={clearRangeSelection}
              onAssigned={() => {
                clearRangeSelection()
                onRefresh()
              }}
            />
          ) : selectedDateIso && selectedCrewId ? (
            <ActivityAssignTab
              crew={selectedCrew}
              positions={positions}
              dateIso={selectedDateIso}
              activityCodes={activityCodes}
              activityGroups={activityGroups}
              onClose={clearDateCell}
              onAssigned={() => {
                clearDateCell()
                onRefresh()
              }}
            />
          ) : assignment && pairing ? (
            // Pairing selected: Assign tab shows the activity picker
            // keyed to the pairing's crew + startDate (same UX as
            // double-clicking an empty cell on that crew/date).
            <ActivityAssignTab
              crew={crew.find((c) => c._id === assignment.crewId) ?? null}
              positions={positions}
              dateIso={pairing.startDate}
              activityCodes={activityCodes}
              activityGroups={activityGroups}
              onClose={() => setTab('duty')}
              onAssigned={onRefresh}
            />
          ) : selectedCrew ? (
            <div className="p-4 text-[13px] text-hz-text-tertiary">
              Double-click a date cell, or shift-drag a range, to assign activity codes.
            </div>
          ) : (
            <div className="p-4 text-[13px] text-hz-text-tertiary">Select a crew + date first.</div>
          ))}
        {tab === 'bio' && <BioTab crew={selectedCrew} />}
        {tab === 'expiry' && <ExpiryTab crew={selectedCrew} />}
      </div>
    </div>
  )
}

function DutyTab({ pairing, positions }: { pairing: PairingRef | null; positions: CrewPositionRef[] }) {
  if (!pairing) return <div className="p-4 text-[13px] text-hz-text-tertiary">No pairing selected.</div>

  // Header status pill.
  const statusColor =
    pairing.fdtlStatus === 'violation' ? '#FF3B3B' : pairing.fdtlStatus === 'warning' ? '#FF8800' : '#06C270'
  const statusLabel =
    pairing.fdtlStatus === 'violation' ? 'Violation' : pairing.fdtlStatus === 'warning' ? 'Warning' : 'Legal'
  const StatusIcon =
    pairing.fdtlStatus === 'violation' ? XCircle : pairing.fdtlStatus === 'warning' ? AlertTriangle : CheckCircle

  // Complement — template name + per-seat badges. Filter to positions that
  // are currently ACTIVE in 5.4.2 so retired codes (e.g. FA / PS from a prior
  // operator config) never surface. Mirrors the resolvedCrewCounts filter
  // used by the full Pairing Details dialog.
  const activeCodes = new Set(positions.filter((p) => p.isActive !== false).map((p) => p.code))
  const crewCountEntries = Object.entries(pairing.crewCounts ?? {}).filter(
    ([code, n]) => (n || 0) > 0 && (positions.length === 0 || activeCodes.has(code)),
  )
  const templateLabel = complementLabel(pairing.complementKey)

  // Parse lastLegalityResult if it matches the shape used by 4.1.5.2.
  const legalityResult = normalizeLegalityResult(pairing.lastLegalityResult)

  return (
    <div className="p-4 space-y-4">
      {/* Header — pairing code + status pill. Pill is hidden for legal
          AND warning pairings; only real violations surface here to keep
          the header quiet. */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-bold tracking-tight tabular-nums text-hz-text">{pairing.pairingCode}</h3>
          {pairing.fdtlStatus === 'violation' && (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-bold px-2 h-[22px] rounded-full tabular-nums"
              style={{
                background: `${statusColor}18`,
                color: statusColor,
                border: `1px solid ${statusColor}55`,
              }}
            >
              <StatusIcon size={11} strokeWidth={2.4} />
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {/* Complement — template label + per-seat counts on one row. The
          cockpit/cabin totals were removed since the per-seat pills already
          convey the same info more densely. */}
      <SectionHeader title="Complement" />
      <div className="flex items-center gap-3 flex-wrap text-[13px] text-hz-text">
        <div className="flex items-center gap-2 shrink-0">
          <Users size={13} strokeWidth={2} style={{ color: 'var(--module-accent)' }} />
          <span className="font-semibold">{templateLabel}</span>
        </div>
        {crewCountEntries.length > 0 && <ComplementBadges entries={crewCountEntries} positions={positions} />}
      </div>

      {/* Flight Legs — compact columnar table (Date / Flight / DEP / ARR / STD / STA / Block / Tail) */}
      <SectionHeader title={`Flight Legs (${pairing.legs.length})`} />
      <LegsMiniTable legs={pairing.legs} />

      {/* Summary — 2-column tile grid. Panel is narrow, so we only surface the
          high-signal metrics requested for 4.1.6: Block, Duty, FDP, Night, TAFB, Rest. */}
      <SectionHeader title="Summary" />
      <SummaryGrid pairing={pairing} legalityResult={legalityResult} />

      {/* Legality — only rendered when the stored result matches the expected shape. */}
      {legalityResult && (
        <>
          <SectionHeader title="Legality" />
          <LegalityRows result={legalityResult} />
        </>
      )}

      {/* Memos */}
      <SectionHeader title="Memos" />
      <DutyMemoPanel pairingId={pairing._id} />
    </div>
  )
}

/** Compact legs table. Columns: Date (DD/MM) · Flight · DEP · ARR · STD · STA · Block · Tail.
 *  Narrow-column layout tuned for the right inspector (~380–420px). STD/STA rendered in UTC
 *  HH:MM; Block from the stored leg minutes. Header is sticky-looking via a thin divider. */
function LegsMiniTable({ legs }: { legs: PairingRef['legs'] }) {
  if (legs.length === 0) {
    return <div className="text-[13px] text-hz-text-tertiary">No legs.</div>
  }
  // Compact single-row table at 10px — exception to the 13px floor, approved
  // for this inspector because 8 columns (Date, Flt, DEP, ARR, STD, STA, Blk,
  // Tail) can't fit legibly at a larger size in a ~360px panel. Flight number
  // is stripped of its 2-letter airline prefix (e.g. "SH400" → "400") to save
  // horizontal room — the airline code is redundant inside a single operator.
  return (
    <div className="rounded-lg border border-hz-border/20 bg-hz-border/[0.04] overflow-hidden">
      <table className="w-full text-[11px] tabular-nums border-collapse">
        <thead>
          <tr className="bg-hz-border/10">
            <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
              Date
            </th>
            <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
              Flt
            </th>
            <th className="text-left px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
              Dep
            </th>
            <th className="text-left px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
              Arr
            </th>
            <th className="text-right px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
              Std
            </th>
            <th className="text-right px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
              Sta
            </th>
            <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
              Tail
            </th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => {
            // Layover marker — inserted between two consecutive legs when
            // the station chains (prev.arr === curr.dep) AND the ground
            // gap between STA and STD is 6+ hours (rough "overnight /
            // long rest" heuristic). Accurate enough without pulling in
            // the FDTL rest-rule engine.
            const prev = i > 0 ? legs[i - 1] : null
            const layover = (() => {
              if (!prev) return null
              if (prev.arrStation !== leg.depStation) return null
              const prevSta = new Date(prev.staUtcIso).getTime()
              const curStd = new Date(leg.stdUtcIso).getTime()
              const gapMin = Math.round((curStd - prevSta) / 60_000)
              if (gapMin < 6 * 60) return null
              return { station: leg.depStation, gapMin }
            })()
            return (
              <Fragment key={`${leg.flightId}-${i}`}>
                {layover && (
                  <tr className="bg-hz-border/[0.06] border-t border-hz-border/10">
                    <td colSpan={7} className="px-2 py-1">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                        <span className="h-px flex-1" style={{ background: 'rgba(142,142,160,0.25)' }} />
                        <span style={{ color: 'var(--module-accent)' }}>
                          Layover · {layover.station} · {formatGap(layover.gapMin)}
                        </span>
                        <span className="h-px flex-1" style={{ background: 'rgba(142,142,160,0.25)' }} />
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  className={`${i % 2 === 1 ? 'bg-hz-border/[0.04]' : ''} hover:bg-hz-border/[0.08] transition-colors border-t border-hz-border/10`}
                >
                  <td className="px-1.5 py-1 text-hz-text-secondary whitespace-nowrap">{formatDDMM(leg.flightDate)}</td>
                  <td className="px-1.5 py-1 font-semibold text-hz-text whitespace-nowrap">
                    {stripAirlinePrefix(leg.flightNumber)}
                  </td>
                  <td className="px-1 py-1 text-hz-text">{leg.depStation}</td>
                  <td className="px-1 py-1 text-hz-text">{leg.arrStation}</td>
                  <td className="px-1 py-1 text-right text-hz-text whitespace-nowrap">{leg.stdUtcIso.slice(11, 16)}</td>
                  <td className="px-1 py-1 text-right text-hz-text whitespace-nowrap">{leg.staUtcIso.slice(11, 16)}</td>
                  <td className="px-1.5 py-1 text-hz-text-tertiary truncate max-w-[60px]">{leg.tailNumber ?? '—'}</td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Strip leading 2-letter airline code (IATA style) from a flight number.
 *  "SH400" → "400", "SH401A" → "401A". Pure-digit flight numbers pass through. */
function stripAirlinePrefix(flightNo: string): string {
  return flightNo.replace(/^[A-Z]{2}(?=\d)/, '')
}

/** Format a minute count as "H:MM" for the layover separator. */
function formatGap(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** YYYY-MM-DD → DD/MM. Intentionally bypasses the operator date format:
 *  the narrow leg table can't fit a full DD/MM/YYYY or DD-MMM-YY per row,
 *  and the year is redundant since the pairing header already surfaces it. */
function formatDDMM(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  const parts = ymd.split('-')
  if (parts.length < 3) return '—'
  return `${parts[2]}/${parts[1]}`
}

/** Summary metrics in a 2-column tile grid. Uses the same helpers as the full
 *  Pairing Details dialog so numbers match. FDP is read from the stored FDTL
 *  result when available; TAFB and Required Rest use defaults when no rule set
 *  has been fetched in this panel. */
function SummaryGrid({ pairing, legalityResult }: { pairing: PairingRef; legalityResult: LegalityResult | null }) {
  const blockMin = pairing.totalBlockMinutes
  const dutyMin = pairing.totalDutyMinutes
  // PairingRef.legs is structurally a superset of PairingLegMeta (fields are
  // required rather than optional). Cast through unknown to satisfy the metric
  // helpers, which only read stdUtcIso / staUtcIso / blockMinutes / legOrder.
  const legsForMetrics = pairing.legs.map((l) => ({
    ...l,
    legOrder: l.legOrder,
  })) as unknown as import('../pairing/types').PairingLegMeta[]
  const nightMin = computeNightHours({ legs: legsForMetrics })
  // Feed the loaded FDTL rule set so Required Rest reflects CAAV (or
  // whichever scheme) rather than the adaptive heuristic.
  const ruleSet = useCrewScheduleStore.getState().ruleSet as Parameters<typeof resolveRequiredRestMinutes>[0] | null
  const tafbMin = computeTafb({ legs: legsForMetrics }, ruleSet ?? null)
  const requiredRestMin = resolveRequiredRestMinutes(ruleSet ?? null, dutyMin)
  const fdpCheck = legalityResult?.checks.find(
    (c) => c.label === 'Flight Duty Period' || c.label.toUpperCase().includes('FDP'),
  )
  // Show actual / max — e.g. "9:05 / 10:00". If we don't have the engine's
  // limit we fall back to just the actual. Max comes straight from the FDTL
  // rule set via the legality result, so no extra lookup is needed.
  const fdpDisplay = fdpCheck ? (fdpCheck.limit ? `${fdpCheck.actual} / ${fdpCheck.limit}` : fdpCheck.actual) : '—'

  return (
    <div className="grid grid-cols-2 gap-2">
      <MiniMetric icon={<Clock size={13} />} label="Block Time" value={minutesToHM(blockMin)} />
      <MiniMetric icon={<Timer size={13} />} label="Duty Time" value={minutesToHM(dutyMin)} />
      <MiniMetric icon={<Clock size={13} />} label="FDP" value={fdpDisplay} />
      <MiniMetric icon={<Moon size={13} />} label="Night Hours" value={minutesToHM(nightMin)} />
      <MiniMetric icon={<Timer size={13} />} label="TAFB" value={minutesToHM(tafbMin)} />
      <MiniMetric icon={<BedDouble size={13} />} label="Required Rest" value={minutesToHM(requiredRestMin)} />
    </div>
  )
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-hz-border/20 bg-hz-border/5 px-2 py-1">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-hz-text-tertiary">
        <span style={{ color: 'var(--module-accent)' }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-[13px] font-bold tabular-nums text-hz-text">{value}</div>
    </div>
  )
}

/** Inline dot-separated complement chips: `1 CP · 1 FO · 1 PU · 3 CA`. */
function ComplementBadges({ entries, positions }: { entries: Array<[string, number]>; positions: CrewPositionRef[] }) {
  // Order cockpit first, then cabin; inside each group by rankOrder.
  const positionsByCode = new Map(positions.map((p) => [p.code, p]))
  const ordered = entries.slice().sort((a, b) => {
    const pa = positionsByCode.get(a[0])
    const pb = positionsByCode.get(b[0])
    if (!pa && !pb) return a[0].localeCompare(b[0])
    if (!pa) return 1
    if (!pb) return -1
    if (pa.category !== pb.category) return pa.category === 'cockpit' ? -1 : 1
    return pa.rankOrder - pb.rankOrder
  })
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
      {ordered.map(([code, count], i) => (
        <span key={code} className="inline-flex items-center gap-1">
          <span className="font-semibold" style={{ color: 'var(--module-accent)' }}>
            {count}
          </span>
          <span className="text-hz-text-secondary">{code}</span>
          {i < ordered.length - 1 && <span className="pl-2 text-hz-text-tertiary/60">·</span>}
        </span>
      ))}
    </div>
  )
}

/** FDTL legality rule rows with colored left strip. */
function LegalityRows({ result }: { result: LegalityResult }) {
  return (
    <div className="space-y-1">
      {result.checks.map((c, i) => {
        const color =
          c.status === 'violation'
            ? '#FF3B3B'
            : c.status === 'warning'
              ? '#FF8800'
              : c.status === 'pass'
                ? '#06C270'
                : '#0063F7'
        return (
          <div
            key={i}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-hz-border/20 bg-hz-border/5"
          >
            <span className="w-1 h-4 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-[13px] font-semibold text-hz-text">{c.label}</span>
            <span className="ml-auto text-[13px] tabular-nums text-hz-text-secondary">{c.actual}</span>
            <span className="text-[13px] tabular-nums text-hz-text-tertiary">/ {c.limit}</span>
          </div>
        )
      })}
      {result.tableRef && <p className="text-[13px] italic pt-1 text-hz-text-tertiary">Ref: {result.tableRef}</p>}
    </div>
  )
}

/** Runtime-check `PairingRef.lastLegalityResult` (typed `unknown`) against
 *  the `LegalityResult` shape used by the 4.1.5.2 inspector. Returns `null`
 *  when the field is missing or doesn't have at least one check row. */
function normalizeLegalityResult(raw: unknown): LegalityResult | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<LegalityResult>
  if (!Array.isArray(r.checks) || r.checks.length === 0) return null
  if (typeof r.overallStatus !== 'string') return null
  return r as LegalityResult
}

function complementLabel(key: string | null | undefined): string {
  switch (key) {
    case 'standard':
      return 'Standard'
    case 'aug1':
      return 'Aug 1'
    case 'aug2':
      return 'Aug 2'
    case 'custom':
      return 'Custom'
    default:
      return key ? key.charAt(0).toUpperCase() + key.slice(1) : '—'
  }
}

/** Thin wrapper so the memo panel can read `onRefresh` from context
 *  without DutyTab growing another prop. Looks up the refresh via the
 *  store (we pass `commitPeriod` directly). */
function DutyMemoPanel({ pairingId }: { pairingId: string }) {
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)
  return (
    <CrewScheduleMemoPanel
      scope="pairing"
      targetId={pairingId}
      onAfterMutate={() => {
        void reconcilePeriod()
      }}
    />
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-[3px] h-4 rounded-sm" style={{ backgroundColor: 'var(--module-accent)' }} />
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-hz-text-secondary">{title}</h3>
    </div>
  )
}

function DetailGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="grid grid-cols-2 gap-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="text-[11px] uppercase tracking-wider text-hz-text-tertiary">{k}</div>
          <div className="text-[13px] font-medium text-right">{v}</div>
        </div>
      ))}
    </div>
  )
}

function ActivityAssignTab({
  crew,
  positions,
  dateIso,
  range,
  activityCodes,
  activityGroups,
  onClose,
  onAssigned,
}: {
  crew: CrewMemberListItemRef | null
  positions: CrewPositionRef[]
  /** Single-date mode (double-click empty cell). */
  dateIso?: string
  /** Range mode (AIMS §6.1 "Assign series of duties"). */
  range?: { fromIso: string; toIso: string }
  activityCodes: ActivityCodeRef[]
  activityGroups: ActivityCodeGroupRef[]
  onClose: () => void
  onAssigned: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const crewPositionId = crew?.position ?? null

  const datesInScope = useMemo(() => {
    if (range) {
      const out: string[] = []
      const from = new Date(range.fromIso + 'T00:00:00Z').getTime()
      const to = new Date(range.toIso + 'T00:00:00Z').getTime()
      for (let t = from; t <= to; t += 86_400_000) {
        out.push(new Date(t).toISOString().slice(0, 10))
      }
      return out
    }
    return dateIso ? [dateIso] : []
  }, [range, dateIso])

  const operatorTz = useOperatorStore((s) => s.operator?.timezone ?? 'UTC')
  const replaceActivityId = useCrewScheduleStore((s) => s.replaceActivityId)
  const clearReplaceActivity = useCrewScheduleStore((s) => s.clearReplaceActivity)

  const assign = async (code: ActivityCodeRef, times?: ActivityPickTimes) => {
    if (!crew || datesInScope.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const buildWindow = (d: string) => {
        if (!times) return {}
        const startLocal = new Date(`${d}T${times.startHHMM}:00`)
        let endLocal = new Date(`${d}T${times.endHHMM}:00`)
        // End <= start → crosses midnight, roll to next day.
        if (endLocal.getTime() <= startLocal.getTime()) {
          endLocal = new Date(endLocal.getTime() + 86_400_000)
        }
        return {
          startUtcIso: toUTC(startLocal, operatorTz).toISOString(),
          endUtcIso: toUTC(endLocal, operatorTz).toISOString(),
        }
      }
      // Replace-mode: drop the existing activity before creating the new
      // one. No prompt — user already confirmed by double-clicking the bar.
      if (replaceActivityId && datesInScope.length === 1) {
        try {
          await api.deleteCrewActivity(replaceActivityId)
        } catch (err) {
          // If it was already gone (e.g. deleted elsewhere), proceed.
          console.warn('Replace: delete failed, continuing with create', err)
        }
      }
      if (datesInScope.length === 1) {
        const d = datesInScope[0]
        await api.createCrewActivity({ crewId: crew._id, activityCodeId: code._id, dateIso: d, ...buildWindow(d) })
      } else {
        await api.createCrewActivitiesBulk({
          activities: datesInScope.map((d) => ({
            crewId: crew._id,
            activityCodeId: code._id,
            dateIso: d,
            ...buildWindow(d),
          })),
        })
      }
      clearReplaceActivity()
      onAssigned()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const positionLabel = crewPositionId ? (positions.find((p) => p._id === crewPositionId)?.code ?? '—') : '—'
  const fmtDate = useDateFormat()

  return (
    <div className="flex flex-col h-full">
      {/* Header strip — crew + date + Cancel */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="text-[13px] uppercase tracking-wider text-hz-text-tertiary">
              {range
                ? `Assign Series · ${datesInScope.length} days`
                : replaceActivityId
                  ? 'Replace Activity'
                  : 'Assign Activity'}
            </div>
            <div className="text-[15px] font-semibold truncate">
              {crew ? `${crew.lastName} ${crew.firstName}` : '—'}
            </div>
            <div className="text-[13px] text-hz-text-secondary tabular-nums">
              {positionLabel} · {range ? `${fmtDate(range.fromIso)} → ${fmtDate(range.toIso)}` : fmtDate(dateIso)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 px-2 rounded-md text-[13px] font-medium text-hz-text-tertiary hover:bg-hz-border/20 shrink-0"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div
            className="mt-3 p-2 rounded-md text-[13px]"
            style={{ backgroundColor: 'rgba(255,59,59,0.12)', color: '#FF3B3B' }}
          >
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-4 pb-4">
        <ActivityCodePicker
          activityCodes={activityCodes}
          activityGroups={activityGroups}
          crewPositionId={crewPositionId}
          disabled={busy}
          onPick={assign}
        />
      </div>
    </div>
  )
}

function BioTab({ crew }: { crew: CrewMemberListItemRef | null }) {
  const reconcilePeriod = useCrewScheduleStore((s) => s.reconcilePeriod)
  const positions = useCrewScheduleStore((s) => s.positions)
  const fmt = useDateFormat()

  // Client-side fallback for `crew.baseLabel`. The server *should* resolve
  // the base UUID → airport IATA code and attach it, but to be robust against
  // stale deployments (and any code path that returns a raw CrewMemberRef),
  // fetch airports once and map the UUID ourselves. Cache in module-level
  // state so every BioTab mount reuses the same list.
  const [airportById, setAirportById] = useState<Map<string, string>>(() => _airportMapCache)
  useEffect(() => {
    if (airportById.size > 0) return
    let cancelled = false
    void api
      .getAirports()
      .then((list) => {
        if (cancelled) return
        const m = new Map<string, string>()
        for (const a of list) if (a.iataCode) m.set(a._id, a.iataCode)
        _airportMapCache = m
        setAirportById(m)
      })
      .catch((e) => console.error('[BioTab] getAirports failed:', e))
    return () => {
      cancelled = true
    }
  }, [airportById])

  // Fetch the full crew profile (phones live in a separate collection, so the
  // list-item record the schedule store holds doesn't include them). Scoped
  // to the selected crew and cleared when the selection changes.
  const [phones, setPhones] = useState<CrewPhoneRef[] | null>(null)
  useEffect(() => {
    if (!crew) {
      setPhones(null)
      return
    }
    let cancelled = false
    void api
      .getCrewById(crew._id)
      .then((full) => {
        if (!cancelled) setPhones(full.phones)
      })
      .catch((e) => {
        console.error('[BioTab] getCrewById failed:', e)
        if (!cancelled) setPhones([])
      })
    return () => {
      cancelled = true
    }
  }, [crew])

  if (!crew) return <div className="p-4 text-[13px] text-hz-text-tertiary">No crew selected.</div>

  // baseLabel comes from the server when available; otherwise resolve via the
  // airports map; otherwise show em-dash. Never show the raw UUID.
  const resolvedBase = crew.baseLabel ?? (crew.base ? (airportById.get(crew.base) ?? null) : null)

  // Primary crew phone — sort by ascending priority (lowest wins) and pick
  // the first. Falls back to em-dash while loading / when no phones on file.
  const primaryPhone = (() => {
    if (!phones) return null // loading
    if (phones.length === 0) return '—'
    const sorted = [...phones].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    return sorted[0]?.number ?? '—'
  })()

  // Resolve position → code / name / accent color for the hero pill.
  const position = crew.position ? positions.find((p) => p._id === crew.position) : null
  const initials = `${crew.firstName?.[0] ?? ''}${crew.lastName?.[0] ?? ''}`.toUpperCase() || '?'
  const statusColor =
    crew.status === 'active'
      ? '#06C270'
      : crew.status === 'suspended'
        ? '#FF8800'
        : crew.status === 'terminated'
          ? '#FF3B3B'
          : '#8F90A6'

  // Flags — only render the pills that are `true`; hide the rest to keep the
  // panel uncluttered. If none are set we omit the Flags section entirely.
  const flags: Array<{ label: string; tone: 'warn' | 'info' | 'muted' }> = []
  if (crew.crewUnderTraining) flags.push({ label: 'Under training', tone: 'info' })
  if (crew.standbyExempted) flags.push({ label: 'Standby exempt', tone: 'warn' })
  if (crew.noDomesticFlights) flags.push({ label: 'No domestic', tone: 'warn' })
  if (crew.noInternationalFlights) flags.push({ label: 'No international', tone: 'warn' })
  if (crew.transportRequired) flags.push({ label: 'Transport required', tone: 'muted' })
  if (crew.hotelAtHomeBase) flags.push({ label: 'Hotel at home base', tone: 'muted' })

  // Contact email — prefer primary, fall back to secondary.
  const email = crew.emailPrimary ?? crew.emailSecondary ?? null

  // Address line — compose from present fields only.
  const addressParts = [
    crew.addressLine1,
    crew.addressLine2,
    crew.addressCity,
    crew.addressState,
    crew.addressZip,
    crew.addressCountry,
  ].filter(Boolean) as string[]
  const address = addressParts.length > 0 ? addressParts.join(', ') : null

  return (
    <div className="p-4 space-y-4">
      {/* Hero card — avatar + name + identifiers. Reorganized into a clear
          vertical stack so nothing truncates in the narrow inspector:
            Line 1 — full name (clicking opens the full profile)
            Line 2 — position pill · status pill · employee # · seniority
          Removed the separate "Profile →" button — the name itself is now the
          link (underline on hover), freeing horizontal room for the identifiers. */}
      <div
        className="rounded-xl p-3 flex items-center gap-3"
        style={{
          background: 'color-mix(in srgb, var(--module-accent) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--module-accent) 20%, transparent)',
        }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0"
          style={{
            background: 'var(--module-accent)',
            color: 'white',
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <a
            href={`/crew-ops/control/crew-profile?id=${encodeURIComponent(crew._id)}`}
            className="block text-[15px] font-bold tabular-nums text-hz-text hover:underline truncate"
            title={`${crew.lastName} ${crew.firstName} — open full profile`}
          >
            {crew.lastName} {crew.firstName}
          </a>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[13px] text-hz-text-secondary tabular-nums">
            {position && (
              <span
                className="inline-flex items-center h-[18px] px-1.5 rounded text-[11px] font-bold tabular-nums"
                style={{
                  background: `${position.color ?? '#7c3aed'}22`,
                  color: position.color ?? '#7c3aed',
                  border: `1px solid ${position.color ?? '#7c3aed'}44`,
                }}
              >
                {position.code}
              </span>
            )}
            {/* Status pill rendered ONLY for non-active states — "active" is
                the overwhelming default and the pill was just noise. Surface
                suspended / terminated / inactive since those ARE actionable. */}
            {crew.status !== 'active' && (
              <span
                className="inline-flex items-center h-[18px] px-1.5 rounded text-[11px] font-bold uppercase tracking-wider"
                style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}
              >
                {crew.status}
              </span>
            )}
            <span className="text-hz-text-tertiary">#{crew.employeeId}</span>
            {crew.seniority != null && (
              <>
                <span className="text-hz-text-tertiary">·</span>
                <span>Sen. {crew.seniority}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Employment — what a crew tracker actually looks up mid-op: current
          base, primary phone, seniority group. Phone comes from the separate
          CrewPhone collection (fetched lazily above). Contract, payroll #,
          hire date live in the full Crew Profile page for HR use. */}
      <SectionHeader title="Employment" />
      <BioGrid
        rows={[
          ['Base', resolvedBase ?? '—'],
          ['Phone', primaryPhone ?? '…'],
          ['Group', crew.seniorityGroup != null ? String(crew.seniorityGroup) : '—'],
        ]}
      />

      {/* Qualifications — chip rows for a/c types and languages */}
      {((crew.acTypes && crew.acTypes.length > 0) || (crew.languages && crew.languages.length > 0)) && (
        <>
          <SectionHeader title="Qualifications" />
          <div className="space-y-2">
            {crew.acTypes && crew.acTypes.length > 0 && <ChipRow label="A/C" items={crew.acTypes} tone="accent" />}
            {crew.languages && crew.languages.length > 0 && (
              <ChipRow label="Languages" items={crew.languages} tone="muted" />
            )}
          </div>
        </>
      )}

      {/* Identity */}
      <SectionHeader title="Identity" />
      <BioGrid
        rows={[
          ['DOB', fmt(crew.dateOfBirth)],
          ['Gender', crew.gender ? crew.gender[0].toUpperCase() + crew.gender.slice(1) : '—'],
          ['Nationality', crew.nationality ?? '—'],
        ]}
      />

      {/* Contact Details — primary/secondary email + mailing address. The
          crew-phone list lives in a separate collection; the Crew Profile page
          surfaces it and this tab links through to that for the full picture. */}
      {(email || crew.emailSecondary || address) && (
        <>
          <SectionHeader title="Contact Details" />
          <BioGrid
            rows={[
              email ? ['Email', email] : null,
              crew.emailSecondary && crew.emailSecondary !== email ? ['Email (2)', crew.emailSecondary] : null,
              address ? ['Address', address] : null,
            ].filter((r): r is [string, string] => r !== null)}
          />
        </>
      )}

      {/* Emergency Contact — what a crew tracker actually needs when something
          goes wrong on the road. Split name / relationship / phone into their
          own rows so the phone number is easy to pick out. */}
      {(crew.emergencyName || crew.emergencyPhone) && (
        <>
          <SectionHeader title="Emergency Contact" />
          <BioGrid
            rows={[
              crew.emergencyName ? ['Name', crew.emergencyName] : null,
              crew.emergencyRelationship ? ['Relationship', crew.emergencyRelationship] : null,
              crew.emergencyPhone ? ['Phone', crew.emergencyPhone] : null,
            ].filter((r): r is [string, string] => r !== null)}
          />
        </>
      )}

      {/* Flags — only rendered if at least one boolean flag is set. */}
      {flags.length > 0 && (
        <>
          <SectionHeader title="Flags" />
          <div className="flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <span
                key={f.label}
                className="inline-flex items-center h-[22px] px-2 rounded-md text-[12px] font-semibold"
                style={
                  f.tone === 'warn'
                    ? { background: 'rgba(255,136,0,0.14)', color: '#FF8800', border: '1px solid rgba(255,136,0,0.35)' }
                    : f.tone === 'info'
                      ? { background: 'rgba(0,99,247,0.14)', color: '#0063F7', border: '1px solid rgba(0,99,247,0.35)' }
                      : {
                          background: 'rgba(143,144,166,0.14)',
                          color: '#8F90A6',
                          border: '1px solid rgba(143,144,166,0.35)',
                        }
                }
              >
                {f.label}
              </span>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Memos" />
      <CrewScheduleMemoPanel
        scope="crew"
        targetId={crew._id}
        onAfterMutate={() => {
          void reconcilePeriod()
        }}
      />
    </div>
  )
}

/** Two-column label/value grid. Label is small uppercase tertiary, value is
 *  right-aligned primary. Truncates long values so the panel never overflows. */
function BioGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="rounded-lg border border-hz-border/20 bg-hz-border/[0.04] overflow-hidden divide-y divide-hz-border/15">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-hz-text-tertiary shrink-0">{k}</span>
          <span className="text-[13px] font-medium text-hz-text text-right truncate">{v}</span>
        </div>
      ))}
    </div>
  )
}

/** Inline chip row: `LABEL  [A320] [A321]` — used for A/C types and languages. */
function ChipRow({ label, items, tone }: { label: string; items: string[]; tone: 'accent' | 'muted' }) {
  const isAccent = tone === 'accent'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] uppercase tracking-wider text-hz-text-tertiary w-[78px] shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center h-[20px] px-1.5 rounded text-[12px] font-semibold tabular-nums"
            style={
              isAccent
                ? {
                    background: 'color-mix(in srgb, var(--module-accent) 18%, transparent)',
                    color: 'var(--module-accent)',
                    border: '1px solid color-mix(in srgb, var(--module-accent) 35%, transparent)',
                  }
                : {
                    background: 'rgba(143,144,166,0.12)',
                    color: 'var(--hz-text-secondary, #8F90A6)',
                    border: '1px solid rgba(143,144,166,0.28)',
                  }
            }
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

function ExpiryTab({ crew }: { crew: CrewMemberListItemRef | null }) {
  const periodFromIso = useCrewScheduleStore((s) => s.periodFromIso)
  const periodToIso = useCrewScheduleStore((s) => s.periodToIso)
  const fmtDate = useDateFormat()
  const [expiries, setExpiries] = useState<CrewExpiryDateFullRef[] | null>(null)

  // Fetch the full profile for the selected crew. Expiry rows live in a
  // separate collection joined with their 5.4.4 code metadata server-side —
  // same endpoint the Crew Profile page uses, so codes always stay in sync.
  useEffect(() => {
    if (!crew) {
      setExpiries(null)
      return
    }
    let cancelled = false
    void api
      .getCrewById(crew._id)
      .then((full) => {
        if (!cancelled) setExpiries(full.expiryDates)
      })
      .catch((e) => {
        console.error('[ExpiryTab] getCrewById failed:', e)
        if (!cancelled) setExpiries([])
      })
    return () => {
      cancelled = true
    }
  }, [crew])

  if (!crew) return <div className="p-4 text-[13px] text-hz-text-tertiary">No crew selected.</div>

  // Bucket expiries relative to the current planning period. "Expired" =
  // fell out of validity strictly before the period started. "Expiring in
  // period" = falls due inside the [from, to] window. Everything else is
  // either valid beyond the period (hidden — no action needed) or has no
  // expiryDate on file.
  const fromMs = new Date(periodFromIso + 'T00:00:00Z').getTime()
  const toMs = new Date(periodToIso + 'T23:59:59Z').getTime()
  const expired: CrewExpiryDateFullRef[] = []
  const expiring: CrewExpiryDateFullRef[] = []
  for (const e of expiries ?? []) {
    if (!e.expiryDate) continue
    const ms = new Date(e.expiryDate + 'T00:00:00Z').getTime()
    if (ms < fromMs) expired.push(e)
    else if (ms <= toMs) expiring.push(e)
  }
  expired.sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1))
  expiring.sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1))

  const totalAlerts = expired.length + expiring.length

  return (
    <div className="p-4 space-y-3">
      <SectionHeader title="Expiries" />

      {expiries === null ? (
        <div className="text-[13px] text-hz-text-tertiary">Loading…</div>
      ) : totalAlerts === 0 ? (
        <div className="text-[13px] text-hz-text-tertiary">
          No expiries in this planning period ({fmtDate(periodFromIso)} → {fmtDate(periodToIso)}).
        </div>
      ) : (
        <>
          {expired.length > 0 && (
            <ExpiryGroup title={`Expired · ${expired.length}`} tone="expired">
              {expired.map((e) => (
                <ExpiryRow key={e._id} row={e} tone="expired" fmtDate={fmtDate} />
              ))}
            </ExpiryGroup>
          )}
          {expiring.length > 0 && (
            <ExpiryGroup title={`Expiring in period · ${expiring.length}`} tone="warn">
              {expiring.map((e) => (
                <ExpiryRow key={e._id} row={e} tone="warn" fmtDate={fmtDate} />
              ))}
            </ExpiryGroup>
          )}
        </>
      )}

      <a
        href={`/crew-ops/control/crew-profile?id=${encodeURIComponent(crew._id)}`}
        className="inline-flex items-center gap-1 text-[13px] font-medium"
        style={{ color: 'var(--module-accent)' }}
      >
        Open full profile <ChevronRight className="w-4 h-4" />
      </a>
    </div>
  )
}

/** Faint-tinted group container. `expired` = soft red, `warn` = soft yellow.
 *  The alpha is kept low (<= 0.12) so multiple groups stacked vertically stay
 *  readable against the inspector's dark glass background. */
function ExpiryGroup({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'expired' | 'warn'
  children: React.ReactNode
}) {
  const bg = tone === 'expired' ? 'rgba(230,53,53,0.08)' : 'rgba(255,204,0,0.08)'
  const border = tone === 'expired' ? 'rgba(230,53,53,0.28)' : 'rgba(255,204,0,0.30)'
  const labelColor = tone === 'expired' ? '#FF6969' : '#FDDD48'
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
      <div
        className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: labelColor, borderBottom: `1px solid ${border}` }}
      >
        {title}
      </div>
      <div className="divide-y" style={{ borderColor: border }}>
        {children}
      </div>
    </div>
  )
}

/** Single expiry row — code label left, date right, relative days below. */
function ExpiryRow({
  row,
  tone,
  fmtDate,
}: {
  row: CrewExpiryDateFullRef
  tone: 'expired' | 'warn'
  fmtDate: (iso: string | null | undefined) => string
}) {
  const dateColor = tone === 'expired' ? '#FF6969' : '#FDDD48'
  return (
    <div className="px-3 py-2 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-hz-text truncate">{row.codeLabel}</span>
          {row.aircraftType && row.aircraftType !== '*' && (
            <span className="text-[11px] tabular-nums text-hz-text-tertiary">· {row.aircraftType}</span>
          )}
        </div>
        <div className="text-[11px] text-hz-text-tertiary truncate">{row.codeName}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold tabular-nums" style={{ color: dateColor }}>
          {fmtDate(row.expiryDate)}
        </div>
      </div>
    </div>
  )
}
