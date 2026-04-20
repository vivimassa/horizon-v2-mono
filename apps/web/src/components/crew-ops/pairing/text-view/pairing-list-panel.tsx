'use client'

import { Fragment, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Search, CalendarDays, ChevronDown, ChevronRight, Plane, GitMerge } from 'lucide-react'
import { api } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { usePairingStore } from '@/stores/use-pairing-store'
import { PairingStatusBadge } from '../shared/pairing-status-badge'
import { PairingRowContextMenu } from './pairing-row-context-menu'
import { ReplicatePairingDialog } from '../dialogs/replicate-pairing-dialog'
import { PairingDetailsDialog } from '../dialogs/pairing-details-dialog'
import type { Pairing } from '../types'

const ACCENT = '#7c3aed' // Crew Ops workforce accent (MODULE_THEMES.workforce)

/**
 * Left pane of the Crew Pairing Text workspace. Displays saved / draft
 * pairings for the active period + applied filters, with an inline search
 * that filters by pairing code or route chain prefix.
 *
 * Clicking a row opens the pairing in the inspector panel.
 */
export function PairingListPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const pairings = usePairingStore((s) => s.pairings)
  const flights = usePairingStore((s) => s.flights)
  const filters = usePairingStore((s) => s.filters)
  const inspectedPairingId = usePairingStore((s) => s.inspectedPairingId)
  const inspectPairing = usePairingStore((s) => s.inspectPairing)
  const removePairing = usePairingStore((s) => s.removePairing)
  const setError = usePairingStore((s) => s.setError)

  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; pairing: Pairing } | null>(null)
  const [replicateSource, setReplicateSource] = useState<Pairing | null>(null)
  const [detailsPairing, setDetailsPairing] = useState<Pairing | null>(null)
  /** pairingCode set — groups currently expanded. Single-member groups render flat. */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (code: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const stats = useMemo(() => {
    const total = flights.length
    const covered = flights.filter((f) => !!f.pairingId).length
    return {
      total: pairings.length,
      legal: pairings.filter((p) => p.status === 'legal').length,
      warning: pairings.filter((p) => p.status === 'warning').length,
      violation: pairings.filter((p) => p.status === 'violation').length,
      uncovered: total - covered,
    }
  }, [pairings, flights])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pairings.filter((p) => {
      if (filters.scenarioId !== null) return true // placeholder — scenario filtering handled server-side
      if (!filters.statusFilter.includes(p.status)) return false
      if (!filters.workflowFilter.includes(p.workflowStatus)) return false
      if (filters.durations.length > 0) {
        const key = `${p.pairingDays}d` as (typeof filters.durations)[number]
        if (!filters.durations.includes(key)) return false
      }
      if (filters.baseAirports && !filters.baseAirports.includes(p.baseAirport)) return false
      if (q) {
        const hay = `${p.pairingCode} ${p.routeChain}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [pairings, filters, search])

  // Group by pairingCode so post-replicate flood (30 identical S102 rows)
  // collapses to a single expandable header. Singletons render as flat rows.
  const grouped = useMemo<PairingGroup[]>(() => {
    const byCode = new Map<string, Pairing[]>()
    for (const p of filtered) {
      const arr = byCode.get(p.pairingCode) ?? []
      arr.push(p)
      byCode.set(p.pairingCode, arr)
    }
    const groups: PairingGroup[] = []
    for (const [code, members] of byCode) {
      members.sort((a, b) => a.startDate.localeCompare(b.startDate))
      groups.push({ code, members })
    }
    // Preserve the original sort order — anchor groups by the first-seen
    // pairingCode position in `filtered`.
    const order = new Map<string, number>()
    filtered.forEach((p, i) => {
      if (!order.has(p.pairingCode)) order.set(p.pairingCode, i)
    })
    groups.sort((a, b) => (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0))
    return groups
  }, [filtered])

  // Auto-expand the group containing the currently-inspected pairing so the
  // selected row stays visible even after a replicate flooded the list.
  useEffect(() => {
    if (!inspectedPairingId) return
    const parent = pairings.find((p) => p.id === inspectedPairingId)
    if (!parent) return
    setExpandedGroups((prev) => {
      if (prev.has(parent.pairingCode)) return prev
      const next = new Set(prev)
      next.add(parent.pairingCode)
      return next
    })
  }, [inspectedPairingId, pairings])

  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  const searchBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${divider}` }}>
        <div className="w-0.5 h-4 rounded-full" style={{ background: ACCENT }} />
        <div className="flex items-baseline gap-2">
          <h3 className="text-[14px] font-bold tracking-tight" style={{ color: textPrimary }}>
            Pairings
          </h3>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: textTertiary }}>
            {filtered.length} / {pairings.length}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div
          className="flex items-center gap-2 h-9 px-3 rounded-lg"
          style={{
            background: searchBg,
            border: `1px solid ${divider}`,
          }}
        >
          <Search size={14} strokeWidth={2} style={{ color: textTertiary }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or route…"
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: textPrimary }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-[11px] font-semibold tracking-wide"
              style={{ color: textSecondary }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-auto px-2 py-2 space-y-1.5">
        {filtered.length === 0 ? (
          <InlineEmptyState
            icon={GitMerge}
            title={pairings.length === 0 ? 'No pairings yet' : 'No pairings match'}
            description={
              pairings.length === 0
                ? 'Drag-select flights in the Flight Pool and right-click to create one.'
                : 'Try widening the status, workflow, or duration filters.'
            }
            isDark={isDark}
          />
        ) : (
          grouped.map((g) => {
            if (g.members.length === 1) {
              const p = g.members[0]
              return (
                <PairingRow
                  key={p.id}
                  pairing={p}
                  active={p.id === inspectedPairingId}
                  onClick={() => inspectPairing(p.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, pairing: p })
                  }}
                  isDark={isDark}
                />
              )
            }
            const expanded = expandedGroups.has(g.code)
            return (
              <Fragment key={g.code}>
                <PairingGroupHeader
                  group={g}
                  expanded={expanded}
                  onToggle={() => toggleGroup(g.code)}
                  onContextMenu={(e, p) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, pairing: p })
                  }}
                  isDark={isDark}
                />
                {expanded &&
                  g.members.map((p) => (
                    <div key={p.id} className="pl-3">
                      <PairingRow
                        pairing={p}
                        active={p.id === inspectedPairingId}
                        compact
                        onClick={() => inspectPairing(p.id)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setMenu({ x: e.clientX, y: e.clientY, pairing: p })
                        }}
                        isDark={isDark}
                      />
                    </div>
                  ))}
              </Fragment>
            )
          })
        )}
      </div>

      {menu && (
        <PairingRowContextMenu
          x={menu.x}
          y={menu.y}
          pairingCode={menu.pairing.pairingCode}
          isDraft={menu.pairing.workflowStatus === 'draft'}
          onClose={() => setMenu(null)}
          onShowDetails={() => setDetailsPairing(menu.pairing)}
          onReplicate={() => setReplicateSource(menu.pairing)}
          onInspect={() => inspectPairing(menu.pairing.id)}
          onDelete={async () => {
            const p = menu.pairing
            if (!confirm(`Delete pairing ${p.pairingCode}? This cannot be undone.`)) return
            try {
              await api.deletePairing(p.id)
              removePairing(p.id)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete pairing')
            }
          }}
        />
      )}

      {replicateSource && <ReplicatePairingDialog source={replicateSource} onClose={() => setReplicateSource(null)} />}

      {detailsPairing && <PairingDetailsDialog pairing={detailsPairing} onClose={() => setDetailsPairing(null)} />}

      {/* Stats footer */}
      <div
        className="shrink-0 px-4 py-2.5 flex items-center gap-3 flex-wrap"
        style={{ borderTop: `1px solid ${divider}` }}
      >
        <StatsChip label="Pairings" value={stats.total} color={ACCENT} isDark={isDark} />
        <StatsChip label="Legal" value={stats.legal} color="#06C270" isDark={isDark} />
        <StatsChip label="Warning" value={stats.warning} color="#FF8800" isDark={isDark} />
        <StatsChip label="Violation" value={stats.violation} color="#FF3B3B" isDark={isDark} />
        <StatsChip label="Uncovered" value={stats.uncovered} color={textSecondary} isDark={isDark} />
      </div>
    </div>
  )
}

