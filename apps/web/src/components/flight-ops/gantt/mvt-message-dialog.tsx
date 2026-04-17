'use client'

/**
 * MVT/LDM Message Dialog for Movement Control (2.1.1)
 * Shows movement messages generated from OOOI entries.
 * Held messages can be released or discarded.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Radio,
  X,
  RefreshCw,
  Send,
  Trash2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  User,
  Search,
  Layers,
  History,
} from 'lucide-react'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'
import { api } from '@skyhub/api'
import type { MovementMessageRef, MovementMessageStats } from '@skyhub/api'

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  AD: { bg: 'rgba(6,194,112,0.14)', text: '#06C270' },
  AA: { bg: 'rgba(0,99,247,0.14)', text: '#0063F7' },
  ED: { bg: 'rgba(255,136,0,0.14)', text: '#FF8800' },
  EA: { bg: 'rgba(255,136,0,0.14)', text: '#FF8800' },
  NI: { bg: 'rgba(96,97,112,0.14)', text: '#606170' },
  RR: { bg: 'rgba(255,59,59,0.14)', text: '#FF3B3B' },
  FR: { bg: 'rgba(255,59,59,0.14)', text: '#FF3B3B' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  held: { bg: 'rgba(255,136,0,0.14)', text: '#FF8800' },
  pending: { bg: 'rgba(253,221,72,0.18)', text: '#C99400' },
  sent: { bg: 'rgba(6,194,112,0.14)', text: '#06C270' },
  failed: { bg: 'rgba(255,59,59,0.14)', text: '#FF3B3B' },
  applied: { bg: 'rgba(6,194,112,0.14)', text: '#06C270' },
  discarded: { bg: 'rgba(143,144,166,0.14)', text: '#8F90A6' },
  rejected: { bg: 'rgba(255,59,59,0.14)', text: '#FF3B3B' },
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function MvtMessageDialog({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const operator = useOperatorStore((s) => s.operator)
  const operatorId = operator?._id ?? ''
  const accent = operator?.accentColor ?? '#1e40af'

  const [messages, setMessages] = useState<MovementMessageRef[]>([])
  const [stats, setStats] = useState<MovementMessageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [groupByFlight, setGroupByFlight] = useState(false)
  const [expandedPredecessors, setExpandedPredecessors] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    if (!operatorId) return
    setLoading(true)
    try {
      const [msgs, st] = await Promise.all([
        api.getMovementMessages({ operatorId, limit: 200 }),
        api.getMovementMessageStats(operatorId),
      ])
      setMessages(msgs.messages)
      setStats(st)
    } catch (e) {
      console.error('Failed to fetch MVT messages:', e)
    } finally {
      setLoading(false)
    }
  }, [operatorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRelease = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      await api.releaseMovementMessages(ids)
      setSelectedIds(new Set())
      fetchData()
    } catch (e) {
      console.error('Release failed:', e)
    }
  }, [selectedIds, fetchData])

  const handleDiscard = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      await api.discardMovementMessages(ids)
      setSelectedIds(new Set())
      fetchData()
    } catch (e) {
      console.error('Discard failed:', e)
    }
  }, [selectedIds, fetchData])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllHeld = () => {
    setSelectedIds(new Set(messages.filter((m) => m.status === 'held').map((m) => m._id)))
  }

  const { heads, predecessorsByHead, groupedHeads } = useMemo(() => {
    const msgById = new Map(messages.map((m) => [m._id, m]))
    const isNested = (m: MovementMessageRef) => m.supersededByMessageId != null && msgById.has(m.supersededByMessageId)
    const allHeads = messages.filter((m) => !isNested(m))
    const predecessorsByHead = new Map<string, MovementMessageRef[]>()
    for (const h of allHeads) {
      const chain: MovementMessageRef[] = []
      let cursor = h.supersedesMessageId ? msgById.get(h.supersedesMessageId) : undefined
      while (cursor) {
        chain.push(cursor)
        cursor = cursor.supersedesMessageId ? msgById.get(cursor.supersedesMessageId) : undefined
      }
      if (chain.length) predecessorsByHead.set(h._id, chain)
    }
    const q = query.trim().toLowerCase()
    const matches = (m: MovementMessageRef) => {
      if (!q) return true
      return [m.flightNumber, m.depStation, m.arrStation, m.flightDate]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    }
    const headsFiltered = allHeads.filter((h) => matches(h) || (predecessorsByHead.get(h._id) ?? []).some(matches))
    let groupedHeads: Array<{ key: string; label: string; items: MovementMessageRef[] }> | null = null
    if (groupByFlight) {
      const map = new Map<string, MovementMessageRef[]>()
      for (const h of headsFiltered) {
        const key = `${h.flightNumber ?? '—'}·${h.flightDate ?? '—'}`
        const arr = map.get(key) ?? []
        arr.push(h)
        map.set(key, arr)
      }
      groupedHeads = Array.from(map, ([key, items]) => {
        const first = items[0]
        const label = `${first.flightNumber ?? '—'} · ${first.depStation ?? '?'}→${first.arrStation ?? '?'} · ${first.flightDate ?? '—'}`
        return { key, label, items }
      })
    }
    return { heads: headsFiltered, predecessorsByHead, groupedHeads }
  }, [messages, query, groupByFlight])

  const togglePredecessors = (id: string) => {
    setExpandedPredecessors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const heldCount = messages.filter((m) => m.status === 'held').length

  // SkyHub-standard modal surface: solid card, level-05 modal shadow.
  const panelBg = isDark ? '#191921' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const softBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const innerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const monoBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.03)'

  const renderMessageRow = (msg: MovementMessageRef) => {
    const ac = ACTION_COLORS[msg.actionCode] ?? { bg: innerBg, text: '#606170' }
    const sc = STATUS_COLORS[msg.status] ?? STATUS_COLORS.discarded
    const isHeld = msg.status === 'held'
    const selected = selectedIds.has(msg._id)
    const expanded = expandedIds.has(msg._id)
    const preds = predecessorsByHead.get(msg._id) ?? []
    const showPreds = expandedPredecessors.has(msg._id)

    const actor =
      msg.status === 'sent' || msg.status === 'failed'
        ? { label: 'Released by', name: msg.releasedByName, at: msg.releasedAtUtc }
        : msg.status === 'discarded'
          ? { label: 'Discarded by', name: msg.discardedByName, at: msg.discardedAtUtc }
          : { label: 'Composed by', name: msg.createdByName, at: msg.createdAtUtc }

    return (
      <li
        key={msg._id}
        className="rounded-xl overflow-hidden transition-colors"
        style={{
          background: selected ? `${accent}14` : innerBg,
          border: `1px solid ${selected ? accent : softBorder}`,
        }}
      >
        {/* Row header */}
        <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={() => toggleExpand(msg._id)}>
          {/* Checkbox (only held is selectable) */}
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {isHeld ? (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleSelect(msg._id)}
                aria-label={`Select ${msg.flightNumber ?? 'message'}`}
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: accent }}
              />
            ) : (
              <div className="w-4" />
            )}
          </div>

          {/* Expand chevron */}
          <div className="shrink-0 text-hz-text-tertiary">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>

          {/* Action badge */}
          <span
            className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-mono font-bold shrink-0"
            style={{ background: ac.bg, color: ac.text }}
          >
            {msg.actionCode}
          </span>

          {/* Flight / route / date */}
          <span className="text-[13px] font-semibold text-hz-text shrink-0">{msg.flightNumber ?? '—'}</span>
          <span className="text-[13px] font-mono text-hz-text-secondary shrink-0">
            {msg.depStation ?? '?'}→{msg.arrStation ?? '?'}
          </span>
          <span className="text-[13px] font-mono text-hz-text-tertiary shrink-0">{msg.flightDate ?? '—'}</span>

          {/* Revision indicator */}
          {preds.length > 0 && (
            <Tooltip content={`${preds.length} earlier version${preds.length === 1 ? '' : 's'}`}>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[13px] font-medium shrink-0 text-hz-text-tertiary"
                style={{
                  background: innerBg,
                  border: `1px solid ${softBorder}`,
                }}
              >
                <History className="w-3 h-3" />v{preds.length + 1}
              </span>
            </Tooltip>
          )}

          {/* Summary (expand-to-see) */}
          <span className="text-[13px] font-mono text-hz-text-secondary flex-1 truncate min-w-0">
            {msg.summary ?? '—'}
          </span>

          {/* Actor — user who owns the current state */}
          <Tooltip content={`${actor.label} ${actor.name ?? 'unknown'} at ${formatTime(actor.at)}`}>
            <span className="inline-flex items-center gap-1 text-[13px] text-hz-text-tertiary shrink-0">
              <User className="w-3 h-3" />
              <span className="max-w-[140px] truncate">{actor.name ?? '—'}</span>
            </span>
          </Tooltip>

          {/* Status */}
          <span
            className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold uppercase shrink-0"
            style={{ background: sc.bg, color: sc.text }}
          >
            {msg.status}
          </span>

          {/* Time */}
          <span className="text-[13px] font-mono text-hz-text-tertiary tabular-nums shrink-0">
            {msg.createdAtUtc
              ? new Date(msg.createdAtUtc).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </span>
        </div>

        {/* Expanded body — raw telex preserving format + full audit trail */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: softBorder }}>
            <div className="grid grid-cols-[1fr_420px] gap-4 pt-3">
              {/* Raw telex */}
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2">
                  Raw telex
                </div>
                <pre
                  className="text-[13px] font-mono whitespace-pre-wrap rounded-lg p-3 text-hz-text-secondary overflow-auto"
                  style={{ background: monoBg, border: `1px solid ${softBorder}` }}
                >
                  {msg.rawMessage ?? '—'}
                </pre>
                {msg.errorReason && !msg.errorReason.startsWith('superseded_by:') && (
                  <div
                    className="mt-2 rounded-lg px-3 py-2 text-[13px]"
                    style={{
                      background: 'rgba(255,59,59,0.10)',
                      color: '#FF3B3B',
                      border: '1px solid rgba(255,59,59,0.28)',
                    }}
                  >
                    {msg.errorReason}
                  </div>
                )}
              </div>

              {/* Audit trail */}
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2">
                  Audit trail
                </div>
                <div className="space-y-1.5">
                  <AuditLine label="Composed by" name={msg.createdByName} at={msg.createdAtUtc} />
                  {(msg.releasedAtUtc || msg.releasedByName) && (
                    <AuditLine
                      label={msg.status === 'failed' ? 'Transmit failed by' : 'Released by'}
                      name={msg.releasedByName}
                      at={msg.releasedAtUtc}
                    />
                  )}
                  {msg.sentAtUtc && msg.status === 'sent' && (
                    <AuditLine label="Sent at" name={null} at={msg.sentAtUtc} />
                  )}
                  {msg.discardedAtUtc && (
                    <AuditLine label="Discarded by" name={msg.discardedByName} at={msg.discardedAtUtc} />
                  )}
                  {msg.supersededByMessageId && (
                    <div
                      className="rounded-md px-2.5 py-1.5 text-[13px]"
                      style={{
                        background: 'rgba(255,136,0,0.10)',
                        color: '#FF8800',
                        border: '1px solid rgba(255,136,0,0.24)',
                      }}
                    >
                      Superseded by a newer compose
                    </div>
                  )}
                  {msg.supersedesMessageId && (
                    <div
                      className="rounded-md px-2.5 py-1.5 text-[13px]"
                      style={{
                        background: `${accent}14`,
                        color: accent,
                        border: `1px solid ${accent}33`,
                      }}
                    >
                      Replaced an earlier held message
                    </div>
                  )}
                </div>
              </div>
            </div>

            {preds.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: softBorder }}>
                <button
                  onClick={() => togglePredecessors(msg._id)}
                  className="text-[13px] font-medium flex items-center gap-1.5 hover:underline"
                  style={{ color: accent }}
                >
                  {showPreds ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {showPreds ? 'Hide' : 'Show'} {preds.length} earlier version
                  {preds.length === 1 ? '' : 's'}
                </button>
                {showPreds && (
                  <div className="mt-3 space-y-2">
                    {preds.map((pred) => (
                      <PredecessorCard
                        key={pred._id}
                        msg={pred}
                        innerBg={innerBg}
                        softBorder={softBorder}
                        monoBg={monoBg}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full h-[88vh] max-w-[1600px] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — accent bar, title, stats summary, toolbar */}
        <div className="flex items-center gap-3 px-5 h-14 shrink-0 border-b" style={{ borderColor: softBorder }}>
          <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
          <Radio className="w-4 h-4" style={{ color: accent }} />
          <span className="text-[15px] font-semibold text-hz-text">MVT/LDM Messages</span>
          {stats && (
            <span className="text-[13px] text-hz-text-tertiary">
              {stats.held} held · {stats.pending} pending · {stats.sent} sent
            </span>
          )}

          <div className="flex-1" />

          <Tooltip content="Close">
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Filter bar — search + group-by-flight toggle */}
        <div className="flex items-center gap-3 px-5 h-12 shrink-0 border-b" style={{ borderColor: softBorder }}>
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-hz-text-tertiary pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by flight, route or date…"
              className="h-8 w-full pl-8 pr-3 rounded-lg text-[13px] text-hz-text outline-none placeholder:text-hz-text-tertiary"
              style={{
                background: innerBg,
                border: `1px solid ${softBorder}`,
              }}
            />
          </div>
          <div className="flex-1" />
          <Tooltip content="Group messages by flight">
            <button
              onClick={() => setGroupByFlight((v) => !v)}
              className={`h-8 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors ${
                groupByFlight ? '' : 'text-hz-text-secondary hover:bg-hz-surface-hover'
              }`}
              style={{
                background: groupByFlight ? `${accent}14` : 'transparent',
                color: groupByFlight ? accent : undefined,
                border: `1px solid ${groupByFlight ? accent : softBorder}`,
              }}
            >
              <Layers className="w-3.5 h-3.5" />
              Group by flight
            </button>
          </Tooltip>
          <Tooltip content="Refresh">
            <button
              onClick={fetchData}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover transition-colors"
              style={{ border: `1px solid ${softBorder}` }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </Tooltip>
        </div>

        {/* Action bar — shown when selection > 0 or when there are held-for-all */}
        {selectedIds.size > 0 ? (
          <div
            className="flex items-center gap-2 px-5 h-11 shrink-0 border-b"
            style={{ background: `${accent}10`, borderColor: softBorder }}
          >
            <span className="text-[13px] font-semibold" style={{ color: accent }}>
              {selectedIds.size} selected
            </span>
            <Tooltip content="Clear selection">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="h-7 w-7 rounded-md flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <div className="flex-1" />
            <button
              onClick={handleRelease}
              className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 text-white"
              style={{ background: '#06C270' }}
            >
              <Send className="w-3.5 h-3.5" /> Release
            </button>
            <button
              onClick={handleDiscard}
              className="h-8 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 text-white"
              style={{ background: '#E63535' }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Discard
            </button>
          </div>
        ) : heldCount > 0 ? (
          <div className="flex items-center px-5 h-10 shrink-0 border-b" style={{ borderColor: softBorder }}>
            <button
              onClick={selectAllHeld}
              className="text-[13px] font-semibold hover:underline"
              style={{ color: accent }}
            >
              Select all {heldCount} held messages
            </button>
          </div>
        ) : null}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading && messages.length === 0 && (
            <div className="flex items-center justify-center py-16 text-[13px] text-hz-text-tertiary">Loading…</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <AlertCircle className="w-6 h-6 text-hz-text-tertiary opacity-50" />
              <span className="text-[13px] text-hz-text-tertiary">No movement messages yet</span>
              <span className="text-[13px] text-hz-text-tertiary opacity-70">
                MVT messages are generated when OOOI times are entered
              </span>
            </div>
          )}

          {!loading && messages.length > 0 && heads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Search className="w-6 h-6 text-hz-text-tertiary opacity-50" />
              <span className="text-[13px] text-hz-text-tertiary">No messages match “{query}”</span>
            </div>
          )}

          {groupedHeads ? (
            <div className="px-3 py-2 space-y-4">
              {groupedHeads.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 px-1 pb-2 text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                    <div className="w-[3px] h-3.5 rounded-full" style={{ background: accent }} />
                    <span className="text-hz-text">{group.label}</span>
                    <span className="opacity-70">
                      · {group.items.length} message{group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ul className="space-y-1.5">{group.items.map((msg) => renderMessageRow(msg))}</ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="px-3 py-2 space-y-1.5">{heads.map((msg) => renderMessageRow(msg))}</ul>
          )}
        </div>
      </div>
    </div>
  )
}

function AuditLine({
  label,
  name,
  at,
}: {
  label: string
  name: string | null | undefined
  at: string | null | undefined
}) {
  return (
    <div className="flex items-baseline gap-2 text-[13px]">
      <span className="text-hz-text-tertiary uppercase tracking-wider w-[120px] shrink-0">{label}</span>
      <span className="text-hz-text font-semibold truncate">{name ?? '—'}</span>
      <span className="text-hz-text-tertiary font-mono ml-auto shrink-0">{formatTime(at)}</span>
    </div>
  )
}

function PredecessorCard({
  msg,
  innerBg,
  softBorder,
  monoBg,
}: {
  msg: MovementMessageRef
  innerBg: string
  softBorder: string
  monoBg: string
}) {
  const sc = STATUS_COLORS[msg.status] ?? STATUS_COLORS.discarded
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: innerBg, border: `1px solid ${softBorder}` }}>
      <div className="flex items-center gap-3 mb-2 text-[13px]">
        <span className="font-semibold text-hz-text shrink-0">{msg.flightNumber ?? '—'}</span>
        <span className="font-mono text-hz-text-secondary shrink-0">
          {msg.depStation ?? '?'}→{msg.arrStation ?? '?'}
        </span>
        <span className="font-mono text-hz-text-tertiary shrink-0">{msg.flightDate ?? '—'}</span>
        <span className="font-mono text-hz-text-secondary flex-1 truncate min-w-0">{msg.summary ?? '—'}</span>
        <span
          className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold uppercase shrink-0"
          style={{ background: sc.bg, color: sc.text }}
        >
          {msg.status}
        </span>
        <span className="font-mono text-hz-text-tertiary tabular-nums shrink-0">
          {msg.createdAtUtc
            ? new Date(msg.createdAtUtc).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_420px] gap-4">
        <pre
          className="text-[13px] font-mono whitespace-pre-wrap rounded-lg p-3 text-hz-text-secondary overflow-auto"
          style={{ background: monoBg, border: `1px solid ${softBorder}` }}
        >
          {msg.rawMessage ?? '—'}
        </pre>
        <div className="space-y-1.5">
          <AuditLine label="Composed by" name={msg.createdByName} at={msg.createdAtUtc} />
          {msg.discardedAtUtc && <AuditLine label="Discarded by" name={msg.discardedByName} at={msg.discardedAtUtc} />}
          <div
            className="rounded-md px-2.5 py-1.5 text-[13px]"
            style={{
              background: 'rgba(255,136,0,0.10)',
              color: '#FF8800',
              border: '1px solid rgba(255,136,0,0.24)',
            }}
          >
            Superseded by a newer compose
          </div>
        </div>
      </div>
    </div>
  )
}
