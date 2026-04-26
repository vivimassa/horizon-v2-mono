'use client'

import { useMemo } from 'react'
import { Plane, Hourglass, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { CheckInDutyRow } from '@/lib/crew-checkin/derive-duties'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'

interface Props {
  duties: CheckInDutyRow[]
  selectedPairingId: string | null
  onSelect: (id: string) => void
}

const COLS = [
  { key: 'pairing', label: 'Pairing #', width: 90 },
  { key: 'std', label: 'STD', width: 60 },
  { key: 'rrt', label: 'Report', width: 60 },
  { key: 'dep', label: 'Dep', width: 50 },
  { key: 'arr', label: 'Arr', width: 50 },
  { key: 'ac', label: 'A/C', width: 60 },
  { key: 'reg', label: 'Reg', width: 70 },
  { key: 'crew', label: 'Crew', width: 70 },
  { key: 'status', label: 'Status', width: 0 }, // flex
] as const

/**
 * 4.1.7.1 left pane — duties grid. One row per pairing, sorted by STD.
 * Row tinting:
 *   • all crew checked-in → green tint
 *   • very-late present   → red tint
 *   • departed (no all)   → muted
 */
export function CheckInDutiesGrid({ duties, selectedPairingId, onSelect }: Props) {
  const rowHeight = useCrewCheckInStore((s) => s.rowHeight)
  const groupBy = useCrewCheckInStore((s) => s.groupBy)
  const commPanelMode = useCrewCheckInStore((s) => s.commPanelMode)
  const compact = commPanelMode !== null

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', label: '', rows: duties }]
    const buckets = new Map<string, CheckInDutyRow[]>()
    for (const d of duties) {
      const key =
        groupBy === 'base'
          ? d.baseAirport || '—'
          : groupBy === 'acType'
            ? d.aircraftTypeIcao || '—'
            : groupKeyForStatus(d)
      const arr = buckets.get(key)
      if (arr) arr.push(d)
      else buckets.set(key, [d])
    }
    return Array.from(buckets.entries())
      .sort((a, b) => statusGroupOrder(a[0]) - statusGroupOrder(b[0]) || a[0].localeCompare(b[0]))
      .map(([key, rows]) => ({ key, label: key, rows }))
  }, [duties, groupBy])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-9 px-3 flex items-center gap-3 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary border-b border-hz-border">
        <span className="w-1 h-4 rounded-full" style={{ background: 'var(--module-accent, #1e40af)' }} />
        <span>Flights & Ground Duties</span>
        <span className="text-hz-text-tertiary font-medium normal-case tracking-normal">{duties.length} duties</span>
      </div>

      <div className="px-3 py-1.5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary border-b border-hz-border">
        {COLS.map((c) => (
          <div key={c.key} style={c.width ? { width: c.width } : { flex: 1 }}>
            {c.label}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {duties.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[13px] text-hz-text-tertiary">
            No duties match the current filters
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.key || 'all'}>
              {g.label && (
                <div
                  className="sticky top-0 z-10 px-3 h-7 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider"
                  style={{
                    background: 'var(--hz-background-secondary, rgba(125,125,140,0.10))',
                    color: 'var(--module-accent, #1e40af)',
                    borderBottom: '1px solid var(--hz-border, rgba(125,125,140,0.2))',
                  }}
                >
                  <span className="w-1 h-3 rounded-full" style={{ background: 'var(--module-accent, #1e40af)' }} />
                  {g.label}
                  <span className="text-hz-text-tertiary font-medium normal-case tracking-normal">{g.rows.length}</span>
                </div>
              )}
              {g.rows.map((d) => (
                <DutyRow
                  key={d.pairingId}
                  duty={d}
                  selected={d.pairingId === selectedPairingId}
                  onSelect={onSelect}
                  rowHeight={rowHeight}
                  compact={compact}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function DutyRow({
  duty,
  selected,
  onSelect,
  rowHeight,
  compact,
}: {
  duty: CheckInDutyRow
  selected: boolean
  onSelect: (id: string) => void
  rowHeight: number
  compact: boolean
}) {
  const tintBg = duty.allCheckedIn
    ? 'rgba(6,194,112,0.10)'
    : duty.hasVeryLate
      ? 'rgba(255,59,59,0.10)'
      : selected
        ? 'rgba(62,123,250,0.10)'
        : 'transparent'

  return (
    <button
      type="button"
      onClick={() => onSelect(duty.pairingId)}
      className="w-full text-left px-3 flex items-center gap-3 text-[13px] border-b border-hz-border hover:bg-hz-background-hover transition-colors relative"
      style={{ background: tintBg, height: rowHeight }}
    >
      {selected && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: 'var(--module-accent, #1e40af)' }}
          aria-hidden="true"
        />
      )}

      <div style={{ width: 90 }} className="font-mono font-semibold">
        {duty.pairingCode}
      </div>
      <div style={{ width: 60 }} className="font-mono text-hz-text-secondary">
        {fmtTime(duty.stdMs)}
      </div>
      <div style={{ width: 60 }} className="font-mono text-hz-text-secondary">
        {fmtTime(duty.rrtMs)}
      </div>
      <div style={{ width: 50 }} className="font-semibold uppercase">
        {duty.baseAirport}
      </div>
      <div style={{ width: 50 }} className="font-semibold uppercase text-hz-text-secondary">
        {duty.arrStation}
      </div>
      <div style={{ width: 60 }} className="text-hz-text-secondary">
        {duty.aircraftTypeIcao ?? '—'}
      </div>
      <div style={{ width: 70 }} className="text-hz-text-secondary font-mono">
        {duty.tailNumber ?? '—'}
      </div>
      <div style={{ width: 70 }} className="font-mono">
        <span style={{ color: duty.allCheckedIn ? '#06C270' : duty.hasVeryLate ? '#FF3B3B' : undefined }}>
          {duty.checkedInCount}/{duty.crewCount}
        </span>
      </div>
      <div className="flex-1 flex items-center gap-1.5">
        <DutyStatusPill duty={duty} compact={compact} />
        {!compact && duty.legCount > 1 && (
          <span className="text-[13px] text-hz-text-tertiary font-mono">{duty.legCount} sectors</span>
        )}
      </div>
    </button>
  )
}

function DutyStatusPill({ duty, compact }: { duty: CheckInDutyRow; compact: boolean }) {
  if (duty.allCheckedIn) {
    return (
      <Pill color="#06C270" bg="rgba(6,194,112,0.14)" tooltip="All Checked-In" compact={compact}>
        <CheckCircle2 size={12} />
        {!compact && 'All Checked-In'}
      </Pill>
    )
  }
  if (duty.hasVeryLate) {
    return (
      <Pill color="#FF3B3B" bg="rgba(255,59,59,0.14)" tooltip="Very Late" compact={compact}>
        <AlertTriangle size={12} />
        {!compact && 'Very Late'}
      </Pill>
    )
  }
  if (duty.departed) {
    return (
      <Pill color="#0063F7" bg="rgba(0,99,247,0.12)" tooltip="Departed" compact={compact}>
        <Plane size={12} />
        {!compact && 'Departed'}
      </Pill>
    )
  }
  return (
    <Pill color="#9A9BA8" bg="rgba(154,155,168,0.14)" tooltip="Pending" compact={compact}>
      <Hourglass size={12} />
      {!compact && 'Pending'}
    </Pill>
  )
}

function Pill({
  children,
  color,
  bg,
  tooltip,
  compact,
}: {
  children: React.ReactNode
  color: string
  bg: string
  tooltip?: string
  compact?: boolean
}) {
  return (
    <span
      className="inline-flex items-center justify-center gap-1 rounded-full text-[13px] font-semibold"
      style={{
        color,
        background: bg,
        height: 22,
        width: compact ? 22 : undefined,
        padding: compact ? 0 : '0 8px',
      }}
      title={tooltip}
    >
      {children}
    </span>
  )
}

function fmtTime(ms: number | null): string {
  if (ms == null) return '—'
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function groupKeyForStatus(d: CheckInDutyRow): string {
  if (d.hasVeryLate) return 'Very Late'
  if (d.allCheckedIn) return 'All Checked-In'
  if (d.departed) return 'Departed'
  return 'Pending'
}
function statusGroupOrder(label: string): number {
  switch (label) {
    case 'Very Late':
      return 0
    case 'Pending':
      return 1
    case 'All Checked-In':
      return 2
    case 'Departed':
      return 3
    default:
      return 9
  }
}
