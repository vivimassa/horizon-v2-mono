'use client'

import { ChevronUp, ChevronDown } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import { KpiReliabilityCard } from './kpi-reliability-card'
import { KpiUpcomingChecksCard } from './kpi-upcoming-checks-card'
import { KpiActiveMaintenanceCard } from './kpi-active-maintenance-card'
import { KpiAogDeferralsCard } from './kpi-aog-deferrals-card'

interface StatusBoardKpiSectionProps {
  kpis: {
    totalActive: number
    serviceable: number
    attention: number
    critical: number
    inCheck: number
    technicalReliability: number
    upcomingChecks: { within7d: number; within14d: number; within30d: number; within60d: number }
    activeMaintenance: { arrived: number; inducted: number; inWork: number; qa: number; released: number }
    aogCount: number
    deferralCount: number
    oldestDeferralDays: number | null
  }
  collapsed: boolean
  onToggle: () => void
}

export function StatusBoardKpiSection({ kpis, collapsed, onToggle }: StatusBoardKpiSectionProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const hoverBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const pct = kpis.totalActive > 0 ? Math.round((kpis.serviceable / kpis.totalActive) * 100) : 0

  if (collapsed) {
    return (
      <div className="flex items-center gap-4 px-3 py-2">
        <div className="flex items-center gap-4 flex-1 text-[13px]" style={{ color: palette.textSecondary }}>
          <span>
            Reliability:{' '}
            <strong style={{ color: pct >= 90 ? '#06C270' : pct >= 75 ? '#FF8800' : '#FF3B3B' }}>{pct}%</strong>
          </span>
          <span>
            Checks due:{' '}
            <strong style={{ color: palette.text }}>
              {kpis.upcomingChecks.within7d +
                kpis.upcomingChecks.within14d +
                kpis.upcomingChecks.within30d +
                kpis.upcomingChecks.within60d}
            </strong>
          </span>
          <span>
            AOG: <strong style={{ color: kpis.aogCount > 0 ? '#FF3B3B' : '#06C270' }}>{kpis.aogCount}</strong>
          </span>
          <span>
            Deferrals:{' '}
            <strong style={{ color: kpis.deferralCount > 0 ? '#FF8800' : palette.text }}>{kpis.deferralCount}</strong>
          </span>
        </div>
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: palette.textTertiary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = hoverBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative px-3 py-2">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute top-2 right-3 w-7 h-7 flex items-center justify-center rounded-lg transition-colors z-10"
        style={{ color: palette.textTertiary }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hoverBg
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <ChevronUp size={16} />
      </button>

      {/* 4-card grid */}
      <div className="grid grid-cols-4 gap-3">
        <KpiReliabilityCard total={kpis.totalActive} serviceable={kpis.serviceable} />
        <KpiUpcomingChecksCard {...kpis.upcomingChecks} />
        <KpiActiveMaintenanceCard {...kpis.activeMaintenance} />
        <KpiAogDeferralsCard
          aogCount={kpis.aogCount}
          deferralCount={kpis.deferralCount}
          oldestDeferralDays={kpis.oldestDeferralDays}
        />
      </div>
    </div>
  )
}
