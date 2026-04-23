'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Trash2, X, Loader2 } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'
import { usePairingStore } from '@/stores/use-pairing-store'
import type { Pairing } from '../types'

interface BulkDeletePairingDialogProps {
  source: Pairing
  onClose: () => void
}

interface DeleteRow {
  date: string // YYYY-MM-DD (startDate of the matched pairing)
  weekday: number // 0 Mon … 6 Sun
  pairingId: string
  pairingCode: string
  routeChain: string
  isSource: boolean
  matchesFrequency: boolean
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function BulkDeletePairingDialog({ source, onClose }: BulkDeletePairingDialogProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const pairings = usePairingStore((s) => s.pairings)
  const removePairing = usePairingStore((s) => s.removePairing)
  const setError = usePairingStore((s) => s.setError)

  // ── Find all pairings that share the same pattern as source ──────────
  // Match on pairingCode first; fall back to routeChain for code-less pairings.
  const candidates = useMemo<DeleteRow[]>(() => {
    const matched = pairings.filter(
      (p) => p.id === source.id || (p.pairingCode === source.pairingCode && p.routeChain === source.routeChain),
    )

    return matched.map((p) => {
      const jsDow = new Date(`${p.startDate}T00:00:00Z`).getUTCDay()
      const weekday = (jsDow + 6) % 7
      return {
        date: p.startDate,
        weekday,
        pairingId: p.id,
        pairingCode: p.pairingCode,
        routeChain: p.routeChain,
        isSource: p.id === source.id,
        // Frequency hint: does the source weekday bitmask include this day?
        matchesFrequency: false, // computed below
      }
    })
  }, [pairings, source.id, source.pairingCode, source.routeChain])

  // Build weekday presence from matched pairings to power the frequency chips.
  const weekdayRows = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7].map((n) => {
      const wd = n - 1
      const rows = candidates.filter((r) => r.weekday === wd)
      return { n, count: rows.length }
    })
  }, [candidates])

  // Tag matchesFrequency — true when ≥2 weeks have an instance on that weekday
  // (indicates it's a recurring pattern, not a one-off).
  const rowsWithFreq: DeleteRow[] = useMemo(() => {
    const recurringWds = new Set(weekdayRows.filter((w) => w.count >= 2).map((w) => w.n - 1))
    return candidates
      .map((r) => ({ ...r, matchesFrequency: recurringWds.has(r.weekday) }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [candidates, weekdayRows])

  // ── Selection state — default: all selected ───────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(rowsWithFreq.map((r) => r.pairingId)))
  useEffect(() => {
    setSelectedIds(new Set(rowsWithFreq.map((r) => r.pairingId)))
  }, [rowsWithFreq.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleId = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleWeekday = (ssimDay: number) => {
    const wd = ssimDay - 1
    const dayRows = rowsWithFreq.filter((r) => r.weekday === wd)
    const allSelected = dayRows.every((r) => selectedIds.has(r.pairingId))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of dayRows) {
        if (allSelected) next.delete(r.pairingId)
        else next.add(r.pairingId)
      }
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(rowsWithFreq.map((r) => r.pairingId)))
  const clearSelection = () => setSelectedIds(new Set())

  const weekdayChipState = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7].map((n) => {
        const wd = n - 1
        const rows = rowsWithFreq.filter((r) => r.weekday === wd)
        const selected = rows.filter((r) => selectedIds.has(r.pairingId))
        return { n, total: rows.length, selected: selected.length }
      }),
    [rowsWithFreq, selectedIds],
  )

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Execute bulk delete ───────────────────────────────────────────────
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })

  const runDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setRunning(true)
    setProgress({ done: 0, total: ids.length, failed: 0 })
    setError(null)
    try {
      const { deletedCount } = await api.bulkDeletePairings(ids)
      for (const id of ids) removePairing(id)
      setProgress({ done: deletedCount, total: ids.length, failed: ids.length - deletedCount })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed')
      setProgress({ done: 0, total: ids.length, failed: ids.length })
    } finally {
      setRunning(false)
      onClose()
    }
  }

  // ── Styling ──────────────────────────────────────────────────────────
  const panelBg = isDark ? 'rgba(25,25,33,0.98)' : 'rgba(255,255,255,0.99)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? '#F5F2FD' : '#1C1C28'
  const textSecondary = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(71,85,105,0.85)'
  const textMuted = isDark ? '#8F90A6' : '#555770'
  const danger = '#E63535'

  const selectedCount = selectedIds.size
  const total = rowsWithFreq.length

  return createPortal(
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center p-6"
      style={{
        background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) onClose()
      }}
    >
      <div
        className="w-full max-w-[720px] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(96,97,112,0.25)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${panelBorder}` }}>
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 40, height: 40, background: `${danger}18`, color: danger }}
          >
            <Trash2 size={20} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold tracking-tight" style={{ color: textPrimary }}>
              Bulk Delete {source.pairingCode} across period
            </h3>
            <p className="text-[12px] mt-0.5 tabular-nums truncate" style={{ color: textSecondary }}>
              Pattern: {source.routeChain} · {source.legs.length} legs · {source.pairingDays}d base
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="p-1 rounded-md transition-colors hover:bg-black/10 disabled:opacity-40"
            style={{ color: textMuted }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Frequency picker */}
        <div
          className="flex items-center gap-3 px-5 py-2.5 shrink-0"
          style={{ borderBottom: `1px solid ${panelBorder}` }}
        >
          <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: textMuted }}>
            Frequency
          </span>
          <div className="inline-flex items-center gap-[3px]">
            {weekdayChipState.map((s) => {
              const enabled = s.total > 0
              const full = enabled && s.selected === s.total
              const partial = enabled && s.selected > 0 && s.selected < s.total
              const label = WEEKDAYS[s.n - 1]
              const bg = full
                ? danger
                : partial
                  ? 'transparent'
                  : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(15,23,42,0.04)'
              const color = full
                ? '#fff'
                : partial
                  ? danger
                  : enabled
                    ? isDark
                      ? 'rgba(255,255,255,0.55)'
                      : 'rgba(15,23,42,0.55)'
                    : isDark
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(15,23,42,0.22)'
              const border = partial ? `1.5px solid ${danger}` : '1.5px solid transparent'
              const tip = enabled ? `${label} — ${s.selected}/${s.total} selected` : `${label} — no instances in period`
              return (
                <Tooltip key={s.n} content={tip}>
                  <button
                    type="button"
                    onClick={() => toggleWeekday(s.n)}
                    disabled={running || !enabled}
                    className="inline-flex items-center justify-center rounded-[5px] tabular-nums transition-all hover:brightness-110 active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      width: 22,
                      height: 22,
                      fontSize: 12,
                      fontWeight: 700,
                      background: bg,
                      color,
                      border,
                      boxSizing: 'border-box',
                    }}
                  >
                    {s.n}
                  </button>
                </Tooltip>
              )
            })}
          </div>
          <span className="flex-1" />
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: textMuted }}>
            {total} instance{total === 1 ? '' : 's'} found
          </span>
        </div>

        {/* Date list */}
        <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
          <table className="w-full text-[12px] tabular-nums" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, background: panelBg, zIndex: 1 }}>
              <tr style={{ height: 28 }}>
                <Th isDark={isDark}>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    disabled={running || total === 0}
                    checked={total > 0 && selectedCount === total}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedCount > 0 && selectedCount < total
                    }}
                    onChange={(e) => {
                      if (e.target.checked) selectAll()
                      else clearSelection()
                    }}
                    style={{ accentColor: danger, cursor: running || total === 0 ? 'not-allowed' : 'pointer' }}
                  />
                </Th>
                <Th isDark={isDark}>Date</Th>
                <Th isDark={isDark}>Day</Th>
                <Th isDark={isDark}>Route</Th>
                <Th isDark={isDark}>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rowsWithFreq.map((row) => {
                const checked = selectedIds.has(row.pairingId)
                return (
                  <tr
                    key={row.pairingId}
                    style={{
                      height: 28,
                      background: row.isSource
                        ? isDark
                          ? `${danger}18`
                          : `${danger}0C`
                        : checked
                          ? isDark
                            ? `${danger}0A`
                            : `${danger}06`
                          : 'transparent',
                      borderBottom: `1px solid ${panelBorder}`,
                    }}
                  >
                    <Td isDark={isDark}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={running}
                        onChange={() => toggleId(row.pairingId)}
                        style={{ accentColor: danger }}
                      />
                    </Td>
                    <Td isDark={isDark}>
                      <span style={{ color: textPrimary, fontWeight: row.isSource ? 700 : 500 }}>
                        {formatDMY(row.date)}
                      </span>
                    </Td>
                    <Td isDark={isDark}>
                      <span style={{ color: textSecondary }}>{WEEKDAYS[row.weekday]}</span>
                    </Td>
                    <Td isDark={isDark}>
                      <span
                        className="truncate"
                        style={{ color: textSecondary, maxWidth: 180, display: 'inline-block' }}
                      >
                        {row.routeChain}
                      </span>
                    </Td>
                    <Td isDark={isDark}>
                      {row.isSource ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-bold"
                          style={{ background: `${danger}18`, color: danger, border: `1px solid ${danger}33` }}
                        >
                          Source
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-bold"
                          style={{ background: `${danger}12`, color: danger, border: `1px solid ${danger}28` }}
                        >
                          Match
                        </span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{
            borderTop: `1px solid ${panelBorder}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
          }}
        >
          <div className="flex items-center gap-2 text-[12px]" style={{ color: textSecondary }}>
            <CalendarDays size={14} strokeWidth={2} style={{ color: textMuted }} />
            <span>
              Will permanently delete{' '}
              <strong style={{ color: danger }}>
                {selectedCount} pairing{selectedCount === 1 ? '' : 's'}
              </strong>
            </span>
          </div>
          <span className="flex-1" />

          {running && (
            <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: danger }}>
              <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
              {progress.done} / {progress.total}
              {progress.failed > 0 && <span style={{ color: '#FF3B3B' }}>· {progress.failed} failed</span>}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
              color: textPrimary,
              border: `1px solid ${panelBorder}`,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={runDelete}
            disabled={running || selectedCount === 0}
            className="h-9 px-4 rounded-lg text-[13px] font-bold transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: danger, color: '#fff', boxShadow: `0 4px 14px ${danger}55` }}
          >
            <Trash2 size={14} strokeWidth={2.2} />
            Bulk Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Table helpers ────────────────────────────────────────────────────────
function Th({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <th
      className="text-left px-2"
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: isDark ? '#8F90A6' : '#555770',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <td
      className="px-2"
      style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}` }}
    >
      {children}
    </td>
  )
}

function formatDMY(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}
