'use client'

import { useMemo } from 'react'
import { UserX } from 'lucide-react'
import type { DisruptionIssueRef } from '@skyhub/api'
import { STATUS_COLOR } from '../severity-utils'
import { useEffectiveBacklogThreshold, useEffectiveStatusLabels } from '@/stores/use-disruption-store'

interface Props {
  issues: DisruptionIssueRef[]
}

const ORDER: Array<DisruptionIssueRef['status']> = ['open', 'assigned', 'in_progress', 'resolved', 'closed']

/**
 * Card 2 — stacked bar of the issue lifecycle. Highlights open backlog
 * with a red glow when it exceeds the configured backlog threshold.
 */
export function WorkflowStatusCard({ issues }: Props) {
  const backlogThreshold = useEffectiveBacklogThreshold()
  const STATUS_LABEL = useEffectiveStatusLabels()
  const { counts, total, unassigned } = useMemo(() => {
    const counts: Record<DisruptionIssueRef['status'], number> = {
      open: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    }
    let unassigned = 0
    for (const i of issues) {
      counts[i.status] += 1
      if (!i.assignedTo && i.status !== 'resolved' && i.status !== 'closed') unassigned += 1
    }
    return { counts, total: issues.length, unassigned }
  }, [issues])

  const backlogHot = counts.open > backlogThreshold

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">Workflow</span>
        <span className="text-[13px] text-hz-text-secondary">{total} total</span>
      </div>

      <div
        className="h-3 rounded-full overflow-hidden flex"
        style={{
          background: 'rgba(125,125,140,0.15)',
          boxShadow: backlogHot ? `0 0 0 1px ${STATUS_COLOR.open}, 0 0 12px ${STATUS_COLOR.open}55` : undefined,
        }}
      >
        {ORDER.map((s) => {
          const pct = total === 0 ? 0 : (counts[s] / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={s}
              style={{
                width: `${pct}%`,
                background: STATUS_COLOR[s],
                transition: 'width 200ms',
              }}
              title={`${STATUS_LABEL[s]}: ${counts[s]}`}
            />
          )
        })}
      </div>

      <ul className="grid grid-cols-5 gap-2">
        {ORDER.map((s) => (
          <li key={s} className="flex flex-col min-w-0">
            <span className="flex items-center gap-1 text-[13px] font-medium text-hz-text-tertiary truncate">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[s] }} />
              {STATUS_LABEL[s]}
            </span>
            <span className="text-[14px] font-semibold text-hz-text">{counts[s]}</span>
          </li>
        ))}
      </ul>

      {unassigned > 0 && (
        <div className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: STATUS_COLOR.open }}>
          <UserX className="h-3.5 w-3.5" />
          {unassigned} unassigned
        </div>
      )}
    </div>
  )
}
