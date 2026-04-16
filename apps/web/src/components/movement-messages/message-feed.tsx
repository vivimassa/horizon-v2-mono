'use client'

import { memo } from 'react'
import type { MovementMessageRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'

interface Props {
  messages: MovementMessageRef[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  searchText: string
  accentColor: string
  checkedIds: Set<string>
  onToggleCheck: (id: string) => void
  onCheckAll: () => void
  onClearCheck: () => void
}

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  MVT: { bg: 'rgba(6,194,112,0.12)', fg: '#06C270' },
  LDM: { bg: 'rgba(0,99,247,0.12)', fg: '#0063F7' },
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  held: { bg: 'rgba(255,136,0,0.14)', fg: '#FF8800' },
  pending: { bg: 'rgba(253,221,72,0.18)', fg: '#C99400' },
  sent: { bg: 'rgba(0,99,247,0.14)', fg: '#0063F7' },
  applied: { bg: 'rgba(6,194,112,0.14)', fg: '#06C270' },
  failed: { bg: 'rgba(255,59,59,0.14)', fg: '#FF3B3B' },
  rejected: { bg: 'rgba(255,59,59,0.14)', fg: '#FF3B3B' },
  discarded: { bg: 'rgba(96,97,112,0.14)', fg: '#606170' },
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().slice(11, 16) + 'z'
  } catch {
    return '--:--'
  }
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? { bg: 'rgba(96,97,112,0.12)', fg: '#606170' }
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold"
      style={{ background: c.bg, color: c.fg }}
    >
      {type}
    </span>
  )
}

function DirectionBadge({ direction, accentColor }: { direction: string; accentColor: string }) {
  const inbound = direction === 'inbound'
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold"
      style={
        inbound
          ? { background: 'rgba(0,99,247,0.12)', color: '#0063F7' }
          : { background: `${accentColor}1A`, color: accentColor }
      }
    >
      {inbound ? 'IN' : 'OUT'}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: 'rgba(96,97,112,0.12)', fg: '#606170' }
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-md text-[13px] font-semibold capitalize"
      style={{ background: c.bg, color: c.fg }}
    >
      {status}
    </span>
  )
}

const Row = memo(function Row({
  msg,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  accentColor,
  rowBg,
  borderColor,
}: {
  msg: MovementMessageRef
  selected: boolean
  checked: boolean
  onSelect: (id: string | null) => void
  onToggleCheck: (id: string) => void
  accentColor: string
  rowBg: string
  borderColor: string
}) {
  const highlightBg = selected || checked ? `${accentColor}${selected && checked ? '1A' : '0F'}` : rowBg
  return (
    <tr
      onClick={() => onSelect(selected ? null : msg._id)}
      className="cursor-pointer transition-colors duration-150"
      style={{
        background: highlightBg,
        borderBottom: `1px solid ${borderColor}`,
      }}
    >
      <td
        className="px-3 py-2 w-[36px]"
        onClick={(e) => {
          e.stopPropagation()
          onToggleCheck(msg._id)
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleCheck(msg._id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${msg.flightNumber ?? 'message'}`}
          className="w-3.5 h-3.5 cursor-pointer"
          style={{ accentColor }}
        />
      </td>
      <td className="px-3 py-2 text-[13px] font-mono text-hz-text-secondary">{formatTime(msg.createdAtUtc)}</td>
      <td className="px-2 py-2">
        <TypeBadge type={msg.messageType} />
      </td>
      <td className="px-2 py-2">
        <DirectionBadge direction={msg.direction} accentColor={accentColor} />
      </td>
      <td className="px-2 py-2 text-[13px] font-mono font-semibold text-hz-text">{msg.actionCode}</td>
      <td className="px-2 py-2 text-[13px] font-semibold text-hz-text">{msg.flightNumber ?? '—'}</td>
      <td className="px-2 py-2 text-[13px] font-mono text-hz-text-secondary">
        {msg.depStation && msg.arrStation
          ? `${msg.depStation}-${msg.arrStation}`
          : (msg.depStation ?? msg.arrStation ?? '—')}
      </td>
      <td className="px-2 py-2 text-[13px] text-hz-text-secondary truncate max-w-0">{msg.summary ?? '—'}</td>
      <td className="px-2 py-2">
        <StatusBadge status={msg.status} />
      </td>
    </tr>
  )
})

export function MessageFeed({
  messages,
  selectedId,
  onSelect,
  searchText,
  accentColor,
  checkedIds,
  onToggleCheck,
  onCheckAll,
  onClearCheck,
}: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const headerBg = isDark ? '#191921' : '#F2F2F5'
  const borderColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const altRow = isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.015)'

  const filtered = searchText
    ? messages.filter((m) => {
        const t = searchText.toLowerCase()
        return (
          m.flightNumber?.toLowerCase().includes(t) ||
          m.summary?.toLowerCase().includes(t) ||
          m.depStation?.toLowerCase().includes(t) ||
          m.arrStation?.toLowerCase().includes(t) ||
          m.actionCode.toLowerCase().includes(t) ||
          m.messageType.toLowerCase().includes(t)
        )
      })
    : messages

  const checkedInView = filtered.filter((m) => checkedIds.has(m._id)).length
  const allChecked = filtered.length > 0 && checkedInView === filtered.length
  const someChecked = checkedInView > 0 && !allChecked

  const headerCheckboxRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = someChecked
  }

  return (
    <div className="flex-1 overflow-auto custom-scrollbar min-w-0">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10" style={{ background: headerBg }}>
          <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
            <Th style={{ width: 36 }}>
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allChecked}
                onChange={() => (allChecked ? onClearCheck() : onCheckAll())}
                aria-label={allChecked ? 'Clear selection' : 'Select all visible messages'}
                disabled={filtered.length === 0}
                className="w-3.5 h-3.5 cursor-pointer align-middle"
                style={{ accentColor }}
              />
            </Th>
            <Th style={{ width: 72 }}>Time</Th>
            <Th style={{ width: 70 }}>Type</Th>
            <Th style={{ width: 60 }}>Dir</Th>
            <Th style={{ width: 60 }}>Action</Th>
            <Th style={{ width: 92 }}>Flight</Th>
            <Th style={{ width: 96 }}>Route</Th>
            <Th>Summary</Th>
            <Th style={{ width: 92 }}>Status</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-16 text-[14px] text-hz-text-tertiary">
                No messages match the current filters
              </td>
            </tr>
          ) : (
            filtered.map((m, idx) => (
              <Row
                key={m._id}
                msg={m}
                selected={m._id === selectedId}
                checked={checkedIds.has(m._id)}
                onSelect={onSelect}
                onToggleCheck={onToggleCheck}
                accentColor={accentColor}
                rowBg={idx % 2 === 0 ? 'transparent' : altRow}
                borderColor={borderColor}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      className="text-left text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary px-2 py-2"
      style={style}
    >
      {children}
    </th>
  )
}
