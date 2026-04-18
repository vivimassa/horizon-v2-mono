'use client'

import { useTheme } from '@/components/theme-provider'
import type { Kpis } from './schedule-summary-types'
import { formatLargeNumber } from './compute-schedule-summary'

interface KpiStripProps {
  kpis: Kpis
}

interface KpiCardProps {
  label: string
  value: string
  sub: string
  accent?: boolean
  isDark: boolean
}

function KpiCard({ label, value, sub, accent, isDark }: KpiCardProps) {
  const bg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.95)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const shadow = isDark
    ? '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.18)'
    : '0 1px 2px rgba(96,97,112,0.06), 0 1px 3px rgba(96,97,112,0.04)'
  return (
    <div
      className="rounded-[12px] p-4 flex flex-col gap-1.5 overflow-hidden relative"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: shadow,
        backdropFilter: isDark ? 'blur(24px)' : undefined,
      }}
    >
      <div className="text-[13px] font-medium text-hz-text-secondary truncate">{label}</div>
      <div
        className="font-bold tabular-nums tracking-tight text-hz-text"
        style={{ fontSize: 26, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      <div className="text-[13px] text-hz-text-secondary truncate">{sub}</div>
      {accent && (
        <span
          aria-hidden="true"
          className="absolute left-0 bottom-0 h-[3px] w-12 rounded-tr"
          style={{ background: 'var(--module-accent, #1e40af)' }}
        />
      )}
    </div>
  )
}

export function KpiStrip({ kpis }: KpiStripProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const aircraftByTypeStr = kpis.aircraftByType.map((a) => `${a.count}\u00D7${a.icaoType}`).join(' \u00B7 ') || '\u2014'

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mb-6">
      <KpiCard
        label="Weekly Flights"
        value={formatLargeNumber(kpis.weeklyFlights)}
        sub={`${kpis.dailyAvgFlights.toLocaleString()}/day average`}
        accent
        isDark={isDark}
      />
      <KpiCard
        label="Unique Routes"
        value={kpis.uniqueRoutes.toLocaleString()}
        sub={`${kpis.domRoutes} DOM \u00B7 ${kpis.intRoutes} INT`}
        isDark={isDark}
      />
      <KpiCard
        label="Weekly Block Hours"
        value={formatLargeNumber(kpis.weeklyBlockHours)}
        sub={`${kpis.dailyAvgBlockHours.toLocaleString()}/day average`}
        isDark={isDark}
      />
      <KpiCard
        label="Weekly Seats"
        value={formatLargeNumber(kpis.weeklySeats)}
        sub={`${formatLargeNumber(kpis.dailyAvgSeats)}/day capacity`}
        isDark={isDark}
      />
      <KpiCard label="Weekly ASK" value={formatLargeNumber(kpis.weeklyAsk)} sub="available seat-km" isDark={isDark} />
      <KpiCard
        label="Aircraft Deployed"
        value={kpis.aircraftDeployed.toLocaleString()}
        sub={aircraftByTypeStr}
        isDark={isDark}
      />
    </div>
  )
}
