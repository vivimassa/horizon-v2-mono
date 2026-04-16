'use client'

import { useMemo } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  Ban,
  Clock,
  GitBranch,
  Repeat,
  SlidersHorizontal,
  Timer,
  Wrench,
  MoonStar,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Dropdown, type DropdownOption } from '@/components/ui/dropdown'
import type { DisruptionIssueRef } from '@skyhub/api'
import {
  useDisruptionStore,
  useEffectiveCategoryLabels,
  useEffectiveStatusLabels,
  type FeedStatusFilter,
} from '@/stores/use-disruption-store'
import { SEVERITY_COLOR } from './severity-utils'

type Category = DisruptionIssueRef['category']

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  TAIL_SWAP: Repeat,
  DELAY: Clock,
  CANCELLATION: Ban,
  DIVERSION: GitBranch,
  CONFIG_CHANGE: SlidersHorizontal,
  MISSING_OOOI: AlertOctagon,
  MAINTENANCE_RISK: Wrench,
  CURFEW_VIOLATION: MoonStar,
  TAT_VIOLATION: Timer,
}

const CATEGORY_ORDER: Category[] = [
  'TAIL_SWAP',
  'DELAY',
  'CANCELLATION',
  'DIVERSION',
  'CONFIG_CHANGE',
  'MISSING_OOOI',
  'MAINTENANCE_RISK',
  'CURFEW_VIOLATION',
  'TAT_VIOLATION',
]

