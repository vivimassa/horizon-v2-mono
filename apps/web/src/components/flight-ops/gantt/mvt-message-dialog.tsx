'use client'

/**
 * MVT/LDM Message Dialog for Movement Control (2.1.1)
 * Shows movement messages generated from OOOI entries.
 * Held messages can be released or discarded.
 */

import { useState, useEffect, useCallback } from 'react'
import { Radio, X, RefreshCw, Send, Trash2, Copy, Check, CheckCircle, AlertCircle } from 'lucide-react'
import { useOperatorStore } from '@/stores/use-operator-store'
import { api } from '@skyhub/api'
import type { MovementMessageRef, MovementMessageStats } from '@skyhub/api'

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  AD: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  AA: { bg: 'rgba(0,99,247,0.12)', text: '#0063F7' },
  ED: { bg: 'rgba(255,136,0,0.12)', text: '#FF8800' },
  EA: { bg: 'rgba(255,136,0,0.12)', text: '#FF8800' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  held: { bg: 'rgba(255,136,0,0.12)', text: '#FF8800' },
  pending: { bg: 'rgba(0,99,247,0.12)', text: '#0063F7' },
  sent: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  discarded: { bg: 'rgba(143,144,166,0.12)', text: '#8F90A6' },
}

export function MvtMessageDialog({ onClose }: { onClose: () => void }) {
  const operatorId = useOperatorStore((s) => s.operator?._id ?? '')

  const [messages, setMessages] = useState<MovementMessageRef[]>([])
  const [stats, setStats] = useState<MovementMessageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-hz-card border border-hz-border rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 mb-4">
          <div className="flex items-center gap-2">
            <Radio size={18} className="text-module-accent" />
            <h2 className="text-[16px] font-bold">MVT/LDM Messages</h2>
            {stats && (
              <span className="text-[12px] text-hz-text-tertiary ml-2">
                {stats.held} held · {stats.pending} pending · {stats.sent} sent
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              disabled={messages.length === 0}
              className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors disabled:opacity-30"
            >
              {copied ? (
                <Check size={15} className="text-[#06C270]" />
              ) : (
                <Copy size={15} className="text-hz-text-secondary" />
              )}
            </button>
            <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors">
              <RefreshCw size={15} className={`text-hz-text-secondary ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hz-border/30 transition-colors">
              <X size={16} className="text-hz-text-secondary" />
            </button>
          </div>
        </div>

        {/* Action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <span className="text-[13px] font-medium">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button
              onClick={handleRelease}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold text-white"
              style={{ background: '#06C270' }}
            >
              <Send size={13} /> Release
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold text-white"
              style={{ background: '#E63535' }}
            >
              <Trash2 size={13} /> Discard
            </button>
          </div>
        )}
        {heldCount > 0 && selectedIds.size === 0 && (
          <div className="mb-3 shrink-0">
            <button onClick={selectAllHeld} className="text-[13px] font-medium text-module-accent hover:underline">
              Select all {heldCount} held messages
            </button>
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {loading && messages.length === 0 && (
            <div className="flex items-center justify-center py-12 text-[13px] text-hz-text-tertiary">Loading...</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <AlertCircle size={24} className="text-hz-text-tertiary opacity-50" />
              <span className="text-[13px] text-hz-text-tertiary">No movement messages yet</span>
              <span className="text-[12px] text-hz-text-tertiary">
                MVT messages are generated when OOOI times are entered
              </span>
            </div>
          )}
          {messages.map((msg) => {
            const ac = ACTION_COLORS[msg.actionCode] ?? ACTION_COLORS.AD
            const sc = STATUS_COLORS[msg.status] ?? STATUS_COLORS.discarded
            const isHeld = msg.status === 'held'
            const selected = selectedIds.has(msg._id)
            return (
              <div
                key={msg._id}
                onClick={() => isHeld && toggleSelect(msg._id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                  selected ? 'border-module-accent bg-module-accent/5' : 'border-hz-border/50 hover:bg-hz-border/10'
                }`}
                style={{ cursor: isHeld ? 'pointer' : 'default' }}
              >
                {/* Checkbox */}
                {isHeld && (
                  <div
                    className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: selected ? 'var(--module-accent)' : 'var(--hz-border)',
                      background: selected ? 'var(--module-accent)' : 'transparent',
                    }}
                  >
                    {selected && <CheckCircle size={10} color="#fff" />}
                  </div>
                )}
                {!isHeld && <div className="w-4 shrink-0" />}

                {/* Action badge */}
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: ac.bg, color: ac.text }}
                >
                  {msg.actionCode}
                </span>

                {/* Flight info */}
                <span className="text-[13px] font-medium shrink-0">{msg.flightNumber ?? '—'}</span>
                <span className="text-[13px] text-hz-text-secondary shrink-0">
                  {msg.depStation}→{msg.arrStation}
                </span>
                <span className="text-[12px] text-hz-text-tertiary shrink-0">{msg.flightDate}</span>

                {/* Summary */}
                <span className="text-[12px] text-hz-text-tertiary flex-1 truncate">{msg.summary}</span>

                {/* Status */}
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase"
                  style={{ background: sc.bg, color: sc.text }}
                >
                  {msg.status}
                </span>

                {/* Time */}
                <span className="text-[11px] text-hz-text-tertiary tabular-nums shrink-0">
                  {msg.createdAtUtc
                    ? new Date(msg.createdAtUtc).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
