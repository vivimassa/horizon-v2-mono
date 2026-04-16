'use client'

import { useMemo } from 'react'
import type { DisruptionIssueRef } from '@skyhub/api'
import { SEVERITY_COLOR } from '../severity-utils'

interface Props {
  issues: DisruptionIssueRef[]
}

const SIZE = 96
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * RADIUS

const SEGMENTS: Array<{ key: 'critical' | 'warning' | 'info' | 'resolved'; label: string; color: string }> = [
  { key: 'critical', label: 'Critical', color: SEVERITY_COLOR.critical },
  { key: 'warning', label: 'Warning', color: SEVERITY_COLOR.warning },
  { key: 'info', label: 'Info', color: SEVERITY_COLOR.info },
  { key: 'resolved', label: 'Resolved', color: '#06C270' },
]

/**
 * Card 1 — read-only severity donut. The feed already conveys severity
 * via the left-edge color bar on every row, so this card is purely
 * informational (no click-to-filter).
 */
export function SeverityDonutCard({ issues }: Props) {
  const counts = useMemo(() => {
    const active = issues.filter((i) => i.status !== 'resolved' && i.status !== 'closed')
    return {
      critical: active.filter((i) => i.severity === 'critical').length,
      warning: active.filter((i) => i.severity === 'warning').length,
      info: active.filter((i) => i.severity === 'info').length,
      resolved: issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length,
    }
  }, [issues])

  const total = counts.critical + counts.warning + counts.info + counts.resolved
  const activeTotal = counts.critical + counts.warning + counts.info

  let acc = 0
  const arcs = SEGMENTS.map((s) => {
    const value = counts[s.key]
    const frac = total === 0 ? 0 : value / total
    const len = frac * CIRC
    const arc = { ...s, value, dash: `${len} ${CIRC - len}`, offset: -acc }
    acc += len
    return arc
  })

  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0 relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Severity breakdown">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(125,125,140,0.15)"
            strokeWidth={STROKE}
          />
          {total > 0 &&
            arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE}
                strokeDasharray={arc.dash}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" aria-hidden>
          <span className="text-[20px] font-bold leading-tight text-hz-text">{activeTotal}</span>
          <span className="text-[13px] font-medium text-hz-text-tertiary -mt-0.5">active</span>
        </div>
      </div>

      <ul className="flex-1 min-w-0 flex flex-col gap-1">
        {arcs.map((a) => (
          <li
            key={a.key}
            className="flex items-center justify-between gap-2 px-2 py-1 rounded-md"
            style={{ opacity: a.value === 0 ? 0.4 : 1 }}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
              <span className="text-[13px] font-medium text-hz-text truncate">{a.label}</span>
            </span>
            <span className="text-[14px] font-semibold" style={{ color: a.color }}>
              {a.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
