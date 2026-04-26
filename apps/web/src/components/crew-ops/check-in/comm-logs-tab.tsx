'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquare, LogOut as LogOutIcon, AlertCircle } from 'lucide-react'
import {
  api,
  type CrewAssignmentRef,
  type CrewMemberListItemRef,
  type CrewMessageRef,
  type PairingRef,
} from '@skyhub/api'

interface Props {
  pairing: PairingRef
  assignments: CrewAssignmentRef[]
  crewById: Map<string, CrewMemberListItemRef>
}

type FilterMode = 'all' | 'comms' | 'checkIn'

interface LogEntry {
  key: string
  ts: number
  kind: 'message' | 'delivery' | 'checkIn' | 'checkOut'
  actor: string
  target: string
  detail: string
}

/**
 * Logs tab — combined audit feed of comms + check-in events. Pulls messages
 * from the server; check-in events derived from the assignments already in
 * the store. Sorted newest first.
 */
export function CommLogsTab({ pairing, assignments, crewById }: Props) {
  const [filter, setFilter] = useState<FilterMode>('all')
  const [messages, setMessages] = useState<CrewMessageRef[]>([])

  useEffect(() => {
    let alive = true
    api
      .getCrewMessages({ pairingId: pairing._id })
      .then((rows) => {
        if (alive) setMessages(rows)
      })
      .catch((err) => console.warn('[crew-checkin] logs load failed', err))
    return () => {
      alive = false
    }
  }, [pairing._id])

  const entries = useMemo<LogEntry[]>(() => {
    const out: LogEntry[] = []

    // Comms
    for (const m of messages) {
      const ts = Date.parse(m.createdAt)
      if (Number.isFinite(ts)) {
        out.push({
          key: `msg-${m._id}`,
          ts,
          kind: 'message',
          actor: m.senderUserId,
          target: `${m.recipientCrewIds.length} crew`,
          detail: m.subject ? `${m.subject} — ${truncate(m.body, 80)}` : truncate(m.body, 100),
        })
      }
      // Per-delivery state changes
      for (const d of m.deliveries) {
        const dts = d.deliveredAtUtcMs ?? d.readAtUtcMs
        if (dts) {
          const c = crewById.get(d.crewId)
          out.push({
            key: `del-${m._id}-${d.crewId}`,
            ts: dts,
            kind: 'delivery',
            actor: c ? `${c.lastName.toUpperCase()}, ${c.firstName}` : d.crewId.slice(0, 6),
            target: '',
            detail: d.status === 'read' ? 'Read message' : d.status === 'delivered' ? 'Received message' : d.status,
          })
        }
      }
    }

    // Check-in events derived from assignments
    for (const a of assignments) {
      if (a.status === 'cancelled') continue
      const c = crewById.get(a.crewId)
      const name = c ? `${c.lastName.toUpperCase()}, ${c.firstName}` : a.crewId.slice(0, 6)
      if (a.checkInUtcMs) {
        out.push({
          key: `cin-${a._id}`,
          ts: a.checkInUtcMs,
          kind: 'checkIn',
          actor: a.checkedInByUserId ?? 'controller',
          target: name,
          detail: 'Checked in',
        })
      }
      if (a.checkOutUtcMs) {
        out.push({
          key: `cout-${a._id}`,
          ts: a.checkOutUtcMs,
          kind: 'checkOut',
          actor: a.checkedInByUserId ?? 'controller',
          target: name,
          detail: 'Checked out',
        })
      }
    }

    out.sort((x, y) => y.ts - x.ts)
    return out
  }, [messages, assignments, crewById])

  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    if (filter === 'comms') return entries.filter((e) => e.kind === 'message' || e.kind === 'delivery')
    return entries.filter((e) => e.kind === 'checkIn' || e.kind === 'checkOut')
  }, [entries, filter])

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 border-b border-hz-border p-2 flex items-center gap-1">
        <FilterPill label="All" active={filter === 'all'} onClick={() => setFilter('all')} count={entries.length} />
        <FilterPill
          label="Comms"
          active={filter === 'comms'}
          onClick={() => setFilter('comms')}
          count={entries.filter((e) => e.kind === 'message' || e.kind === 'delivery').length}
        />
        <FilterPill
          label="Check-In"
          active={filter === 'checkIn'}
          onClick={() => setFilter('checkIn')}
          count={entries.filter((e) => e.kind === 'checkIn' || e.kind === 'checkOut').length}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-[13px] text-hz-text-tertiary py-6 text-center">
            No events recorded yet for this pairing
          </div>
        ) : (
          filtered.map((e) => <Row key={e.key} entry={e} />)
        )}
      </div>
    </div>
  )
}

function Row({ entry }: { entry: LogEntry }) {
  const meta = visualsFor(entry.kind)
  const Icon = meta.icon
  const d = new Date(entry.ts)
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const date = d.toISOString().slice(0, 10)
  return (
    <div className="rounded-lg px-3 py-2 flex items-start gap-2.5" style={{ background: 'rgba(125,125,140,0.08)' }}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: meta.bg, color: meta.color }}
      >
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-mono text-hz-text-tertiary">
            {date} {time}Z
          </span>
          <span className="text-hz-text-tertiary uppercase tracking-wider font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <div className="text-[13px] mt-0.5">
          <span className="font-semibold">{entry.actor}</span>
          {entry.target && <span className="text-hz-text-tertiary"> → {entry.target}</span>}
        </div>
        {entry.detail && <div className="text-[13px] text-hz-text-secondary truncate">{entry.detail}</div>}
      </div>
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 px-2.5 inline-flex items-center gap-1 rounded-full text-[13px] font-semibold transition-colors"
      style={{
        background: active ? 'rgba(125,125,140,0.18)' : 'transparent',
        color: active ? 'var(--hz-text, #1C1C28)' : undefined,
      }}
    >
      {label}
      <span className="text-hz-text-tertiary">{count}</span>
    </button>
  )
}

function visualsFor(kind: LogEntry['kind']) {
  switch (kind) {
    case 'message':
      return { label: 'Sent', color: 'var(--hz-text, #1C1C28)', bg: 'rgba(125,125,140,0.20)', icon: MessageSquare }
    case 'delivery':
      return {
        label: 'Delivery',
        color: 'var(--hz-text-secondary, #555770)',
        bg: 'rgba(125,125,140,0.16)',
        icon: AlertCircle,
      }
    case 'checkIn':
      return { label: 'Check-In', color: '#06C270', bg: 'rgba(6,194,112,0.14)', icon: CheckCircle2 }
    case 'checkOut':
      return { label: 'Check-Out', color: '#FF8800', bg: 'rgba(255,136,0,0.14)', icon: LogOutIcon }
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}
