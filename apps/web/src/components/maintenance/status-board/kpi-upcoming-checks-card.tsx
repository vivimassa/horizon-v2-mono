'use client'

import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

interface KpiUpcomingChecksCardProps {
  within7d: number
  within14d: number
  within30d: number
  within60d: number
}

const TIERS = [
  { key: 'within7d', label: '\u22647d', color: '#FF3B3B' },
  { key: 'within14d', label: '\u226414d', color: '#FF8800' },
  { key: 'within30d', label: '\u226430d', color: '#FFCC00' },
  { key: 'within60d', label: '\u226460d', color: '#06C270' },
] as const

export function KpiUpcomingChecksCard({ within7d, within14d, within30d, within60d }: KpiUpcomingChecksCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  const counts: Record<string, number> = { within7d, within14d, within30d, within60d }
  const totalDue = within7d + within14d + within30d + within60d

  // Semi-circle gauge geometry
  const cx = 60
  const cy = 56
  const baseRadius = 28
  const strokeWidth = 6
  const gapAngle = 4 // degrees between arcs
  const semiCircumference = Math.PI // half circle in radians

  return (
    <div
      className="rounded-xl p-3 flex flex-col"
      style={{
        background: isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.95)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <div className="text-[13px] font-semibold mb-2" style={{ color: palette.textSecondary }}>
        Upcoming Checks
      </div>

      {/* Semi-circle gauge */}
      <div className="flex items-center justify-center flex-1">
        <svg width={120} height={68} viewBox="0 0 120 68">
          {TIERS.map((tier, i) => {
            const r = baseRadius + i * (strokeWidth + 2)
            const halfCirc = Math.PI * r
            const gapPx = (gapAngle / 180) * Math.PI * r
            const arcLength = halfCirc - gapPx
            const tierCount = counts[tier.key]
            const fraction = totalDue > 0 ? tierCount / totalDue : 0
            const filledLength = arcLength * Math.min(fraction, 1)
            const trackColor = isDark ? 'rgba(255,255,255,0.06)' : '#E4E4EB'

            return (
              <g key={tier.key}>
                {/* Track */}
                <path
                  d={describeArc(cx, cy, r, 180, 360)}
                  fill="none"
                  stroke={trackColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
                {/* Filled arc */}
                {filledLength > 0 && (
                  <path
                    d={describeArc(cx, cy, r, 180, 360)}
                    fill="none"
                    stroke={tier.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${filledLength} ${halfCirc}`}
                    style={{ transition: 'stroke-dasharray 600ms ease' }}
                  />
                )}
              </g>
            )
          })}
          {/* Center total */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            dominantBaseline="central"
            fill={palette.text}
            fontSize={18}
            fontWeight={700}
          >
            {totalDue}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill={palette.textTertiary}
            fontSize={10}
            fontWeight={500}
          >
            due
          </text>
        </svg>
      </div>

      {/* Tier grid */}
      <div className="grid grid-cols-4 gap-1 mt-1">
        {TIERS.map((tier) => (
          <div key={tier.key} className="flex flex-col items-center">
            <span className="text-[15px] font-bold" style={{ color: tier.color }}>
              {counts[tier.key]}
            </span>
            <span className="text-[13px]" style={{ color: palette.textTertiary }}>
              {tier.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Describe an SVG arc path from startAngle to endAngle (degrees, 0 = right, 180 = left) */
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}
