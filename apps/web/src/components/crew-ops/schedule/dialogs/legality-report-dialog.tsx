'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Scale, X, XCircle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { useDateFormat } from '@/hooks/use-date-format'

/**
 * Reusable legality report. Opened from:
 *   - Date-header §4.4 "Show legality for all crew (L)" — scope by date.
 *   - Block §4.6 "Show legality" — scope by crew + date range.
 *
 * Lists every pairing in scope whose fdtlStatus is 'warning' or
 * 'violation', grouped by severity. Click-through selects the pairing
 * and closes the dialog.
 */
export function LegalityReportDialog() {
  const dialog = useCrewScheduleStore((s) => s.legalityReportDialog)
  const close = useCrewScheduleStore((s) => s.closeLegalityReportDialog)
  const assignments = useCrewScheduleStore((s) => s.assignments)
  const pairings = useCrewScheduleStore((s) => s.pairings)
  const crew = useCrewScheduleStore((s) => s.crew)
  const excludedCrewIds = useCrewScheduleStore((s) => s.excludedCrewIds)
  const selectPairing = useCrewScheduleStore((s) => s.selectPairing)
  const selectAssignment = useCrewScheduleStore((s) => s.selectAssignment)
  const selectCrew = useCrewScheduleStore((s) => s.selectCrew)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const fmtDate = useDateFormat()

  const rows = useMemo(() => {
    if (!dialog) return { warnings: [], violations: [] }
    const pairingsById = new Map(pairings.map((p) => [p._id, p]))
    const crewById = new Map(crew.map((c) => [c._id, c]))

    let fromMs: number
    let toMs: number
    let crewFilter: Set<string> | null
    if (dialog.scope === 'date-all-crew') {
      fromMs = new Date(dialog.dateIso + 'T00:00:00Z').getTime()
      toMs = fromMs + 86_400_000
      crewFilter = new Set(crew.filter((c) => !excludedCrewIds.has(c._id)).map((c) => c._id))
    } else {
      fromMs = new Date(dialog.fromIso + 'T00:00:00Z').getTime()
      toMs = new Date(dialog.toIso + 'T00:00:00Z').getTime() + 86_400_000
      crewFilter = new Set(dialog.crewIds)
    }

    const warnings: Row[] = []
    const violations: Row[] = []
    for (const a of assignments) {
      if (crewFilter && !crewFilter.has(a.crewId)) continue
      if (a.status === 'cancelled') continue
      const start = new Date(a.startUtcIso).getTime()
      const end = new Date(a.endUtcIso).getTime()
      if (end <= fromMs || start >= toMs) continue
      const pairing = pairingsById.get(a.pairingId)
      if (!pairing) continue
      if (pairing.fdtlStatus !== 'warning' && pairing.fdtlStatus !== 'violation') continue
      const member = crewById.get(a.crewId)
      const row: Row = {
        assignmentId: a._id,
        pairingId: pairing._id,
        crewId: a.crewId,
        crewName: member ? `${member.lastName} ${member.firstName}` : '(missing)',
        pairingCode: pairing.pairingCode,
        summary: summariseLegality(pairing.fdtlStatus, pairing.lastLegalityResult),
      }
      if (pairing.fdtlStatus === 'violation') violations.push(row)
      else warnings.push(row)
    }
    return { warnings, violations }
  }, [dialog, assignments, pairings, crew, excludedCrewIds])

  if (!dialog) return null

  const empty = rows.warnings.length === 0 && rows.violations.length === 0
  const title =
    dialog.scope === 'date-all-crew'
      ? `Legality · ${fmtDate(dialog.dateIso)}`
      : `Legality · ${fmtDate(dialog.fromIso)} → ${fmtDate(dialog.toIso)}`

  const onRowClick = (row: Row) => {
    selectPairing(row.pairingId)
    selectAssignment(row.assignmentId)
    selectCrew(row.crewId)
    close()
  }

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl overflow-hidden w-[600px] max-w-[92vw] flex flex-col"
        style={{
          height: 500,
          maxHeight: '85vh',
          background: isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,1)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(96,97,112,0.18)',
          color: isDark ? '#FFFFFF' : '#0E0E14',
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Scale className="w-4 h-4 shrink-0" style={{ color: 'var(--module-accent)' }} />
            <h3 className="text-[15px] font-bold truncate">{title}</h3>
          </div>
          <button onClick={close} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-2 pb-3">
          {empty && (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8" style={{ color: '#06C270' }} />
              <div className="text-[13px] font-medium">No legality issues</div>
            </div>
          )}
          {rows.violations.length > 0 && (
            <Section label={`Violations (${rows.violations.length})`} color="#E63535" Icon={XCircle} isDark={isDark}>
              {rows.violations.map((row) => (
                <LegalityRow
                  key={row.assignmentId}
                  row={row}
                  color="#E63535"
                  onClick={() => onRowClick(row)}
                  isDark={isDark}
                />
              ))}
            </Section>
          )}
          {rows.warnings.length > 0 && (
            <Section label={`Warnings (${rows.warnings.length})`} color="#FF8800" Icon={AlertTriangle} isDark={isDark}>
              {rows.warnings.map((row) => (
                <LegalityRow
                  key={row.assignmentId}
                  row={row}
                  color="#FF8800"
                  onClick={() => onRowClick(row)}
                  isDark={isDark}
                />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

interface Row {
  assignmentId: string
  pairingId: string
  crewId: string
  crewName: string
  pairingCode: string
  summary: string
}

function Section({
  label,
  color,
  Icon,
  isDark,
  children,
}: {
  label: string
  color: string
  Icon: typeof AlertTriangle
  isDark: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div
        className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div
        className="rounded-lg mx-1 overflow-hidden"
        style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}
      >
        {children}
      </div>
    </div>
  )
}

function LegalityRow({
  row,
  color,
  onClick,
  isDark,
}: {
  row: Row
  color: string
  onClick: () => void
  isDark: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5"
      style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate">
          {row.crewName} <span className="text-hz-text-tertiary font-medium">· {row.pairingCode}</span>
        </div>
        <div className="text-[13px] truncate" style={{ color: isDark ? '#A7A9B5' : '#6B6C7B' }}>
          {row.summary}
        </div>
      </div>
    </button>
  )
}

/** Best-effort string from the stored legalityResult JSON. Falls back
 *  to "warning"/"violation" when no detail is present. */
function summariseLegality(status: 'warning' | 'violation', raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const r = raw as {
      reason?: string
      detail?: string
      message?: string
      violations?: Array<{ message?: string; rule?: string }>
    }
    if (Array.isArray(r.violations) && r.violations.length > 0) {
      return r.violations
        .map((v) => v.message ?? v.rule ?? '')
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ')
    }
    if (typeof r.reason === 'string') return r.reason
    if (typeof r.detail === 'string') return r.detail
    if (typeof r.message === 'string') return r.message
  }
  return status === 'violation' ? 'FDTL violation' : 'FDTL warning'
}
