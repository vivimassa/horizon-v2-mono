'use client'

import { useMemo } from 'react'
import { useTheme } from '@/components/theme-provider'
import type { DisruptionIssueRef } from '@skyhub/api'
import { useDisruptionStore, type FeedTab } from '@/stores/use-disruption-store'
import { CATEGORY_LABEL, SEVERITY_COLOR, STATUS_LABEL } from './severity-utils'

const TABS: Array<{ key: FeedTab; label: string }> = [
  { key: 'all', label: 'All open' },
  { key: 'critical', label: 'Critical' },
  { key: 'warning', label: 'Warning' },
  { key: 'info', label: 'Info' },
  { key: 'resolved', label: 'Resolved' },
]

/**
 * Feed column inside the workspace card. Owns no glass chrome — sits
 * directly in the shell's main card as the left half of the split view.
 */
export function DisruptionFeed() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const issues = useDisruptionStore((s) => s.issues)
  const feedTab = useDisruptionStore((s) => s.feedTab)
  const setFeedTab = useDisruptionStore((s) => s.setFeedTab)
  const selectedIssueId = useDisruptionStore((s) => s.selectedIssueId)
  const selectIssue = useDisruptionStore((s) => s.selectIssue)

  const filtered = useMemo(() => {
    const active = issues.filter((i) => !i.hidden)
    if (feedTab === 'all') return active.filter((i) => i.status !== 'resolved' && i.status !== 'closed')
    if (feedTab === 'resolved') return active.filter((i) => i.status === 'resolved' || i.status === 'closed')
    return active.filter((i) => i.severity === feedTab && i.status !== 'resolved' && i.status !== 'closed')
  }, [issues, feedTab])

  const sectionBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Pill tabs — matches SegmentedField palette */}
      <div
        className="flex items-center gap-1 px-5 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${sectionBorder}` }}
      >
        {TABS.map((t) => {
          const isActive = feedTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFeedTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors"
              style={
                isActive
                  ? { background: 'var(--module-accent, #4f46e5)', color: '#fff' }
                  : { color: 'var(--hz-text-secondary)' }
              }
            >
              {t.label}
            </button>
          )
        })}
      </div>

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

interface RowProps {
  issue: DisruptionIssueRef
  selected: boolean
  onSelect: () => void
  sectionBorder: string
  isDark: boolean
}

function FeedRow({ issue, selected, onSelect, sectionBorder, isDark }: RowProps) {
  const sevColor = SEVERITY_COLOR[issue.severity]
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const selectedBg = isDark ? 'rgba(79,70,229,0.16)' : 'rgba(79,70,229,0.08)'

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
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
