'use client'

import type { ReactNode } from 'react'
import type { DisruptionIssueRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { SeverityDonutCard } from './kpi/severity-donut-card'
import { WorkflowStatusCard } from './kpi/workflow-status-card'
import { ResponseTimeCard } from './kpi/response-time-card'
import { WeatherOpsCard } from './kpi/weather-ops-card'

interface Props {
  issues: DisruptionIssueRef[]
}

/**
 * Top-of-workspace KPI row for the OCC 24×7 disruption center. Four
 * equally sized glass cards surface the most decision-relevant signals:
 *   1. Severity donut (click segments to filter feed)
 *   2. Workflow status (lifecycle stacked bar + unassigned count)
 *   3. Response time (MTTR, median age, SLA breaches)
 *   4. Weather ops (worst station + warn/caution/IFR counts)
 *
 * Cards flow to 2×2 on tablet, stack on phone.
 */
export function DisruptionKpiStrip({ issues }: Props) {
  return (
    <div className="grid gap-3 p-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <GlassCard>
        <SeverityDonutCard issues={issues} />
      </GlassCard>
      <GlassCard>
        <WorkflowStatusCard issues={issues} />
      </GlassCard>
      <GlassCard>
        <ResponseTimeCard issues={issues} />
      </GlassCard>
      <GlassCard>
        <WeatherOpsCard />
      </GlassCard>
    </div>
  )
}

function GlassCard({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <div
      className="rounded-xl px-4 py-3 min-w-0"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.20)' : '0 2px 8px rgba(96,97,112,0.08)',
      }}
    >
      {children}
    </div>
  )
}
