'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  api,
  type CrewLegalityIssueRef,
  type LegalityOverrideRowRef,
  type PairingRef,
  type CrewAssignmentRef,
  type CrewMemberListItemRef,
} from '@skyhub/api'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, X, XCircle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useDateFormat } from '@/hooks/use-date-format'

/**
 * 4.1.6 Legality Check dialog — preview of what the future 4.3.1
 * Schedule Legality Check report will show. Scope-aware:
 *
 *   • `all`         — whole period, every crew (toolbar button)
 *   • `assignment`  — one pairing, one crew (pairing right-click)
 *   • `crew`        — one crew across period (crew-name right-click)
 *   • `date`        — one day, every filtered crew (date-header right-click)
 *   • `block`       — one crew across a date range (block right-click)
 *
 * Two sources feed the list:
 *   1. Planner-acknowledged overrides (server-side audit rows)
 *   2. Assigned pairings with non-legal `fdtlStatus` (local derivation)
 *
 * Empty state: "No violation found".
 */
export type LegalityCheckScope =
  | { kind: 'all' }
  | { kind: 'assignment'; pairingId: string; crewId: string | null }
  | { kind: 'crew'; crewId: string }
  | { kind: 'date'; dateIso: string }
  | { kind: 'block'; crewIds: string[]; fromIso: string; toIso: string }

interface Props {
  scope: LegalityCheckScope | null
  periodFromIso: string
  periodToIso: string
  pairings: PairingRef[]
  assignments: CrewAssignmentRef[]
  crew: CrewMemberListItemRef[]
  onClose: () => void
  onJumpToPairing?: (pairingId: string, crewId?: string) => void
}

type IssueRow = {
  source: 'override' | 'fdtl'
  severity: 'warning' | 'violation'
  kind: string
  title: string
  message: string
  crewLabel: string | null
  employeeId: string | null
  pairingId: string
  pairingCode: string
  crewId: string | null
  at: string | null
  /** Rolling-window descriptor (e.g. "28D · 2026-03-15 → 2026-04-11") for
   *  window-scoped rules. Rendered as a second line in the row. */
  windowRange: string | null
}

