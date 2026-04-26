'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Hourglass, AlertTriangle, XCircle, Plane, Clock, Bus, RotateCcw } from 'lucide-react'
import type { CheckInCrewRow } from '@/lib/crew-checkin/derive-duties'
import { computeCheckInStatus, statusVisuals } from '@/lib/crew-checkin/check-in-status'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { useCheckInConfigStore } from '@/stores/use-check-in-config-store'

const ICONS = {
  CheckCircle2,
  Hourglass,
  AlertTriangle,
  XCircle,
  Plane,
  Clock,
}

interface Props {
  rows: CheckInCrewRow[]
  pairingId: string | null
}

/** 4.1.7.1 right pane — crew list for the selected duty. */
export function CheckInCrewList({ rows, pairingId }: Props) {
  const checkIn = useCrewCheckInStore((s) => s.checkIn)
  const undoCheckIn = useCrewCheckInStore((s) => s.undoCheckIn)
  const checkInAll = useCrewCheckInStore((s) => s.checkInAllForPairing)

  const [busy, setBusy] = useState<string | null>(null)
  const [busyAll, setBusyAll] = useState(false)

  // Tick to re-render late states.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!pairingId) {
    return (
      <div className="flex-1 flex flex-col">
        <Header title="Crew List" />
        <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-tertiary px-6 text-center">
          Select a duty on the left to view its crew and check them in
        </div>
      </div>
    )
  }

  const pendingCount = rows.filter((r) => r.checkInUtcMs == null).length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Crew List" subtitle={`${rows.length} crew · ${pendingCount} pending`} />

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[13px] text-hz-text-tertiary">
            No crew assigned
          </div>
        ) : (
          rows.map((r) => (
            <CrewRow
              key={r.assignmentId}
              row={r}
              busy={busy === r.assignmentId}
              onCheckIn={async () => {
                setBusy(r.assignmentId)
                try {
                  await checkIn(r.assignmentId)
                } finally {
                  setBusy(null)
                }
              }}
              onUndo={async () => {
                setBusy(r.assignmentId)
                try {
                  await undoCheckIn(r.assignmentId)
                } finally {
                  setBusy(null)
                }
              }}
            />
          ))
        )}
      </div>

      {pendingCount > 0 && (
        <div className="border-t border-hz-border p-3">
          <button
            type="button"
            disabled={busyAll}
            onClick={async () => {
              setBusyAll(true)
              try {
                await checkInAll(pairingId)
              } finally {
                setBusyAll(false)
              }
            }}
            className="w-full h-10 rounded-lg text-[14px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#06C270' }}
          >
            {busyAll ? 'Checking in…' : `Check-In All Pending (${pendingCount})`}
          </button>
        </div>
      )}
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="h-9 px-3 flex items-center gap-3 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary border-b border-hz-border">
      <span className="w-1 h-4 rounded-full" style={{ background: 'var(--module-accent, #1e40af)' }} />
      <span>{title}</span>
      {subtitle && <span className="text-hz-text-tertiary font-medium normal-case tracking-normal">{subtitle}</span>}
    </div>
  )
}

function CrewRow({
  row,
  busy,
  onCheckIn,
  onUndo,
}: {
  row: CheckInCrewRow
  busy: boolean
  onCheckIn: () => void
  onUndo: () => void
}) {
  const config = useCheckInConfigStore((s) => s.config)
  const status = computeCheckInStatus({
    rrtMs: row.rrtMs,
    stdMs: row.stdMs,
    checkInUtcMs: row.checkInUtcMs,
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
  const checkedIn = row.checkInUtcMs != null

  return (
    <div className="px-3 py-2.5 flex items-center gap-2 border-b border-hz-border hover:bg-hz-background-hover transition-colors">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
        style={{ background: 'rgba(62,123,250,0.15)', color: 'var(--module-accent, #1e40af)' }}
      >
        {row.fullName.split(',')[0].trim().slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-bold uppercase tracking-wider" style={{ color: 'var(--module-accent, #1e40af)' }}>
            {row.positionCode}
          </span>
          <span className="font-mono text-hz-text-tertiary text-[13px]">{row.crewIdNumber}</span>
          {row.isDeadhead && (
            <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded text-[13px] font-semibold bg-hz-background-hover text-hz-text-secondary">
              <Bus size={11} /> DH
            </span>
          )}
        </div>
        <div className="text-[13px] font-medium truncate">{row.fullName}</div>
        <div className="flex items-center gap-2 text-[13px] text-hz-text-tertiary mt-0.5">
          <span>RRT {fmtTime(row.rrtMs)} UTC</span>
          {checkedIn && (
            <>
              <span>·</span>
              <span style={{ color: v.color }}>Reported {fmtTime(row.checkInUtcMs)} UTC</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="inline-flex items-center gap-1 px-2 h-6 rounded-full text-[13px] font-semibold"
          style={{ color: v.color, background: v.bg }}
        >
          <Icon size={12} />
          {v.label}
        </span>

        {checkedIn ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            className="h-8 px-3 rounded-lg text-[13px] font-semibold bg-transparent disabled:opacity-50 inline-flex items-center gap-1 transition-colors"
            style={{ border: '1px solid var(--module-accent, #1e40af)', color: 'var(--module-accent, #1e40af)' }}
          >
            <RotateCcw size={12} />
            Undo
          </button>
        ) : (
          <button
            type="button"
            onClick={onCheckIn}
            disabled={busy}
            className="h-8 px-3 rounded-lg text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#06C270' }}
          >
            Check-In
          </button>
        )}
      </div>
    </div>
  )
}

function fmtTime(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
