'use client'

import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface KpiReliabilityCardProps {
  total: number
  serviceable: number
}

export function KpiReliabilityCard({ total, serviceable }: KpiReliabilityCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const pct = total > 0 ? serviceable / total : 0
  const pctDisplay = total > 0 ? Math.round(pct * 100) : 0
  const critical = total - serviceable

  const radius = 40
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)
  const size = (radius + strokeWidth) * 2

  // Color thresholds: green >= 90%, amber >= 75%, red < 75%
  const gaugeColor = pctDisplay >= 90 ? '#06C270' : pctDisplay >= 75 ? '#FF8800' : '#FF3B3B'
  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : '#E4E4EB'

  return (
    <div
      className="rounded-xl p-3 flex flex-col"
      style={{
        background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.95)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div className="text-[13px] font-semibold mb-2" style={{ color: palette.textSecondary }}>
        Technical Reliability
      </div>

      {/* Donut gauge */}
      <div className="flex items-center justify-center flex-1">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
          {/* Foreground arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
          {/* Center text */}
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={palette.text}
            fontSize={20}
            fontWeight={700}
          >
            {pctDisplay}%
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#06C270' }} />
          <span className="text-[13px]" style={{ color: palette.textSecondary }}>
            Serviceable: {serviceable}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#FF3B3B' }} />
          <span className="text-[13px]" style={{ color: palette.textSecondary }}>
            Critical: {critical}
          </span>
        </div>
      </div>
    </div>
  )
}