export function LegalityCheckDialog({
  scope,
  periodFromIso,
  periodToIso,
  pairings,
  assignments,
  crew,
  onClose,
  onJumpToPairing,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const open = !!scope
  const crewIssues = useCrewScheduleStore((s) => s.crewIssues)
  const fmtDate = useDateFormat()

  const {
    data: overrideRes,
    isLoading,
    isError,
  } = useQuery<{ rows: LegalityOverrideRowRef[] }>({
    queryKey: ['crew-schedule', 'legality-overrides', periodFromIso, periodToIso],
    queryFn: () => api.getLegalityOverrides({ from: periodFromIso, to: periodToIso }),
    enabled: open,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { issues, subtitle } = useMemo(() => {
    if (!scope) return { issues: [] as IssueRow[], subtitle: '' }

    // Build the full unfiltered row list first.
    const raw: IssueRow[] = []
    for (const o of overrideRes?.rows ?? []) {
      raw.push({
        source: 'override',
        severity: 'warning',
        kind: o.violationKind,
        title: titleForKind(o.violationKind),
        message: o.messageSnapshot ?? labelForKind(o.violationKind),
        crewLabel: o.crewName,
        employeeId: o.employeeId,
        pairingId: o.pairingId,
        pairingCode: o.pairingCode ?? o.pairingId.slice(0, 6),
        crewId: o.crewId,
        at: o.overriddenAtUtc,
        windowRange: null,
      })
    }
    // Roster-level FDTL issues (pre-FDP rest, cumulative, augmented) from
    // the server `evaluateCrewRoster` pass.
    const crewById = new Map(crew.map((c) => [c._id, c]))
    const assignPairingByAssignment = new Map(assignments.map((a) => [a._id, a]))
    for (const i of crewIssues) {
      const c = crewById.get(i.crewId)
      const firstAid = i.assignmentIds[0]
      const linked = firstAid ? assignPairingByAssignment.get(firstAid) : null
      const linkedPairingId = linked?.pairingId ?? ''
      const pairingCode = linkedPairingId
        ? (pairings.find((p) => p._id === linkedPairingId)?.pairingCode ?? linkedPairingId.slice(0, 6))
        : 'roster'
      raw.push({
        source: 'fdtl',
        severity: i.status,
        kind: i.ruleCode,
        title: i.label,
        message: `${i.shortReason}${i.legalReference ? ` — ${i.legalReference}` : ''}`,
        crewLabel: c ? `${c.lastName} ${c.firstName}` : null,
        employeeId: c?.employeeId ?? null,
        pairingId: linkedPairingId,
        pairingCode,
        crewId: i.crewId,
        at: i.detectedAtUtc,
        windowRange: formatWindowRange(i.windowLabel, i.windowFromIso, i.windowToIso, i.anchorUtc, i.ruleCode, fmtDate),
      })
    }
    const assignedPairingIds = new Set(assignments.filter((a) => a.status !== 'cancelled').map((a) => a.pairingId))
    const pairingById = new Map(pairings.map((p) => [p._id, p]))
    for (const p of pairings) {
      if (!assignedPairingIds.has(p._id)) continue
      if (p.fdtlStatus === 'legal' || !p.fdtlStatus) continue
      raw.push({
        source: 'fdtl',
        severity: p.fdtlStatus === 'violation' ? 'violation' : 'warning',
        kind: p.fdtlStatus === 'violation' ? 'fdtl_violation' : 'fdtl_warning',
        title: p.fdtlStatus === 'violation' ? 'FDTL violation' : 'FDTL warning',
        message: `Pairing ${p.pairingCode} has an FDTL ${p.fdtlStatus}.`,
        crewLabel: null,
        employeeId: null,
        pairingId: p._id,
        pairingCode: p.pairingCode,
        crewId: null,
        at: null,
        windowRange: null,
      })
    }

    // Scope filter.
    let filtered = raw
    let subtitle = `Period ${periodFromIso} → ${periodToIso}`

    if (scope.kind === 'assignment') {
      const p = pairingById.get(scope.pairingId)
      filtered = raw.filter(
        (r) =>
          r.pairingId === scope.pairingId && (scope.crewId == null || r.crewId == null || r.crewId === scope.crewId),
      )
      subtitle = `Pairing ${p?.pairingCode ?? scope.pairingId.slice(0, 6)}`
      if (scope.crewId) {
        const c = crew.find((x) => x._id === scope.crewId)
        if (c) subtitle += ` · ${c.lastName} ${c.firstName}`
      }
    } else if (scope.kind === 'crew') {
      // Crew's own pairings (by assignments) — include override rows and
      // fdtl rows whose pairing the crew is on.
      const crewPairingIds = new Set(
        assignments.filter((a) => a.crewId === scope.crewId && a.status !== 'cancelled').map((a) => a.pairingId),
      )
      filtered = raw.filter((r) => (r.crewId ? r.crewId === scope.crewId : crewPairingIds.has(r.pairingId)))
      const c = crew.find((x) => x._id === scope.crewId)
      subtitle = c ? `${c.lastName} ${c.firstName} (${c.employeeId})` : 'Crew'
      subtitle += ` · period ${periodFromIso} → ${periodToIso}`
    } else if (scope.kind === 'date') {
      // Pairings active on this date — overlap test on assignment windows.
      const dayStartMs = new Date(scope.dateIso + 'T00:00:00Z').getTime()
      const dayEndMs = dayStartMs + 86_400_000
      const onDatePairingIds = new Set<string>()
      for (const a of assignments) {
        if (a.status === 'cancelled') continue
        const aStart = new Date(a.startUtcIso).getTime()
        const aEnd = new Date(a.endUtcIso).getTime()
        if (aEnd > dayStartMs && aStart < dayEndMs) onDatePairingIds.add(a.pairingId)
      }
      filtered = raw.filter((r) => onDatePairingIds.has(r.pairingId))
      subtitle = `Date ${scope.dateIso}`
    } else if (scope.kind === 'block') {
      const fromMs = new Date(scope.fromIso + 'T00:00:00Z').getTime()
      const toMs = new Date(scope.toIso + 'T00:00:00Z').getTime() + 86_400_000
      const crewIdSet = new Set(scope.crewIds)
      const blockPairingIds = new Set<string>()
      for (const a of assignments) {
        if (a.status === 'cancelled') continue
        if (!crewIdSet.has(a.crewId)) continue
        const aStart = new Date(a.startUtcIso).getTime()
        const aEnd = new Date(a.endUtcIso).getTime()
        if (aEnd > fromMs && aStart < toMs) blockPairingIds.add(a.pairingId)
      }
      filtered = raw.filter((r) => (r.crewId == null || crewIdSet.has(r.crewId)) && blockPairingIds.has(r.pairingId))
      const crewSubtitle =
        scope.crewIds.length === 1
          ? (() => {
              const c = crew.find((x) => x._id === scope.crewIds[0])
              return c ? `${c.lastName} ${c.firstName}` : 'Crew'
            })()
          : `${scope.crewIds.length} crew`
      subtitle = `${crewSubtitle} · ${scope.fromIso} → ${scope.toIso}`
    }

    // Drop warnings entirely — they clutter the list when the duty is
    // still legal overall. Only show violations + override audit rows.
    filtered = filtered.filter((r) => r.source === 'override' || r.severity === 'violation')

    // Sort by pairing code (all remaining rows are violations or
    // overrides of equal urgency).
    filtered = [...filtered].sort((a, b) => a.pairingCode.localeCompare(b.pairingCode))

    return { issues: filtered, subtitle }
  }, [scope, overrideRes, crewIssues, pairings, assignments, crew, periodFromIso, periodToIso])

  if (!open) return null

  const violations = issues.filter((i) => i.severity === 'violation').length

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden w-full max-w-2xl shadow-xl flex flex-col"
        style={{
          background: isDark ? '#191921' : '#FFFFFF',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3 shrink-0"
          style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
        >
          <div
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--module-accent-tint, rgba(124,58,237,0.15))' }}
          >
            <ShieldAlert size={18} color="var(--module-accent, #7c3aed)" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
              Legality Check
            </div>
            <div className="text-[13px] mt-0.5 truncate" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
              {subtitle}
              {' · '}
              {issues.length === 0 ? 'No issues' : `${violations} violation${violations === 1 ? '' : 's'}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && (
            <div
              className="flex items-center justify-center gap-2 py-16 text-[13px]"
              style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}
            >
              <Loader2 size={16} className="animate-spin" />
              Checking…
            </div>
          )}
          {isError && !isLoading && (
            <div className="py-16 text-center text-[13px]" style={{ color: '#FF3B3B' }}>
              Could not load overrides. FDTL warnings below may still be accurate.
            </div>
          )}
          {!isLoading && issues.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-16 px-6 gap-3 text-center"
              style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(6,194,112,0.15)' }}
              >
                <CheckCircle2 size={26} color="#06C270" />
              </div>
              <div className="text-[15px] font-semibold" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
                No violation found
              </div>
              <div className="text-[13px] max-w-sm">{emptyStateHint(scope)}</div>
            </div>
          )}
          {!isLoading && issues.length > 0 && (
            <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
              {issues.map((i, idx) => (
                <IssueRowView
                  key={`${i.source}:${i.pairingId}:${i.crewId ?? ''}:${idx}`}
                  row={i}
                  isDark={isDark}
                  onJump={onJumpToPairing}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function IssueRowView({
  row,
  isDark,
  onJump,
}: {
  row: IssueRow
  isDark: boolean
  onJump?: (pairingId: string, crewId?: string) => void
}) {
  const color = row.severity === 'violation' ? '#FF3B3B' : '#FF8800'
  const Icon = row.severity === 'violation' ? XCircle : AlertTriangle
  return (
    <button
      type="button"
      onClick={() => onJump?.(row.pairingId, row.crewId ?? undefined)}
      className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
    >
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: row.severity === 'violation' ? 'rgba(255,59,59,0.12)' : 'rgba(255,136,0,0.12)' }}
      >
        <Icon size={16} color={color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold" style={{ color: isDark ? '#FFFFFF' : '#0E0E14' }}>
            {row.title}
          </span>
          <span
            className="text-[13px] font-mono px-1.5 rounded"
            style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              color: isDark ? '#A7A9B5' : '#6B6C7B',
            }}
          >
            {row.pairingCode}
          </span>
          {row.crewLabel && (
            <span className="text-[13px]" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
              · {row.crewLabel} {row.employeeId ? `(${row.employeeId})` : ''}
            </span>
          )}
        </div>
        <div className="text-[13px] mt-1 leading-relaxed" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
          {row.message}
        </div>
        {row.windowRange && (
          <div className="text-[13px] mt-1 leading-relaxed" style={{ color: isDark ? '#C7C9D3' : '#555770' }}>
            {row.windowRange.replace(/^\d+[DHMY]\s*·\s*/, '')}
          </div>
        )}
      </div>
    </button>
  )
}

function formatWindowRange(
  label: string | null,
  fromIso: string | null,
  toIso: string | null,
  anchorUtc: string,
  ruleCode: string | null,
  fmtDate: (iso: string | null | undefined) => string,
): string | null {
  // Preferred: evaluator-provided window bounds (new issues).
  if (fromIso && toIso) {
    const prefix = label ? `${label} · ` : ''
    return `${prefix}${fmtDate(fromIso)} → ${fmtDate(toIso)}`
  }
  // Fallback for pre-fix DB rows: derive from rule code suffix + anchor.
  const derived = deriveWindowFromCode(ruleCode, anchorUtc)
  if (!derived) return null
  return `${derived.label} · ${fmtDate(derived.fromIso)} → ${fmtDate(derived.toIso)}`
}

function deriveWindowFromCode(
  ruleCode: string | null,
  anchorUtc: string,
): { label: string; fromIso: string; toIso: string } | null {
  if (!ruleCode) return null
  const m = ruleCode.match(/_(\d+)([DHMY])$/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  const unit = m[2].toUpperCase()
  const windowMs =
    unit === 'H'
      ? n * 3_600_000
      : unit === 'D'
        ? n * 86_400_000
        : unit === 'M'
          ? n * 30 * 86_400_000
          : n * 365 * 86_400_000
  const anchorMs = new Date(anchorUtc).getTime()
  if (!Number.isFinite(anchorMs)) return null
  const fromMs = anchorMs - windowMs
  return {
    label: `${n}${unit}`,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(anchorMs).toISOString(),
  }
}

function titleForKind(kind: string): string {
  switch (kind) {
    case 'base_mismatch':
      return 'Invalid Duty Assignment due to Base Mismatch'
    case 'fdp_exceeded':
      return 'Flight Duty Period exceeded'
    case 'rest_short':
      return 'Minimum rest not met'
    case 'rank_mismatch':
      return 'Rank mismatch'
    default:
      return 'Rule violation'
  }
}

function labelForKind(kind: string): string {
  return `Override acknowledged for ${kind.replace(/_/g, ' ')}.`
}

function emptyStateHint(scope: LegalityCheckScope | null): string {
  if (!scope) return ''
  switch (scope.kind) {
    case 'all':
      return 'Every assigned pairing in this period passes the legality engine and has no acknowledged planner overrides.'
    case 'assignment':
      return 'This pairing passes the legality engine for the assigned crew.'
    case 'crew':
      return 'This crew member has no legality issues across the open period.'
    case 'date':
      return 'No legality issues on this date for the currently filtered crew.'
    case 'block':
      return 'No legality issues in this range for this crew.'
  }
}
