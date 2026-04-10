"use client"

import { useState, useMemo, useCallback } from 'react'
import {
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Eye, X, FileText, ArrowRight,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useScheduleMessagingStore } from '@/stores/use-schedule-messaging-store'
import { ACTION_LABELS } from '@skyhub/logic'
import type { ScheduleMessageRef } from '@skyhub/api'

type SortKey = 'createdAtUtc' | 'flightNumber' | 'flightDate' | 'actionCode' | 'status'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  held:       { bg: 'rgba(255,136,0,0.15)', text: '#FF8800' },
  pending:    { bg: 'rgba(0,99,247,0.12)',  text: '#0063F7' },
  sent:       { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  applied:    { bg: 'rgba(6,194,112,0.12)', text: '#06C270' },
  rejected:   { bg: 'rgba(255,59,59,0.12)', text: '#FF3B3B' },
  discarded:  { bg: 'rgba(85,87,112,0.15)', text: '#555770' },
  neutralized:{ bg: 'rgba(85,87,112,0.10)', text: '#555770' },
}

const ACTION_COLORS: Record<string, string> = {
  NEW: '#06C270', CNL: '#FF3B3B', TIM: '#0063F7', EQT: '#FF8800',
  RRT: '#FF8800', RIN: '#06C270', RPL: '#0063F7', FLT: '#0063F7',
  SKD: '#0063F7', CON: '#FF8800',
}

const FIELD_LABELS: Record<string, string> = {
  dep_station: 'Departure', arr_station: 'Arrival',
  std: 'STD (UTC)', sta: 'STA (UTC)',
  aircraft_type: 'Aircraft Type', service_type: 'Service Type',
}