function PairingRow({
  pairing,
  active,
  compact,
  onClick,
  onContextMenu,
  isDark,
}: {
  pairing: Pairing
  active: boolean
  /** Compact: used inside an expanded group — collapses route/meta into one line. */
  compact?: boolean
  onClick: () => void
  onContextMenu: (e: ReactMouseEvent) => void
  isDark: boolean
}) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'

  const rowBg = active
    ? isDark
      ? 'rgba(124,58,237,0.14)'
      : 'rgba(124,58,237,0.08)'
    : isDark
      ? 'rgba(255,255,255,0.03)'
      : 'rgba(255,255,255,0.50)'

  const rowBorder = active ? ACCENT : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  const blockHours = (pairing.totalBlockMinutes / 60).toFixed(1)

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="w-full text-left rounded-md px-3 py-1.5 transition-colors hover:brightness-[1.06] active:brightness-95 flex items-center gap-2"
        style={{
          background: rowBg,
          borderLeft: `2px solid ${rowBorder}`,
          border: active ? `1px solid ${ACCENT}44` : `1px solid transparent`,
          borderLeftWidth: 2,
        }}
      >
        <CalendarDays size={11} strokeWidth={2} style={{ color: textTertiary }} />
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: textPrimary }}>
          {formatDate(pairing.startDate)}
          {pairing.startDate !== pairing.endDate && ` → ${formatDate(pairing.endDate)}`}
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: textTertiary }}>
          {blockHours}h · {pairing.flightIds.length} legs
        </span>
        <span className="flex-1" />
        <WorkflowPill status={pairing.workflowStatus} isDark={isDark} />
        <PairingStatusBadge status={pairing.status} size="sm" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="w-full text-left rounded-lg px-3 py-2.5 transition-colors hover:brightness-[1.04] active:brightness-95"
      style={{
        background: rowBg,
        borderLeft: `3px solid ${rowBorder}`,
        border: active ? `1px solid ${ACCENT}44` : `1px solid transparent`,
        borderLeftWidth: 3,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-bold tracking-tight" style={{ color: textPrimary }}>
            {pairing.pairingCode}
          </span>
          <WorkflowPill status={pairing.workflowStatus} isDark={isDark} />
        </div>
        <PairingStatusBadge status={pairing.status} size="sm" />
      </div>

      <div className="flex items-center gap-1.5 text-[12px] font-medium mb-1" style={{ color: textSecondary }}>
        <Plane size={11} strokeWidth={2} style={{ color: textTertiary }} />
        <span className="truncate tabular-nums">{pairing.routeChain || '—'}</span>
      </div>

      <div className="flex items-center gap-3 text-[11px] tabular-nums" style={{ color: textTertiary }}>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={10} strokeWidth={2} />
          {formatDate(pairing.startDate)} → {formatDate(pairing.endDate)}
        </span>
        <span>·</span>
        <span>{pairing.pairingDays}d</span>
        <span>·</span>
        <span>{blockHours}h block</span>
        <span>·</span>
        <span>{pairing.flightIds.length} legs</span>
      </div>
    </button>
  )
}

