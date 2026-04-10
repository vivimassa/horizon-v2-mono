import { colors } from '@skyhub/ui/theme'
import type { SlotPortfolioStats } from '@skyhub/api'

interface PortfolioKpiRowProps {
  stats: SlotPortfolioStats
  isDark: boolean
}

const KPI_DEFS = [
  { key: 'totalSeries', label: 'Total Series', color: '' },
  { key: 'confirmed', label: 'Confirmed (K)', color: '#06C270' },
  { key: 'offered', label: 'Offered (O)', color: '#FF8800' },
  { key: 'waitlisted', label: 'Waitlisted', color: '#7c3aed' },
  { key: 'atRisk80', label: 'At Risk (<80%)', color: '#FF3B3B' },
] as const

export function PortfolioKpiRow({ stats, isDark }: PortfolioKpiRowProps) {
  const palette = isDark ? colors.dark : colors.light

  return (
    <div className="flex gap-2.5 px-5 py-3.5 shrink-0">
      {KPI_DEFS.map(k => {
        const value = stats[k.key as keyof SlotPortfolioStats]
        return (
          <div
            key={k.key}
            className="flex-1 rounded-xl px-3.5 py-3"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
            }}
          >
            <div className="text-[20px] font-bold leading-tight"
              style={{ color: k.color || palette.text }}>
              {value}
            </div>
            <div className="text-[13px] mt-1" style={{ color: palette.textSecondary }}>
              {k.label}
            </div>
            {stats.totalSeries > 0 && (
              <div className="h-[3px] rounded-full mt-2 overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((value / stats.totalSeries) * 100)}%`,
                    background: k.color || palette.textSecondary,
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
