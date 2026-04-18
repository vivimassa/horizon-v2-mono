'use client'

import { useTheme } from '@/components/theme-provider'
import { SectionHeader } from './section-header'
import type { StationRow } from './schedule-summary-types'

interface Props {
  stations: StationRow[]
}

export function StationActivityCards({ stations }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const cardBg = isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.95)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return (
    <div className="mb-6">
      <SectionHeader title="Station Activity" description="Top 4 busiest stations by weekly departures" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stations.map((s) => (
          <div
            key={s.station}
            className="rounded-[12px] p-4 overflow-hidden relative"
            style={{
              background: cardBg,
              border: `1px solid ${border}`,
              borderLeft: `3px solid ${s.color}`,
              boxShadow: isDark
                ? '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.18)'
                : '0 1px 2px rgba(96,97,112,0.06), 0 1px 3px rgba(96,97,112,0.04)',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[13px] font-semibold text-hz-text-secondary tracking-wide">{s.station}</span>
              {s.isHub && (
                <span
                  className="px-2 py-0.5 rounded-full text-[13px] font-semibold text-white"
                  style={{ background: '#0063F7' }}
                >
                  Hub
                </span>
              )}
            </div>
            <div
              className="font-bold tabular-nums tracking-tight text-hz-text"
              style={{ fontSize: 26, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
            >
              {s.weeklyDeps.toLocaleString()}
            </div>
            <div className="text-[13px] text-hz-text-secondary mt-1">{`dep/wk \u00B7 ${s.pct}% of network`}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
