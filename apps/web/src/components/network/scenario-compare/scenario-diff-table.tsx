'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Minus, Pencil, Search } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { SegmentedField } from '@/components/filter-panel'
import type { ScenarioRef } from '@skyhub/api'
import type { ChangeField, DiffRow, DiffStatus } from './scenario-compare-types'
import { CHANGE_FIELD_ACTION } from './scenario-compare-types'

interface ScenarioDiffTableProps {
  rows: DiffRow[]
  scenarios: ScenarioRef[]
}

type FilterKey = 'all' | 'added' | 'removed' | 'modified' | 'unchanged'
type SortKey = 'flightNumber' | 'route' | 'status'
type SortDir = 'asc' | 'desc'

const LETTERS = ['A', 'B', 'C'] as const

const STATUS_STYLE: Record<
  DiffStatus,
  { bg: string; fg: string; border: string; label: string; icon: 'plus' | 'minus' | 'pencil' | null }
> = {
  added: { bg: 'rgba(22,163,74,0.14)', fg: '#16a34a', border: 'rgba(22,163,74,0.65)', label: 'Added', icon: 'plus' },
  removed: {
    bg: 'rgba(220,38,38,0.14)',
    fg: '#dc2626',
    border: 'rgba(220,38,38,0.65)',
    label: 'Removed',
    icon: 'minus',
  },
  modified: {
    bg: 'rgba(255,136,0,0.16)',
    fg: '#d97706',
    border: 'rgba(255,136,0,0.65)',
    label: 'Modified',
    icon: 'pencil',
  },
  unchanged: {
    bg: 'rgba(125,125,140,0.12)',
    fg: '#8E8E93',
    border: 'rgba(125,125,140,0.25)',
    label: 'Unchanged',
    icon: null,
  },
}

function StatusBadge({ status }: { status: DiffStatus }) {
  const s = STATUS_STYLE[status]
  const icon =
    s.icon === 'plus' ? (
      <Plus size={12} strokeWidth={2.5} />
    ) : s.icon === 'minus' ? (
      <Minus size={12} strokeWidth={2.5} />
    ) : s.icon === 'pencil' ? (
      <Pencil size={12} strokeWidth={2.5} />
    ) : null
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[13px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {icon}
      {s.label}
    </span>
  )
}

function dayLetters(dow: string): string[] {
  // Input like "1234567" or "SMTWTFS" — normalise to SMTWTFS with active/inactive.
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const active = new Set<number>()
  for (const ch of dow) {
    const n = parseInt(ch, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= 7) active.add(n % 7)
  }
  if (active.size === 0) {
    const letterSet = new Set(dow.toUpperCase().split(''))
    return letters.map((l, i) => (letterSet.has(l) ? letters[i] : '·'))
  }
  return letters.map((_, i) => (active.has(i) ? letters[i] : '·'))
}