const STATUS_OPTIONS: DropdownOption[] = [
  { value: 'active', label: 'Active (Open / Assigned / In progress)' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All (incl. resolved & closed)' },
]

interface FeedProps {
  onContextMenu?: (e: React.MouseEvent, issue: DisruptionIssueRef) => void
}

/**
 * Feed column — left half of the workspace split. Header carries an
 * "All" pill, a horizontally scrolling category chip rail (single-select,
 * hidden when count = 0), and a status dropdown on the right. Severity
 * is conveyed purely by the row's left-edge color bar, so there's no
 * severity filter here (the KPI donut stays read-only).
 */
export function DisruptionFeed({ onContextMenu }: FeedProps = {}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const issues = useDisruptionStore((s) => s.issues)
  const feedCategory = useDisruptionStore((s) => s.feedCategory)
  const setFeedCategory = useDisruptionStore((s) => s.setFeedCategory)
  const feedStatus = useDisruptionStore((s) => s.feedStatus)
  const setFeedStatus = useDisruptionStore((s) => s.setFeedStatus)
  const selectedIssueId = useDisruptionStore((s) => s.selectedIssueId)
  const selectIssue = useDisruptionStore((s) => s.selectIssue)
  const CATEGORY_LABEL = useEffectiveCategoryLabels()
  const STATUS_LABEL = useEffectiveStatusLabels()

  // Count by category — but ONLY among the rows that match the current
  // status filter, so chip counts always reflect what's visible in the
  // feed. Hidden (archived) issues never counted.
  const { filtered, categoryCounts, worstBySeverity } = useMemo(() => {
    const visibleByStatus = issues.filter((i) => {
      if (i.hidden) return false
      if (feedStatus === 'all') return true
      if (feedStatus === 'active') return i.status === 'open' || i.status === 'assigned' || i.status === 'in_progress'
      return i.status === feedStatus
    })

    const counts: Record<Category, number> = {
      TAIL_SWAP: 0,
      DELAY: 0,
      CANCELLATION: 0,
      DIVERSION: 0,
      CONFIG_CHANGE: 0,
      MISSING_OOOI: 0,
      MAINTENANCE_RISK: 0,
      CURFEW_VIOLATION: 0,
      TAT_VIOLATION: 0,
    }
    // Track the most-severe severity per category so the chip dot can
    // hint at urgency (critical > warning > info).
    const worst: Record<Category, DisruptionIssueRef['severity'] | null> = {
      TAIL_SWAP: null,
      DELAY: null,
      CANCELLATION: null,
      DIVERSION: null,
      CONFIG_CHANGE: null,
      MISSING_OOOI: null,
      MAINTENANCE_RISK: null,
      CURFEW_VIOLATION: null,
      TAT_VIOLATION: null,
    }
    const sevRank: Record<DisruptionIssueRef['severity'], number> = { critical: 3, warning: 2, info: 1 }

    for (const i of visibleByStatus) {
      counts[i.category] += 1
      const current = worst[i.category]
      if (!current || sevRank[i.severity] > sevRank[current]) worst[i.category] = i.severity
    }

    const filtered = feedCategory ? visibleByStatus.filter((i) => i.category === feedCategory) : visibleByStatus
    return { filtered, categoryCounts: counts, worstBySeverity: worst }
  }, [issues, feedStatus, feedCategory])

  const visibleCategories = CATEGORY_ORDER.filter((c) => categoryCounts[c] > 0)
  const totalForStatus = visibleCategories.reduce((sum, c) => sum + categoryCounts[c], 0)

  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Header — All pill, category chip rail, status dropdown */}
      <div
        className="flex items-center gap-2 px-5 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${sectionBorder}` }}
      >
        <AllPill active={feedCategory === null} count={totalForStatus} onClick={() => setFeedCategory(null)} />

        <div className="flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex items-center gap-1.5">
            {visibleCategories.map((c) => {
              const Icon = CATEGORY_ICON[c]
              const isActive = feedCategory === c
              const severity = worstBySeverity[c]
              const dotColor = severity ? SEVERITY_COLOR[severity] : 'transparent'
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFeedCategory(isActive ? null : c)}
                  className={`shrink-0 h-7 px-2.5 rounded-full flex items-center gap-1.5 text-[13px] font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-hz-text-secondary'
                  }`}
                  style={{
                    background: isActive ? 'var(--module-accent, #6366f1)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--module-accent, #6366f1)' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: isActive ? '#fff' : dotColor }}
                    aria-hidden
                  />
                  <Icon size={13} strokeWidth={2} style={{ opacity: isActive ? 1 : 0.8 }} />
                  <span>{CATEGORY_LABEL[c]}</span>
                  <span className="ml-0.5 text-[13px] font-semibold" style={{ opacity: isActive ? 1 : 0.75 }}>
                    {categoryCounts[c]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="shrink-0" style={{ width: 180 }}>
          <Dropdown
            options={STATUS_OPTIONS}
            value={feedStatus}
            onChange={(v) => setFeedStatus(v as FeedStatusFilter)}
            size="sm"
          />
        </div>
      </div>

      {/* Body — row list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[13px] text-hz-text-tertiary">
            No disruptions in this view.
          </div>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((issue) => (
              <FeedRow
                key={issue._id}
                issue={issue}
                selected={issue._id === selectedIssueId}
                onSelect={() => selectIssue(issue._id)}
                onContextMenu={onContextMenu ? (e) => onContextMenu(e, issue) : undefined}
                sectionBorder={sectionBorder}
                isDark={isDark}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function AllPill({ active, count, onClick }: { active: boolean; count: number; onClick: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-7 px-3 rounded-full flex items-center gap-1.5 text-[13px] font-semibold transition-colors ${
        active ? 'text-white' : 'text-hz-text'
      }`}
      style={{
        background: active ? 'var(--module-accent, #6366f1)' : 'transparent',
        border: `1px solid ${active ? 'var(--module-accent, #6366f1)' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
      }}
    >
      <span>All</span>
      <span className="text-[13px] font-semibold" style={{ opacity: active ? 1 : 0.6 }}>
        {count}
      </span>
    </button>
  )
}

interface RowProps {
  issue: DisruptionIssueRef
  selected: boolean
  onSelect: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  sectionBorder: string
  isDark: boolean
}

function FeedRow({ issue, selected, onSelect, onContextMenu, sectionBorder, isDark }: RowProps) {
  const sevColor = SEVERITY_COLOR[issue.severity]
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const selectedBg = isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.08)'
  const CATEGORY_LABEL = useEffectiveCategoryLabels()
  const STATUS_LABEL = useEffectiveStatusLabels()

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onContextMenu={
          onContextMenu
            ? (e) => {
                e.preventDefault()
                onContextMenu(e)
              }
            : undefined
        }
        className="w-full text-left px-5 py-3 transition-colors"
        style={{
          borderBottom: `1px solid ${sectionBorder}`,
          background: selected ? selectedBg : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = hoverBg
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = 'transparent'
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-1 rounded-full shrink-0 self-stretch" style={{ background: sevColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: sevColor }}>
                {CATEGORY_LABEL[issue.category]}
              </span>
              <span className="text-[13px] text-hz-text-tertiary">·</span>
              <span className="text-[13px] font-medium text-hz-text-tertiary">{STATUS_LABEL[issue.status]}</span>
            </div>
            <div className="text-[14px] font-semibold leading-tight text-hz-text">{issue.title}</div>
            <div className="text-[13px] mt-1 truncate text-hz-text-secondary">
              {[issue.flightNumber, issue.forDate, issue.depStation, issue.arrStation, issue.tail]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
      </button>
    </li>
  )
}
