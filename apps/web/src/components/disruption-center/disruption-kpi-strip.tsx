'use client'

import { useMemo } from 'react'
import { AlertTriangle, AlertCircle, XCircle, CheckCircle2 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { DisruptionIssueRef } from '@skyhub/api'
import { SEVERITY_COLOR } from './severity-utils'

interface Props {
  issues: DisruptionIssueRef[]
}

/**
 * Horizontal KPI ribbon. Rendered inside the shell's glass toolbar card,
 * so this component owns no outer chrome — just four stat cells separated
 * by thin dividers (matching OpsToolbar's ribbon style).
 */
export function DisruptionKpiStrip({ issues }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const stats = useMemo(() => {
    const open = issues.filter((i) => i.status !== 'resolved' && i.status !== 'closed')
    return {
      critical: open.filter((i) => i.severity === 'critical').length,
      warning: open.filter((i) => i.severity === 'warning').length,
      info: open.filter((i) => i.severity === 'info').length,
      resolved: issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length,
    }
  }, [issues])

  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  const cells: Array<{ label: string; value: number; color: string; icon: typeof XCircle }> = [
    { label: 'Critical', value: stats.critical, color: SEVERITY_COLOR.critical, icon: XCircle },
    { label: 'Warning', value: stats.warning, color: SEVERITY_COLOR.warning, icon: AlertTriangle },
    { label: 'Info', value: stats.info, color: SEVERITY_COLOR.info, icon: AlertCircle },
    { label: 'Resolved', value: stats.resolved, color: '#06C270', icon: CheckCircle2 },
  ]

  return (
    <div className="flex items-stretch">
      {cells.map((c, i) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className="flex-1 flex items-center gap-3 px-5 py-3"
            style={{ borderLeft: i === 0 ? 'none' : `1px solid ${dividerColor}` }}
          >
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 36, height: 36, background: `${c.color}18` }}
            >
              <Icon size={18} color={c.color} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">
                {c.label}
              </span>
              <span className="text-[22px] font-bold leading-tight text-hz-text">{c.value}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
