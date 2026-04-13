'use client'

import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface KpiActiveMaintenanceCardProps {
  arrived: number
  inducted: number
  inWork: number
  qa: number
  released: number
}

const PHASES = [
  { key: 'arrived', label: 'Arrived', color: '#7c3aed' },
  { key: 'inducted', label: 'Inducted', color: '#4f46e5' },
  { key: 'inWork', label: 'In Work', color: '#2563eb' },
  { key: 'qa', label: 'QA', color: '#06b6d4' },
  { key: 'released', label: 'Released', color: '#06C270' },
] as const

export function KpiActiveMaintenanceCard({ arrived, inducted, inWork, qa, released }: KpiActiveMaintenanceCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const values: Record<string, number> = { arrived, inducted, inWork, qa, released }
  const totalActive = arrived + inducted + inWork + qa + released
  const lineColor = isDark ? 'rgba(255,255,255,0.12)' : '#E4E4EB'

  return (
    <div
      className="rounded-xl p-3 flex flex-col"
      style={{
        background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.95)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div className="text-[13px] font-semibold mb-2" style={{ color: palette.textSecondary }}>
        Active Maintenance
      </div>

      {/* Pipeline visualization */}
      <div className="flex items-center justify-center flex-1 px-1">
        {totalActive === 0 ? (
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold"
              style={{ background: 'rgba(6,194,112,0.12)', color: '#06C270' }}
            >
              0
            </div>
            <span className="text-[13px]" style={{ color: palette.textTertiary }}>
              All clear
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-0 w-full justify-between relative">
            {/* Connecting line behind circles */}
            <div
              className="absolute top-1/2 left-[16px] right-[16px] h-[2px]"
              style={{ background: lineColor, transform: 'translateY(-50%)' }}
            />
            {PHASES.map((phase) => (
              <div key={phase.key} className="flex flex-col items-center z-10 relative">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold"
                  style={{
                    background: isDark ? `${phase.color}22` : `${phase.color}18`,
                    color: phase.color,
                    border: `2px solid ${phase.color}`,
                  }}
                >
                  {values[phase.key]}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase labels */}
      {totalActive > 0 && (
        <div className="flex justify-between mt-1.5 px-0">
          {PHASES.map((phase) => (
            <span key={phase.key} className="text-[13px] text-center flex-1" style={{ color: palette.textTertiary }}>
              {phase.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
