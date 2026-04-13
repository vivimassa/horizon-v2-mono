'use client'

import { Download } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import type { StatusBoardKpis } from '@/stores/use-status-board-store'

interface StatusBoardStatsBarProps {
  kpis: StatusBoardKpis
}

const STATUS_DOTS: {
  key: keyof Pick<StatusBoardKpis, 'serviceable' | 'attention' | 'critical' | 'inCheck'>
  label: string
  color: string
}[] = [
  { key: 'serviceable', label: 'Serviceable', color: '#06C270' },
  { key: 'attention', label: 'Attention', color: '#FF8800' },
  { key: 'critical', label: 'Critical', color: '#FF3B3B' },
  { key: 'inCheck', label: 'In Check', color: '#7c3aed' },
]

export function StatusBoardStatsBar({ kpis }: StatusBoardStatsBarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  return (
    <div className="flex items-center gap-4" style={{ height: 36 }}>
      <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
        {kpis.totalActive} aircraft
      </span>

      {STATUS_DOTS.map((dot) => {
        const count = kpis[dot.key]
        if (count === 0 && dot.key === 'inCheck') return null
        return (
          <div key={dot.key} className="flex items-center gap-1.5">
            <div className="rounded-full" style={{ width: 8, height: 8, background: dot.color }} />
            <span className="text-[13px]" style={{ color: palette.textSecondary }}>
              {count} {dot.label}
            </span>
          </div>
        )
      })}

      {kpis.aogCount > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="rounded-full" style={{ width: 8, height: 8, background: '#dc2626' }} />
          <span className="text-[13px]" style={{ color: palette.textSecondary }}>
            {kpis.aogCount} AOG
          </span>
        </div>
      )}

      <div className="flex-1" />

      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
        style={{ color: palette.textSecondary }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Download size={14} strokeWidth={1.8} />
        Export
      </button>
    </div>
  )
}
