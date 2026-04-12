'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Trash2, RefreshCw, MessageSquare, Radio, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { useOperatorStore } from '@/stores/use-operator-store'
import { api } from '@skyhub/api'
import type { MovementMessageRef, MovementMessageStats } from '@skyhub/api'

type Tab = 'asm' | 'mvt'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  held: { bg: 'rgba(255,136,0,0.12)', text: '#FF8800' },
  pending: { bg: 'rgba(0,99,247,0.12)', text: '#0063F7' },
  sent: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  applied: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  rejected: { bg: 'rgba(230,53,53,0.12)', text: '#E63535' },
  discarded: { bg: 'rgba(143,144,166,0.12)', text: '#8F90A6' },
}

export function CommunicationPanel({
  open,
  onClose,
  initialTab = 'mvt',
}: {
  open: boolean
  onClose: () => void
  initialTab?: Tab
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const operatorId = useOperatorStore((s) => s.operator?._id ?? '')

  const [tab, setTab] = useState<Tab>(initialTab)
  const [mvtMessages, setMvtMessages] = useState<MovementMessageRef[]>([])
  const [mvtStats, setMvtStats] = useState<MovementMessageStats | null>(null)
  const [asmMessages, setAsmMessages] = useState<MovementMessageRef[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    if (!operatorId) return
    setLoading(true)
    try {
      if (tab === 'mvt') {
        const [msgs, stats] = await Promise.all([
          api.getMovementMessages({ operatorId, limit: 100 }),
          api.getMovementMessageStats(operatorId),
        ])
        setMvtMessages(msgs.messages)
        setMvtStats(stats)
      } else {
        const msgs = await api.getScheduleMessages({ operatorId, limit: 100 })
        setAsmMessages(msgs.messages as unknown as MovementMessageRef[])
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e)
    } finally {
      setLoading(false)
    }
  }, [operatorId, tab])

  useEffect(() => {
    if (open) fetchData()
  }, [open, fetchData])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [tab])

  const handleRelease = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      if (tab === 'mvt') {
        await api.releaseMovementMessages(ids)
      } else {
        await api.releaseScheduleMessages(ids)
      }
      setSelectedIds(new Set())
      fetchData()
    } catch (e) {
      console.error('Release failed:', e)
    }
  }, [selectedIds, tab, fetchData])

  const handleDiscard = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      if (tab === 'mvt') {
        await api.discardMovementMessages(ids)
      } else {
        await api.discardScheduleMessages(ids)
      }
      setSelectedIds(new Set())
      fetchData()
    } catch (e) {
      console.error('Discard failed:', e)
    }
  }, [selectedIds, tab, fetchData])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllHeld = () => {
    const msgs = tab === 'mvt' ? mvtMessages : asmMessages
    const held = msgs.filter((m) => m.status === 'held')
    setSelectedIds(new Set(held.map((m) => m._id)))
  }

  if (!open) return null

  const messages = tab === 'mvt' ? mvtMessages : asmMessages
  const heldCount = messages.filter((m) => m.status === 'held').length
  const bg = isDark ? '#1C1C28' : '#FAFAFC'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="rounded-2xl w-[700px] max-h-[80vh] flex flex-col overflow-hidden"
        style={{ background: bg, border: `1px solid ${border}`, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex-1">
            <div className="text-[16px] font-semibold" style={{ color: palette.text }}>
              Communication
            </div>
            {mvtStats && tab === 'mvt' && (
              <div className="text-[13px] flex gap-3 mt-0.5" style={{ color: palette.textTertiary }}>
                <span>{mvtStats.held} held</span>
                <span>{mvtStats.pending} pending</span>
                <span>{mvtStats.sent} sent</span>
              </div>
            )}
          </div>
          <button
            onClick={fetchData}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: palette.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: palette.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-1 shrink-0">
          {[
            { key: 'mvt' as Tab, label: 'MVT / LDM', icon: Radio },
            { key: 'asm' as Tab, label: 'ASM / SSM', icon: MessageSquare },
          ].map((t) => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-[13px] font-medium transition-colors"
                style={{
                  background: active ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent',
                  color: active ? (isDark ? '#5B8DEF' : '#1e40af') : palette.textTertiary,
                  borderBottom: active ? `2px solid ${isDark ? '#5B8DEF' : '#1e40af'}` : '2px solid transparent',
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
            <span className="text-[13px] font-medium" style={{ color: palette.text }}>
              {selectedIds.size} selected
            </span>
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
          <div className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
            <button
              onClick={selectAllHeld}
              className="text-[13px] font-medium transition-colors"
              style={{ color: isDark ? '#5B8DEF' : '#1e40af' }}
            >
              Select all {heldCount} held messages
            </button>
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {loading && messages.length === 0 && (
            <div className="flex items-center justify-center py-12 text-[13px]" style={{ color: palette.textTertiary }}>
              Loading...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <AlertCircle size={24} style={{ color: palette.textTertiary, opacity: 0.5 }} />
              <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                No messages
              </span>
            </div>
          )}
          {messages.map((msg) => {
            const sc = STATUS_COLORS[msg.status] ?? STATUS_COLORS.discarded
            const selected = selectedIds.has(msg._id)
            return (
              <div
                key={msg._id}
                onClick={() => msg.status === 'held' && toggleSelect(msg._id)}
                className="flex items-center gap-3 px-5 py-3 transition-colors"
                style={{
                  borderBottom: `1px solid ${border}`,
                  background: selected ? (isDark ? 'rgba(91,141,239,0.08)' : 'rgba(30,64,175,0.04)') : 'transparent',
                  cursor: msg.status === 'held' ? 'pointer' : 'default',
                }}
              >
                {/* Checkbox for held messages */}
                <div
                  className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                  style={{
                    borderColor: selected
                      ? isDark
                        ? '#5B8DEF'
                        : '#1e40af'
                      : isDark
                        ? 'rgba(255,255,255,0.20)'
                        : 'rgba(0,0,0,0.15)',
                    background: selected ? (isDark ? '#5B8DEF' : '#1e40af') : 'transparent',
                  }}
                >
                  {selected && <CheckCircle size={10} color="#fff" />}
                </div>

                {/* Action code badge */}
                <span className="text-[13px] font-mono font-bold w-8 shrink-0" style={{ color: palette.text }}>
                  {msg.actionCode}
                </span>

                {/* Flight info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
                      {msg.flightNumber ?? '—'}
                    </span>
                    <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                      {msg.depStation} → {msg.arrStation}
                    </span>
                    <span className="text-[13px]" style={{ color: palette.textTertiary }}>
                      {msg.flightDate}
                    </span>
                  </div>
                  {msg.summary && (
                    <div className="text-[12px] truncate mt-0.5" style={{ color: palette.textTertiary }}>
                      {msg.summary}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase"
                  style={{ background: sc.bg, color: sc.text }}
                >
                  {msg.status}
                </span>

                {/* Timestamp */}
                <span className="text-[11px] tabular-nums shrink-0" style={{ color: palette.textTertiary }}>
                  {msg.createdAtUtc
                    ? new Date(msg.createdAtUtc).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