export function MessageLogTable() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const messages = useScheduleMessagingStore(s => s.messages)
  const totalCount = useScheduleMessagingStore(s => s.totalCount)
  const page = useScheduleMessagingStore(s => s.page)
  const pageSize = useScheduleMessagingStore(s => s.pageSize)
  const setPage = useScheduleMessagingStore(s => s.setPage)
  const loadMessages = useScheduleMessagingStore(s => s.loadMessages)
  const loading = useScheduleMessagingStore(s => s.loading)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAtUtc')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMsg, setViewMsg] = useState<ScheduleMessageRef | null>(null)

  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const rowHover = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'

  const filtered = useMemo(() => {
    if (!search.trim()) return messages
    const q = search.toLowerCase()
    return messages.filter(m =>
      (m.flightNumber || '').toLowerCase().includes(q) ||
      (m.summary || '').toLowerCase().includes(q) ||
      (m.actionCode || '').toLowerCase().includes(q) ||
      (m.status || '').toLowerCase().includes(q)
    )
  }, [messages, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = (a[sortKey] ?? '') as string
      const vb = (b[sortKey] ?? '') as string
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const handlePrev = useCallback(() => {
    if (page > 1) { setPage(page - 1); loadMessages() }
  }, [page, setPage, loadMessages])
  const handleNext = useCallback(() => {
    if (page < totalPages) { setPage(page + 1); loadMessages() }
  }, [page, totalPages, setPage, loadMessages])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5" style={{ height: 44, borderBottom: `1px solid ${sectionBorder}` }}>
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-module-accent" />
          <span className="text-[14px] font-bold">Message Log</span>
          <span className="text-[13px] text-hz-text-tertiary font-medium">{totalCount} messages</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hz-text-tertiary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="h-8 pl-8 pr-3 rounded-lg text-[13px] outline-none w-56"
            style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-hz-card">
            <tr style={{ borderBottom: `1px solid ${sectionBorder}` }}>
              <SortHeader label="Date" sortKey="createdAtUtc" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">Dir</th>
              <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">Type</th>
              <SortHeader label="Action" sortKey="actionCode" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Flight" sortKey="flightNumber" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Flt Date" sortKey="flightDate" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase">Summary</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, idx) => (
              <tr
                key={m._id}
                className="transition-colors"
                style={{
                  borderBottom: `1px solid ${sectionBorder}`,
                  background: idx % 2 === 1 ? rowHover : undefined,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = rowHover }}
                onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 1 ? rowHover : 'transparent' }}
              >
                <td className="px-3 py-2.5 text-[13px] text-hz-text-secondary font-mono whitespace-nowrap">
                  {formatDate(m.createdAtUtc)}
                </td>
                <td className="px-3 py-2.5">
                  <DirectionBadge dir={m.direction} />
                </td>
                <td className="px-3 py-2.5 text-[13px] font-medium">{m.messageType}</td>
                <td className="px-3 py-2.5">
                  <ActionBadge code={m.actionCode} />
                </td>
                <td className="px-3 py-2.5 text-[13px] font-mono font-semibold">{m.flightNumber || '\u2014'}</td>
                <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text-secondary">{m.flightDate || '\u2014'}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={m.status} />
                </td>
                <td className="px-3 py-2.5 text-[13px] text-hz-text-secondary truncate max-w-[260px]">
                  {m.summary || '\u2014'}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => setViewMsg(m)}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-hz-border/30 transition-colors"
                  >
                    <Eye size={14} className="text-hz-text-tertiary" />
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-[13px] text-hz-text-tertiary">
                  {search ? 'No messages match your search' : 'No messages found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="shrink-0 flex items-center justify-between px-5"
          style={{ height: 44, borderTop: `1px solid ${sectionBorder}` }}
        >
          <span className="text-[13px] text-hz-text-tertiary">
            Showing {(page - 1) * pageSize + 1}\u2013{Math.min(page * pageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={page <= 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-hz-border/30 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-semibold px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={page >= totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-hz-border/30 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* View dialog (overlay) */}
      {viewMsg && <ViewDialog msg={viewMsg} onClose={() => setViewMsg(null)} isDark={isDark} />}
    </div>
  )
}

// ── View Dialog ───────────────────────────────────────────

function ViewDialog({ msg, onClose, isDark }: { msg: ScheduleMessageRef; onClose: () => void; isDark: boolean }) {
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.98)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          backdropFilter: 'blur(24px)',
          boxShadow: '0 20px 60px rgba(96,97,112,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 shrink-0" style={{ height: 52, borderBottom: `1px solid ${sectionBorder}` }}>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-bold">Message Detail</span>
            <StatusBadge status={msg.status} />
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-hz-border/30 transition-colors">
            <X size={16} className="text-hz-text-tertiary" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <DField label="Type" value={msg.messageType} />
            <DField label="Action" value={`${msg.actionCode} \u2014 ${ACTION_LABELS[msg.actionCode] || ''}`} />
            <DField label="Direction" value={msg.direction} />
            <DField label="Flight" value={msg.flightNumber || '\u2014'} />
            <DField label="Flight Date" value={msg.flightDate || '\u2014'} />
            <DField label="Status" value={msg.status} />
            <DField label="Created" value={formatDate(msg.createdAtUtc)} />
            <DField label="Processed" value={msg.processedAtUtc ? formatDate(msg.processedAtUtc) : '\u2014'} />
            {msg.depStation && <DField label="Route" value={`${msg.depStation} \u2192 ${msg.arrStation || ''}`} />}
          </div>

          {msg.summary && (
            <div>
              <span className="text-[13px] text-hz-text-tertiary font-medium block mb-1">Summary</span>
              <p className="text-[13px]">{msg.summary}</p>
            </div>
          )}

          {msg.changes && Object.keys(msg.changes).length > 0 && (
            <div>
              <span className="text-[13px] text-hz-text-tertiary font-medium block mb-1">Changes</span>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${inputBorder}` }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${sectionBorder}` }}>
                      <th className="text-left px-3 py-1.5 text-[13px] font-medium text-hz-text-tertiary uppercase">Field</th>
                      <th className="text-left px-3 py-1.5 text-[13px] font-medium text-hz-text-tertiary uppercase">From</th>
                      <th className="w-6" />
                      <th className="text-left px-3 py-1.5 text-[13px] font-medium text-hz-text-tertiary uppercase">To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(msg.changes).map(([field, ch]) => (
                      <tr key={field} style={{ borderBottom: `1px solid ${sectionBorder}` }}>
                        <td className="px-3 py-1.5 text-[13px] font-medium">{FIELD_LABELS[field] || field}</td>
                        <td className="px-3 py-1.5 text-[13px] font-mono text-hz-text-secondary">{ch.from || '\u2014'}</td>
                        <td className="px-1 py-1.5 text-center"><ArrowRight size={12} className="text-hz-text-tertiary" /></td>
                        <td className="px-3 py-1.5 text-[13px] font-mono font-semibold">{ch.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {msg.rawMessage && (
            <div>
              <span className="text-[13px] text-hz-text-tertiary font-medium block mb-1">Raw IATA Message</span>
              <pre
                className="rounded-xl px-4 py-3 text-[13px] font-mono whitespace-pre-wrap"
                style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
              >
                {msg.rawMessage}
              </pre>
            </div>
          )}

          {msg.rejectReason && (
            <div>
              <span className="text-[13px] text-hz-text-tertiary font-medium block mb-1">Reject Reason</span>
              <p className="text-[13px] text-[#FF3B3B]">{msg.rejectReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────

function DField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[13px] text-hz-text-tertiary font-medium block">{label}</span>
      <span className="text-[13px] font-semibold">{value}</span>
    </div>
  )
}

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      className="text-left px-3 py-2 text-[13px] font-medium text-hz-text-tertiary uppercase cursor-pointer select-none hover:text-hz-text-primary transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.discarded
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[13px] font-bold capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {status}
    </span>
  )
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

function DirectionBadge({ dir }: { dir: string }) {
  const isIn = dir === 'inbound'
  return (
    <span className={`text-[13px] font-medium ${isIn ? 'text-[#0063F7]' : 'text-[#FF8800]'}`}>
      {isIn ? 'IN' : 'OUT'}
    </span>
  )
}

function formatDate(iso: string): string {
  if (!iso) return '\u2014'
  try {
    const d = new Date(iso)
    const month = d.toLocaleString('en', { month: 'short' })
    const day = d.getDate()
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return `${day} ${month} ${hh}:${mm}Z`
  } catch {
    return iso.slice(0, 16)
  }
}
