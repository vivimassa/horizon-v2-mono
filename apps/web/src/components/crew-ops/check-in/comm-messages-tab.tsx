'use client'

import { useEffect, useMemo, useState } from 'react'
import { Send, Check, AlertCircle, Clock as ClockIcon } from 'lucide-react'
import {
  api,
  type CrewAssignmentRef,
  type CrewMemberListItemRef,
  type CrewMessageRef,
  type PairingRef,
} from '@skyhub/api'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'

interface Props {
  pairing: PairingRef
  assignments: CrewAssignmentRef[]
  crewById: Map<string, CrewMemberListItemRef>
}

/**
 * Messages tab — recipients picker + compose form + thread list.
 * Persists CrewMessage rows; the future crew app picks them up via
 * `getCrewMessages` and acks delivery via `ackCrewMessage`.
 */
export function CommMessagesTab({ pairing, assignments, crewById }: Props) {
  const seedSelectedCrewId = useCrewCheckInStore((s) => s.selectedCommCrewId)

  const crewIds = useMemo(() => assignments.filter((a) => a.status !== 'cancelled').map((a) => a.crewId), [assignments])

  const [recipients, setRecipients] = useState<Set<string>>(() => new Set(crewIds))
  // When user picked a crew in Contacts then switched to Messages, target only them.
  useEffect(() => {
    if (seedSelectedCrewId && crewIds.includes(seedSelectedCrewId)) {
      setRecipients(new Set([seedSelectedCrewId]))
    } else {
      setRecipients(new Set(crewIds))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing._id, seedSelectedCrewId])

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [thread, setThread] = useState<CrewMessageRef[]>([])
  const [threadLoading, setThreadLoading] = useState(false)

  const loadThread = useMemo(
    () => async () => {
      setThreadLoading(true)
      try {
        const rows = await api.getCrewMessages({ pairingId: pairing._id })
        setThread(rows)
      } catch (err) {
        console.warn('[crew-checkin] thread load failed', err)
      } finally {
        setThreadLoading(false)
      }
    },
    [pairing._id],
  )

  useEffect(() => {
    void loadThread()
  }, [loadThread])

  const allSelected = recipients.size === crewIds.length
  const noneSelected = recipients.size === 0

  const toggleAll = () => {
    if (allSelected) setRecipients(new Set())
    else setRecipients(new Set(crewIds))
  }

  const toggleOne = (id: string) => {
    setRecipients((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSend = async () => {
    if (noneSelected || !body.trim()) return
    setSending(true)
    setError(null)
    try {
      const created = await api.createCrewMessage({
        pairingId: pairing._id,
        recipientCrewIds: Array.from(recipients),
        subject: subject.trim() || null,
        body: body.trim(),
        channel: 'inApp',
      })
      setThread((prev) => [created, ...prev])
      setSubject('')
      setBody('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed'
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Recipients */}
      <div className="shrink-0 border-b border-hz-border p-3 space-y-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
          <span>Recipients</span>
          <span className="text-hz-text-tertiary font-medium normal-case tracking-normal">
            {recipients.size}/{crewIds.length}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleAll}
            className="text-[13px] font-semibold"
            style={{ color: 'var(--hz-text, #1C1C28)' }}
          >
            {allSelected ? 'Clear All' : 'Select All'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {crewIds.map((id) => {
            const c = crewById.get(id)
            const selected = recipients.has(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleOne(id)}
                className="inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-[13px] font-semibold transition-colors"
                style={{
                  background: selected ? 'rgba(125,125,140,0.20)' : 'transparent',
                  color: selected ? 'var(--hz-text, #1C1C28)' : undefined,
                  border: `1px solid ${selected ? 'var(--hz-text, #1C1C28)' : 'var(--hz-border, rgba(125,125,140,0.25))'}`,
                }}
              >
                {selected && <Check size={11} />}
                {c ? c.lastName.toUpperCase() : id.slice(0, 6)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Compose */}
      <div className="shrink-0 border-b border-hz-border p-3 space-y-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full h-9 px-3 rounded-lg border border-hz-border text-[13px] bg-transparent focus:outline-none focus:border-hz-text"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message body…"
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-hz-border text-[13px] bg-transparent focus:outline-none focus:border-hz-text resize-none"
        />
        {error && (
          <div className="text-[13px]" style={{ color: '#FF3B3B' }}>
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={sending || noneSelected || !body.trim()}
          className="w-full h-10 rounded-lg text-[14px] font-semibold text-white inline-flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
          style={{ background: '#06C270' }}
        >
          <Send size={14} />
          {sending ? 'Sending…' : `Send to ${recipients.size}`}
        </button>
        <div className="text-[13px] text-hz-text-tertiary">
          Queued for delivery via the crew app — push gateway pending.
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
          <span>Thread</span>
          <span className="text-hz-text-tertiary font-medium normal-case tracking-normal">{thread.length}</span>
        </div>
        {thread.length === 0 ? (
          <div className="text-[13px] text-hz-text-tertiary py-6 text-center">
            {threadLoading ? 'Loading…' : 'No messages sent yet for this pairing'}
          </div>
        ) : (
          thread.map((m) => <MessageCard key={m._id} message={m} crewById={crewById} />)
        )}
      </div>
    </div>
  )
}

function MessageCard({ message, crewById }: { message: CrewMessageRef; crewById: Map<string, CrewMemberListItemRef> }) {
  const created = new Date(message.createdAt)
  const time = `${String(created.getUTCHours()).padStart(2, '0')}:${String(created.getUTCMinutes()).padStart(2, '0')}`
  const date = message.createdAt.slice(0, 10)
  const counts = countByStatus(message)

  return (
    <div className="rounded-xl border border-hz-border p-3 space-y-2">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-mono text-hz-text-tertiary">
          {date} {time}Z
        </span>
        <div className="flex-1" />
        <DeliveryRollup counts={counts} />
      </div>
      {message.subject && <div className="text-[13px] font-semibold">{message.subject}</div>}
      <div className="text-[13px] whitespace-pre-wrap">{message.body}</div>
      <div className="flex flex-wrap gap-1">
        {message.deliveries.map((d) => {
          const c = crewById.get(d.crewId)
          const label = c ? c.lastName.toUpperCase() : d.crewId.slice(0, 6)
          return <DeliveryChip key={d.crewId} label={label} status={d.status} />
        })}
      </div>
    </div>
  )
}

function DeliveryChip({ label, status }: { label: string; status: 'queued' | 'delivered' | 'read' | 'failed' }) {
  const map = {
    queued: { color: '#9A9BA8', bg: 'rgba(154,155,168,0.14)', icon: ClockIcon },
    delivered: { color: '#0063F7', bg: 'rgba(0,99,247,0.12)', icon: Check },
    read: { color: '#06C270', bg: 'rgba(6,194,112,0.14)', icon: Check },
    failed: { color: '#FF3B3B', bg: 'rgba(255,59,59,0.14)', icon: AlertCircle },
  } as const
  const v = map[status]
  const Icon = v.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[13px] font-semibold"
      style={{ color: v.color, background: v.bg }}
    >
      <Icon size={11} />
      {label}
    </span>
  )
}

function DeliveryRollup({ counts }: { counts: { queued: number; delivered: number; read: number; failed: number } }) {
  const parts: string[] = []
  if (counts.read > 0) parts.push(`${counts.read} read`)
  if (counts.delivered > 0) parts.push(`${counts.delivered} delivered`)
  if (counts.queued > 0) parts.push(`${counts.queued} queued`)
  if (counts.failed > 0) parts.push(`${counts.failed} failed`)
  return <span className="text-[13px] text-hz-text-tertiary">{parts.join(' · ') || '—'}</span>
}

function countByStatus(m: CrewMessageRef) {
  const out = { queued: 0, delivered: 0, read: 0, failed: 0 }
  for (const d of m.deliveries) out[d.status] += 1
  return out
}
