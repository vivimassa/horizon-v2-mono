'use client'

/**
 * 7.1.5.1 Held Queue section.
 *
 * Admin-level view of all held outbound ASM/SSM messages. Supports
 * bulk Release (fans out to consumers) and bulk Discard. Filter chips
 * narrow by action code. Mirrors the gantt-side communication panel
 * but with cross-flight bulk operations.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react'
import { api, type ScheduleMessageRef } from '@skyhub/api'
import type { Palette as PaletteType } from '@skyhub/ui/theme'

interface Props {
  operatorId: string
  accent: string
  isDark: boolean
  palette: PaletteType
  onError: (msg: string | null) => void
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  CNL: { bg: 'rgba(255,59,59,0.12)', text: '#E63535' },
  TIM: { bg: 'rgba(0,99,247,0.12)', text: '#0063F7' },
  EQT: { bg: 'rgba(102,0,204,0.10)', text: '#6600CC' },
  RRT: { bg: 'rgba(255,136,0,0.12)', text: '#E67A00' },
  RPL: { bg: 'rgba(255,136,0,0.12)', text: '#E67A00' },
  CON: { bg: 'rgba(0,207,222,0.12)', text: '#00CFDE' },
}

export function HeldQueueSection({ operatorId, accent, isDark, onError }: Props) {
  const [messages, setMessages] = useState<ScheduleMessageRef[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<null | 'release' | 'discard'>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getHeldScheduleMessages(operatorId)
      setMessages(res.messages)
      setSelected(new Set())
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load held queue')
    } finally {
      setLoading(false)
    }
  }, [operatorId, onError])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () => (actionFilter ? messages.filter((m) => m.actionCode === actionFilter) : messages),
    [messages, actionFilter],
  )
  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of messages) counts[m.actionCode] = (counts[m.actionCode] ?? 0) + 1
    return counts
  }, [messages])

  const allVisibleSelected = filtered.length > 0 && filtered.every((m) => selected.has(m._id as string))

  const toggleAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selected)
      for (const m of filtered) next.delete(m._id as string)
      setSelected(next)
    } else {
      const next = new Set(selected)
      for (const m of filtered) next.add(m._id as string)
      setSelected(next)
    }
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleBulk = async (kind: 'release' | 'discard') => {
    if (selected.size === 0) return
    if (
      kind === 'discard' &&
      !confirm(`Discard ${selected.size} held message${selected.size === 1 ? '' : 's'}? Cannot be undone.`)
    )
      return
    setBusy(kind)
    try {
      const ids = Array.from(selected)
      if (kind === 'release') await api.releaseScheduleMessages(ids)
      else await api.discardScheduleMessages(ids)
      await load()
    } catch (e) {
      onError(e instanceof Error ? e.message : `${kind} failed`)
    } finally {
      setBusy(null)
    }
  }

  const cardBg = isDark ? 'rgba(25,25,33,0.85)' : '#FFFFFF'
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[13px] font-medium text-hz-text">
            {filtered.length} of {messages.length} held message
            {messages.length === 1 ? '' : 's'}
          </div>
          <div className="text-[13px] text-hz-text-secondary">
            Release fans messages out to every active consumer. Discard marks them done without sending.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="h-9 px-3 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/30 flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleBulk('discard')}
            disabled={selected.size === 0 || busy !== null}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-40"
            style={{
              background: 'rgba(230,53,53,0.10)',
              color: '#E63535',
              border: '1px solid rgba(230,53,53,0.28)',
            }}
          >
            {busy === 'discard' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
            Discard ({selected.size})
          </button>
          <button
            type="button"
            onClick={() => void handleBulk('release')}
            disabled={selected.size === 0 || busy !== null}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: accent }}
          >
            {busy === 'release' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Release ({selected.size})
          </button>
        </div>
      </div>

      {/* Filter chips */}
      {messages.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setActionFilter(null)}
            className="h-8 px-3 rounded-full text-[13px] font-medium"
            style={{
              background: actionFilter === null ? accent : 'rgba(96,97,112,0.08)',
              color: actionFilter === null ? '#fff' : 'var(--color-hz-text-secondary)',
            }}
          >
            All ({messages.length})
          </button>
          {Object.entries(actionCounts).map(([code, count]) => {
            const c = ACTION_COLORS[code] ?? { bg: 'rgba(96,97,112,0.08)', text: accent }
            const active = actionFilter === code
            return (
              <button
                key={code}
                type="button"
                onClick={() => setActionFilter(active ? null : code)}
                className="h-8 px-3 rounded-full text-[13px] font-medium"
                style={{
                  background: active ? c.text : c.bg,
                  color: active ? '#fff' : c.text,
                }}
              >
                {code} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-hz-text-secondary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: cardBg, border: `1px dashed ${cardBorder}` }}>
          <ShieldAlert size={20} className="mx-auto text-hz-text-tertiary mb-2" />
          <div className="text-[14px] font-medium text-hz-text mb-1">Queue is empty</div>
          <div className="text-[13px] text-hz-text-secondary">
            Held messages will appear here when the schedule pipeline produces them.
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(96,97,112,0.04)',
                }}
              >
                <th className="px-3 py-2.5 w-[36px]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    style={{ accentColor: accent }}
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Action
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Flight
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Route
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Family
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Held at
                </th>
                <th className="px-3 py-2.5 text-left text-[12px] font-medium text-hz-text-tertiary uppercase tracking-wider">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const color = ACTION_COLORS[m.actionCode] ?? { bg: 'rgba(96,97,112,0.08)', text: accent }
                const id = m._id as string
                return (
                  <tr
                    key={id}
                    className="border-t"
                    style={{
                      borderColor: cardBorder,
                      background:
                        i % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(96,97,112,0.03)') : 'transparent',
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleOne(id)}
                        style={{ accentColor: accent }}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={{ background: color.bg, color: color.text }}
                      >
                        {m.actionCode}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-hz-text font-medium">{m.flightNumber ?? '—'}</td>
                    <td className="px-3 py-2.5 text-hz-text-secondary font-mono">{m.flightDate ?? '—'}</td>
                    <td className="px-3 py-2.5 text-hz-text-secondary">
                      {m.depStation && m.arrStation ? `${m.depStation}→${m.arrStation}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-hz-text-secondary">{m.messageType}</td>
                    <td className="px-3 py-2.5 text-hz-text-tertiary">
                      {m.createdAtUtc ? new Date(m.createdAtUtc).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-hz-text-tertiary truncate max-w-[280px]">{m.summary ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