interface PairingGroup {
  code: string
  members: Pairing[]
}

function PairingGroupHeader({
  group,
  expanded,
  onToggle,
  onContextMenu,
  isDark,
}: {
  group: PairingGroup
  expanded: boolean
  onToggle: () => void
  onContextMenu: (e: ReactMouseEvent, anchor: Pairing) => void
  isDark: boolean
}) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  const textTertiary = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(100,116,139,0.65)'
  const bg = isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.04)'
  const border = isDark ? 'rgba(124,58,237,0.22)' : 'rgba(124,58,237,0.18)'

  // Aggregate counts so users can tell at a glance whether anything is off
  // without expanding the group.
  const counts = {
    legal: group.members.filter((p) => p.status === 'legal').length,
    warning: group.members.filter((p) => p.status === 'warning').length,
    violation: group.members.filter((p) => p.status === 'violation').length,
    draft: group.members.filter((p) => p.workflowStatus === 'draft').length,
  }
  const first = group.members[0]
  const last = group.members[group.members.length - 1]

  return (
    <button
      type="button"
      onClick={onToggle}
      onContextMenu={(e) => onContextMenu(e, first)}
      className="w-full text-left rounded-lg px-3 py-2 transition-colors hover:brightness-[1.05] active:brightness-95"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${ACCENT}`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {expanded ? (
          <ChevronDown size={14} strokeWidth={2.2} style={{ color: ACCENT }} />
        ) : (
          <ChevronRight size={14} strokeWidth={2.2} style={{ color: ACCENT }} />
        )}
        <span className="text-[13px] font-bold tracking-tight" style={{ color: textPrimary }}>
          {group.code}
        </span>
        <span
          className="inline-flex items-center justify-center rounded-md px-1.5 h-4 text-[10px] font-bold tabular-nums"
          style={{ background: `${ACCENT}22`, color: ACCENT, letterSpacing: '0.04em' }}
        >
          {group.members.length}d
        </span>
        <span className="flex-1" />
        {counts.violation > 0 && <AggregateBadge color="#FF3B3B" label="violation" value={counts.violation} />}
        {counts.warning > 0 && <AggregateBadge color="#FF8800" label="warning" value={counts.warning} />}
        {counts.violation === 0 && counts.warning === 0 && (
          <AggregateBadge color="#06C270" label="legal" value={counts.legal} />
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: textSecondary }}>
        <Plane size={11} strokeWidth={2} style={{ color: textTertiary }} />
        <span className="truncate tabular-nums">{first.routeChain || '—'}</span>
      </div>

      <div className="flex items-center gap-3 text-[11px] tabular-nums mt-0.5" style={{ color: textTertiary }}>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={10} strokeWidth={2} />
          {formatDate(first.startDate)} → {formatDate(last.endDate)}
        </span>
        {counts.draft > 0 && (
          <>
            <span>·</span>
            <span style={{ color: '#3B82F6' }}>{counts.draft} draft</span>
          </>
        )}
      </div>
    </button>
  )
}

function AggregateBadge({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-bold tabular-nums"
      style={{ background: `${color}18`, color, border: `1px solid ${color}44`, letterSpacing: '0.02em' }}
      title={`${value} ${label}`}
    >
      {value} {label}
    </span>
  )
}

function WorkflowPill({ status, isDark }: { status: Pairing['workflowStatus']; isDark: boolean }) {
  const isDraft = status === 'draft'
  const color = isDraft ? '#3B82F6' : '#06C270'
  const bg = isDraft ? 'rgba(59, 130, 246, 0.14)' : 'rgba(6, 194, 112, 0.14)'
  return (
    <span
      className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold tracking-[0.1em] uppercase"
      style={{ background: bg, color, border: `1px solid ${color}44`, letterSpacing: '0.08em' }}
    >
      {isDraft ? 'Draft' : 'Committed'}
    </span>
  )
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mi = parseInt(m, 10) - 1
  return `${d} ${monthNames[mi] ?? m}`
}

function StatsChip({ label, value, color, isDark }: { label: string; value: number; color: string; isDark: boolean }) {
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(71,85,105,0.75)'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: textSecondary }}>
        {label}
      </span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

function InlineEmptyState({
  icon: Icon,
  title,
  description,
  isDark,
}: {
  icon: typeof GitMerge
  title: string
  description: string
  isDark: boolean
}) {
  const textPrimary = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.50)' : 'rgba(71,85,105,0.70)'
  const iconBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-8 text-center gap-3">
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{ width: 52, height: 52, background: iconBg }}
      >
        <Icon size={22} strokeWidth={1.8} style={{ color: ACCENT }} />
      </div>
      <div>
        <div className="text-[14px] font-bold mb-1" style={{ color: textPrimary }}>
          {title}
        </div>
        <p className="text-[12px] leading-relaxed max-w-[220px]" style={{ color: textSecondary }}>
          {description}
        </p>
      </div>
    </div>
  )
}
