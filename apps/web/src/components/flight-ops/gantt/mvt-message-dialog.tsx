'use client'

/**
 * MVT/LDM Message Dialog for Movement Control (2.1.1)
 * Shows movement messages generated from OOOI entries.
 * Held messages can be released or discarded.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Radio,
  X,
  RefreshCw,
  Send,
  Trash2,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  User,
} from 'lucide-react'
import { useOperatorStore } from '@/stores/use-operator-store'
import { useTheme } from '@/components/theme-provider'
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
  const [copied, setCopied] = useState(false)

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

  const handleCopy = useCallback(() => {
    const text = messages
      .filter((m) => m.rawMessage)
      .map((m) => m.rawMessage)
      .join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [messages])

  const heldCount = messages.filter((m) => m.status === 'held').length

  // SkyHub-standard modal surface: solid card, level-05 modal shadow.
  const panelBg = isDark ? '#191921' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const softBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const innerBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const monoBg = isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.03)'

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

          <button
            onClick={handleCopy}
            disabled={messages.length === 0}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover disabled:opacity-30 transition-colors"
            title="Copy all raw telex"
          >
            {copied ? <Check className="w-4 h-4" style={{ color: '#06C270' }} /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={fetchData}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
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
            <button
              onClick={() => setSelectedIds(new Set())}
              className="h-7 w-7 rounded-md flex items-center justify-center text-hz-text-secondary hover:bg-hz-surface-hover"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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

          <ul className="px-3 py-2 space-y-1.5">
            {messages.map((msg) => {
              const ac = ACTION_COLORS[msg.actionCode] ?? { bg: innerBg, text: '#606170' }
              const sc = STATUS_COLORS[msg.status] ?? STATUS_COLORS.discarded
              const isHeld = msg.status === 'held'
              const selected = selectedIds.has(msg._id)
              const expanded = expandedIds.has(msg._id)

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
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    onClick={() => toggleExpand(msg._id)}
                  >
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
                    <span className="text-[13px] font-mono text-hz-text-tertiary shrink-0">
                      {msg.flightDate ?? '—'}
                    </span>

                    {/* Summary (expand-to-see) */}
                    <span className="text-[13px] font-mono text-hz-text-secondary flex-1 truncate min-w-0">
                      {msg.summary ?? '—'}
                    </span>

                    {/* Actor — user who owns the current state */}
                    <span
                      className="inline-flex items-center gap-1 text-[13px] text-hz-text-tertiary shrink-0"
                      title={`${actor.label} ${actor.name ?? 'unknown'} at ${formatTime(actor.at)}`}
                    >
                      <User className="w-3 h-3" />
                      <span className="max-w-[140px] truncate">{actor.name ?? '—'}</span>
                    </span>

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
                      <div className="grid grid-cols-[1fr_280px] gap-4 pt-3">
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
                          {msg.errorReason && (
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
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
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
