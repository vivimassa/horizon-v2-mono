import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import { colors } from '@skyhub/ui/theme'

interface UtilizationRiskSummaryProps {
  atRisk: number
  close: number
  safe: number
  isDark: boolean
}

export function UtilizationRiskSummary({ atRisk, close, safe, isDark }: UtilizationRiskSummaryProps) {
  const palette = isDark ? colors.dark : colors.light

  const cards = [
    { label: 'At Risk (<80%)', value: atRisk, color: '#FF3B3B', icon: AlertTriangle },
    { label: 'Close (80\u201385%)', value: close, color: '#FF8800', icon: AlertCircle },
    { label: 'Safe (\u226585%)', value: safe, color: '#06C270', icon: CheckCircle },
  ]

  return (
    <div className="flex gap-2.5 px-5 py-3 shrink-0">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className="flex-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
            }}
          >
            <Icon size={16} style={{ color: c.color }} />
            <div>
              <div className="text-[16px] font-bold" style={{ color: c.color }}>
                {c.value}
              </div>
              <div className="text-[13px]" style={{ color: palette.textSecondary }}>
                {c.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