export function ScenarioDiffTable({ rows, scenarios }: ScenarioDiffTableProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: rows.length, added: 0, removed: 0, modified: 0, unchanged: 0 }
    for (const r of rows) c[r.overallStatus] += 1
    return c
  }, [rows])

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows
    if (filter !== 'all') out = out.filter((r) => r.overallStatus === filter)
    if (filter === 'all') out = out.filter((r) => r.overallStatus !== 'unchanged')
    if (q) {
      out = out.filter(
        (r) =>
          r.flightNumber.toLowerCase().includes(q) ||
          r.depStation.toLowerCase().includes(q) ||
          r.arrStation.toLowerCase().includes(q) ||
          `${r.depStation}-${r.arrStation}`.toLowerCase().includes(q),
      )
    }
    const sorted = [...out]
    const dir = sortDir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      if (sortKey === 'flightNumber') return a.flightNumber.localeCompare(b.flightNumber) * dir
      if (sortKey === 'route')
        return `${a.depStation}-${a.arrStation}`.localeCompare(`${b.depStation}-${b.arrStation}`) * dir
      const rank: Record<DiffStatus, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 }
      return (rank[a.overallStatus] - rank[b.overallStatus]) * dir
    })
    return sorted
  }, [rows, filter, query, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: 'all', label: `All (${counts.added + counts.removed + counts.modified})` },
    { key: 'added', label: `+ Added (${counts.added})` },
    { key: 'removed', label: `− Removed (${counts.removed})` },
    { key: 'modified', label: `~ Modified (${counts.modified})` },
    { key: 'unchanged', label: `= Unchanged (${counts.unchanged})` },
  ]

  const toolbarBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const headerBg = isDark ? 'rgba(25,25,33,0.95)' : 'rgba(255,255,255,0.95)'
  const rowBorder = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const cellTintBg = isDark ? 'rgba(255,136,0,0.10)' : 'rgba(255,136,0,0.14)'

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 h-14"
        style={{ borderBottom: `1px solid ${toolbarBorder}` }}
      >
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-hz-text-tertiary pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search flight or route"
            className="w-56 h-9 pl-8 pr-3 rounded-xl text-[13px] outline-none text-hz-text placeholder:text-hz-text-tertiary"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'}`,
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <SegmentedField options={filterOptions} value={filter} onChange={(v) => setFilter(v as FilterKey)} />
        </div>
        <span className="shrink-0 text-[13px] font-medium text-hz-text-secondary tabular-nums">
          {visibleRows.length} {visibleRows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {visibleRows.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[13px] text-hz-text-tertiary">
              {rows.length === 0 ? 'No flights in the selected period.' : 'No rows match this filter.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-[13px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10" style={{ background: headerBg, backdropFilter: 'blur(8px)' }}>
              <tr>
                <HeaderCell
                  label="Status"
                  width={108}
                  sortKey="status"
                  current={sortKey}
                  dir={sortDir}
                  onSort={() => toggleSort('status')}
                />
                <HeaderCell
                  label="Flight"
                  width={96}
                  sortKey="flightNumber"
                  current={sortKey}
                  dir={sortDir}
                  onSort={() => toggleSort('flightNumber')}
                />
                <HeaderCell
                  label="Route"
                  width={120}
                  sortKey="route"
                  current={sortKey}
                  dir={sortDir}
                  onSort={() => toggleSort('route')}
                />
                {scenarios.map((s, idx) => (
                  <ScenarioHeader key={s._id} letter={LETTERS[idx] ?? '?'} name={s.name} />
                ))}
                <HeaderPlain label="Changes" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <DiffTableRow
                  key={row.key}
                  row={row}
                  scenarios={scenarios}
                  rowBorder={rowBorder}
                  cellTintBg={cellTintBg}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function HeaderCell({
  label,
  width,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string
  width: number
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: () => void
}) {
  const active = sortKey === current
  return (
    <th
      className="text-left px-3 h-10 text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap"
      style={{ width, minWidth: width }}
    >
      <button
        type="button"
        onClick={onSort}
        className="inline-flex items-center gap-1 hover:text-hz-text transition-colors"
      >
        {label}
        {active && (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )
}

function HeaderPlain({ label }: { label: string }) {
  return (
    <th className="text-left px-3 h-10 text-[12px] font-semibold uppercase tracking-wider text-hz-text-tertiary whitespace-nowrap">
      {label}
    </th>
  )
}

function ScenarioHeader({ letter, name }: { letter: string; name: string }) {
  return (
    <th className="text-left px-3 h-10 whitespace-nowrap align-middle" style={{ minWidth: 220 }} colSpan={1}>
      <div className="flex items-center gap-2">
        <span
          className="px-1.5 rounded text-[13px] font-bold text-white bg-module-accent tracking-wider"
          aria-label={`Scenario ${letter}`}
        >
          {letter}
        </span>
        <span className="text-[13px] font-semibold text-hz-text truncate max-w-[160px]" title={name}>
          {name}
        </span>
      </div>
    </th>
  )
}

function DiffTableRow({
  row,
  scenarios,
  rowBorder,
  cellTintBg,
}: {
  row: DiffRow
  scenarios: ScenarioRef[]
  rowBorder: string
  cellTintBg: string
}) {
  const style = STATUS_STYLE[row.overallStatus]
  const rowBg =
    row.overallStatus === 'added'
      ? 'rgba(22,163,74,0.05)'
      : row.overallStatus === 'removed'
        ? 'rgba(220,38,38,0.05)'
        : row.overallStatus === 'modified'
          ? 'rgba(255,136,0,0.04)'
          : 'transparent'

  return (
    <tr
      style={{
        background: rowBg,
        borderBottom: `1px solid ${rowBorder}`,
      }}
    >
      <td className="px-3 py-2 align-top" style={{ borderLeft: `3px solid ${style.border}` }}>
        <StatusBadge status={row.overallStatus} />
      </td>
      <td className="px-3 py-2 font-bold tabular-nums text-hz-text align-top">{row.flightNumber}</td>
      <td className="px-3 py-2 text-hz-text align-top">
        <span className="font-mono">
          {row.depStation} → {row.arrStation}
        </span>
      </td>
      {scenarios.map((s) => {
        const cell = row.perScenario.find((c) => c.scenarioId === s._id)
        return <ScenarioCell key={s._id} cell={cell ?? null} tintBg={cellTintBg} />
      })}
      <td className="px-3 py-2 align-top">
        <ActionCodeChips changedFields={collectChanges(row)} />
      </td>
    </tr>
  )
}

function ScenarioCell({
  cell,
  tintBg,
}: {
  cell: { snap: DiffRow['perScenario'][number]['snap']; changedFields: ChangeField[] } | null
  tintBg: string
}) {
  if (!cell || !cell.snap) {
    return (
      <td className="px-3 py-2 align-top text-hz-text-tertiary text-[13px]" style={{ minWidth: 220 }}>
        —
      </td>
    )
  }
  const changed = new Set(cell.changedFields)
  const timeChanged = changed.has('stdUtc') || changed.has('staUtc')
  const eqChanged = changed.has('aircraftTypeIcao')
  const daysChanged = changed.has('daysOfWeek')
  const snap = cell.snap

  return (
    <td className="px-3 py-2 align-top" style={{ minWidth: 220 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 font-mono text-[13px] font-semibold text-hz-text rounded px-1.5 py-0.5"
          style={{ background: timeChanged ? tintBg : 'transparent' }}
          title="STD / STA"
        >
          {snap.stdUtc} / {snap.staUtc}
        </span>
        <span
          className="text-[13px] font-semibold text-hz-text rounded px-1.5 py-0.5"
          style={{ background: eqChanged ? tintBg : 'transparent' }}
          title="Aircraft type"
        >
          {snap.aircraftTypeIcao ?? '—'}
        </span>
        <span
          className="inline-flex items-center font-mono text-[13px] tabular-nums rounded px-1.5 py-0.5"
          style={{ background: daysChanged ? tintBg : 'transparent' }}
          title="Days of week"
        >
          {dayLetters(snap.daysOfWeek).map((l, i) => (
            <span
              key={i}
              className="inline-block w-3.5 text-center"
              style={{
                color: l === '·' ? 'var(--hz-text-tertiary)' : 'var(--hz-text)',
                fontWeight: l === '·' ? 400 : 600,
              }}
            >
              {l}
            </span>
          ))}
        </span>
      </div>
    </td>
  )
}

function collectChanges(row: DiffRow): ChangeField[] {
  const set = new Set<ChangeField>()
  for (const c of row.perScenario) for (const f of c.changedFields) set.add(f)
  return [...set]
}

function ActionCodeChips({ changedFields }: { changedFields: ChangeField[] }) {
  if (changedFields.length === 0) {
    return <span className="text-[13px] text-hz-text-tertiary">—</span>
  }
  const codes = new Set<string>()
  for (const f of changedFields) codes.add(CHANGE_FIELD_ACTION[f])
  const chips: { code: string; bg: string; fg: string }[] = []
  for (const code of codes) {
    if (code === 'TIM') chips.push({ code: 'TIM', bg: 'rgba(0,99,247,0.14)', fg: '#0063F7' })
    else if (code === 'EQT') chips.push({ code: 'EQT', bg: 'rgba(217,119,6,0.16)', fg: '#d97706' })
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.code}
          className="px-1.5 py-0.5 rounded text-[13px] font-semibold"
          style={{ background: c.bg, color: c.fg }}
        >
          {c.code}
        </span>
      ))}
    </div>
  )
}
