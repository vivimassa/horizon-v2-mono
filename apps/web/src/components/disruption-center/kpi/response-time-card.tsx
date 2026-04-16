'use client'

import { useMemo } from 'react'
import { Clock, AlertTriangle, HelpCircle, Timer } from 'lucide-react'
import type { DisruptionIssueRef } from '@skyhub/api'
import { Tooltip } from '@/components/ui/tooltip'
import { useEffectiveSla } from '@/stores/use-disruption-store'

interface Props {
  issues: DisruptionIssueRef[]
}

function formatMinutes(mins: number | null): string {
  if (mins === null || !Number.isFinite(mins)) return '—'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Card 3 — SLA-focused stats for OCC accountability.
 *   MTTR 24h — mean time to resolve for recently closed issues
 *   Median age — of currently open issues
 *   Breaches — open issues past their severity SLA
 */
export function ResponseTimeCard({ issues }: Props) {
  const sla = useEffectiveSla()
  const { mttr24, medianAge, breaches } = useMemo(() => {
    const now = Date.now()
    const last24Ms = now - 24 * 60 * 60 * 1000

    const mttrs: number[] = []
    const openAges: number[] = []
    let breaches = 0

    for (const i of issues) {
      const created = new Date(i.createdAt).getTime()
      const resolvedAt = i.resolvedAt ? new Date(i.resolvedAt).getTime() : null

      if (resolvedAt && resolvedAt >= last24Ms) {
        mttrs.push((resolvedAt - created) / 60000)
      }

      if (i.status !== 'resolved' && i.status !== 'closed') {
        const ageMin = (now - created) / 60000
        openAges.push(ageMin)
        const slaMin = sla[i.severity]
        if (slaMin && ageMin > slaMin) breaches += 1
      }
    }

    const mttr24 = mttrs.length > 0 ? mttrs.reduce((a, b) => a + b, 0) / mttrs.length : null
    return { mttr24, medianAge: median(openAges), breaches }
  }, [issues, sla])

  const breachColor = breaches > 0 ? '#FF3B3B' : '#06C270'

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">Response time</span>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<Timer className="h-3.5 w-3.5" />}
          label="MTTR 24h"
          value={formatMinutes(mttr24)}
          hint="Mean Time To Resolve — average time between when an issue was created and when it was marked resolved, across issues resolved in the last 24 hours. Lower = faster OCC response."
        />
        <Stat
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Median age"
          value={formatMinutes(medianAge)}
          hint="Median time that currently-open issues have been outstanding. Calculated across open, assigned, and in-progress issues."
        />
        <Stat
          icon={<AlertTriangle className="h-3.5 w-3.5" style={{ color: breachColor }} />}
          label="Breaches"
          value={breaches.toString()}
          color={breachColor}
          hint={`Open issues that have exceeded their severity SLA (critical ${sla.critical}m, warning ${sla.warning}m, info ${sla.info}m). Green = all within SLA; red = one or more breached.`}
        />
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  color,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color?: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1 text-[13px] font-medium text-hz-text-tertiary">
        {icon}
        {label}
        {hint && (
          <Tooltip content={hint}>
            <button
              type="button"
              aria-label={`${label} explanation`}
              className="inline-flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
              style={{ lineHeight: 0 }}
            >
              <HelpCircle className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
      </span>
      <span
        className={`text-[18px] font-bold leading-tight ${color ? '' : 'text-hz-text'}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}
