'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, CheckCircle, Trash2, Eye, Loader2, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { api } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import { groupHeldMessages, ACTION_LABELS } from '@skyhub/logic'
import type { ScheduleMessageRef } from '@skyhub/api'
import type { GroupedMessage } from '@skyhub/types'

interface SendPanelProps {
  operatorIataCode: string
  onSent: () => void
}

export function SendPanel({ operatorIataCode, onSent }: SendPanelProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [held, setHeld] = useState<ScheduleMessageRef[]>([])
  const [groups, setGroups] = useState<GroupedMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set())
  const [previewMsg, setPreviewMsg] = useState<ScheduleMessageRef | null>(null)

  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const rowHover = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'

  const loadHeld = useCallback(async () => {
    const opId = getOperatorId()
    if (!opId) return
    setLoading(true)
    try {
      const { messages } = await api.getHeldScheduleMessages(opId)
      setHeld(messages)
      setGroups(groupHeldMessages(messages as any))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHeld()
  }, [loadHeld])

  const toggleGroup = (key: string) => {
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedGroupKeys.size === groups.length) {
      setSelectedGroupKeys(new Set())
    } else {
      setSelectedGroupKeys(new Set(groups.map((g) => g.key)))
    }
  }

  const selectedMessageIds = groups.filter((g) => selectedGroupKeys.has(g.key)).flatMap((g) => g.messageIds)

  const handleRelease = useCallback(async () => {
    if (selectedMessageIds.length === 0) return
    setActing(true)
    try {
      await api.releaseScheduleMessages(selectedMessageIds)
      setSelectedGroupKeys(new Set())
      await loadHeld()
      onSent()
    } finally {
      setActing(false)
    }
  }, [selectedMessageIds, loadHeld, onSent])

  const handleDiscard = useCallback(async () => {
    if (selectedMessageIds.length === 0) return
    setActing(true)
    try {
      await api.discardScheduleMessages(selectedMessageIds)
      setSelectedGroupKeys(new Set())
      await loadHeld()
      onSent()
    } finally {
      setActing(false)
    }
  }, [selectedMessageIds, loadHeld, onSent])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-5"
        style={{ height: 44, borderBottom: `1px solid ${sectionBorder}` }}
      >
        <div className="flex items-center gap-2">
          <Send size={14} className="text-module-accent" />
          <span className="text-[14px] font-bold">Outbound Held Messages</span>
          {groups.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[13px] font-bold"
              style={{ background: 'rgba(255,136,0,0.15)', color: '#FF8800' }}
            >
              {groups.length} group{groups.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedGroupKeys.size > 0 && (
            <>
              <button
                onClick={handleRelease}
                disabled={acting}
                className="h-8 px-4 rounded-lg text-[13px] font-semibold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: '#06C270' }}
              >
                {acting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Release ({selectedMessageIds.length})
              </button>
              <button
                onClick={handleDiscard}
                disabled={acting}
                className="h-8 px-4 rounded-lg text-[13px] font-semibold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: '#E63535' }}
              >
                <Trash2 size={13} />
                Discard
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Groups list */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-hz-text-tertiary" />
            </div>
          )}

          {!loading && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle size={32} className="text-hz-text-tertiary opacity-40" />
              <p className="text-[13px] text-hz-text-tertiary font-medium">No held outbound messages</p>
              <p className="text-[13px] text-hz-text-tertiary">
                Messages are held when schedule changes are detected. Edit flights in Scheduling XL to generate ASMs.
              </p>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${sectionBorder}` }}>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedGroupKeys.size === groups.length && groups.length > 0}
                      onChange={toggleAll}
                      className="accent-[var(--module-accent)]"
                    />
                  </th>
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">
                    Action
                  </th>
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">
                    Flight
                  </th>
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">
                    Date Range
                  </th>
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">
                    Instances
                  </th>
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">
                    Summary
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const selected = selectedGroupKeys.has(g.key)
                  return (
                    <tr
                      key={g.key}
                      className="transition-colors"
                      style={{ borderBottom: `1px solid ${sectionBorder}` }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = rowHover
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGroup(g.key)}
                          className="accent-[var(--module-accent)]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <ActionBadge code={g.actionCode} />
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-mono font-semibold">{g.flightNumber}</td>
                      <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text-secondary">
                        {g.dateFrom === g.dateTo ? g.dateFrom : `${g.dateFrom} \u2013 ${g.dateTo}`}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] font-semibold text-center">{g.instanceCount}</td>
                      <td className="px-3 py-2.5 text-[13px] text-hz-text-secondary truncate max-w-[300px]">
                        {g.summary}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setPreviewMsg(g.messages[0])}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-hz-border/30 transition-colors"
                        >
                          <Eye size={14} className="text-hz-text-tertiary" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Preview sidebar */}
        {previewMsg && (
          <div
            className="w-[340px] shrink-0 overflow-y-auto p-4 space-y-3"
            style={{ borderLeft: `1px solid ${sectionBorder}` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold">Message Preview</span>
              <button
                onClick={() => setPreviewMsg(null)}
                className="text-[13px] text-hz-text-tertiary hover:text-hz-text-primary transition-colors"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <PreviewField label="Type" value={previewMsg.messageType} />
              <PreviewField
                label="Action"
                value={`${previewMsg.actionCode} \u2014 ${ACTION_LABELS[previewMsg.actionCode] || ''}`}
              />
              <PreviewField label="Flight" value={previewMsg.flightNumber || '\u2014'} />
              <PreviewField label="Date" value={previewMsg.flightDate || '\u2014'} />
            </div>

            {previewMsg.rawMessage && (
              <div>
                <span className="text-[13px] text-hz-text-tertiary font-medium block mb-1">Raw IATA Message</span>
                <pre
                  className="rounded-xl px-3 py-2.5 text-[13px] font-mono whitespace-pre-wrap"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
                >
                  {previewMsg.rawMessage}
                </pre>
              </div>
            )}

            {previewMsg.summary && (
              <div>
                <span className="text-[13px] text-hz-text-tertiary font-medium block mb-1">Summary</span>
                <p className="text-[13px] text-hz-text-secondary">{previewMsg.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[13px] text-hz-text-tertiary font-medium block">{label}</span>
      <span className="text-[13px] font-semibold">{value}</span>
    </div>
  )
}

const ACTION_COLORS: Record<string, string> = {
  NEW: '#06C270',
  CNL: '#FF3B3B',
  TIM: '#0063F7',
  EQT: '#FF8800',
  RRT: '#FF8800',
  RIN: '#06C270',
  RPL: '#0063F7',
  FLT: '#0063F7',
  SKD: '#0063F7',
  CON: '#FF8800',
}

function ActionBadge({ code }: { code: string }) {
  const color = ACTION_COLORS[code] || '#555770'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[13px] font-bold"
      style={{ background: `${color}20`, color }}
    >
      {code}
    </span>
  )
}
