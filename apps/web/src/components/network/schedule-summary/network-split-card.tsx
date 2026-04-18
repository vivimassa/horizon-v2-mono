'use client'

import { useTheme } from '@/components/theme-provider'
import { SectionHeader } from './section-header'
import type { NetworkSplit } from './schedule-summary-types'

const DOM_COLOR = 'var(--module-accent, #1e40af)'
const INT_COLOR = '#FF8800'

function cardStyle(isDark: boolean) {
  return {
    background: isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.95)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    boxShadow: isDark
      ? '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.18)'
      : '0 1px 2px rgba(96,97,112,0.06), 0 1px 3px rgba(96,97,112,0.04)',
  }
}

interface Props {
  split: NetworkSplit
}

export function NetworkSplitCard({ split }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const C = 2 * Math.PI * 38
  const domArc = (split.domPct / 100) * C
  const intArc = (split.intPct / 100) * C

  return (
    <div className="flex flex-col">
      <SectionHeader title="Network Split" description="Domestic vs international flights" />
      <div className="rounded-[12px] p-4 flex-1 flex items-center" style={cardStyle(isDark)}>
        <div className="flex items-center gap-6 w-full">
          <svg viewBox="0 0 100 100" style={{ width: 140, height: 140, flexShrink: 0 }} aria-hidden="true">
            <circle cx="50" cy="50" r="38" fill="none" stroke={trackColor} strokeWidth={12} />
            {split.domPct > 0 && (
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={DOM_COLOR}
                strokeWidth={12}
                strokeDasharray={`${domArc} ${C}`}
                transform="rotate(-90 50 50)"
                strokeLinecap="round"
              />
            )}
            {split.intPct > 0 && (
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={INT_COLOR}
                strokeWidth={12}
                strokeDasharray={`${intArc} ${C}`}
                strokeDashoffset={-domArc}
                transform="rotate(-90 50 50)"
                strokeLinecap="round"
              />
            )}
            <text
              x="50"
              y="54"
              textAnchor="middle"
              fill="currentColor"
              fontSize="16"
              fontWeight="700"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {split.domPct}%
            </text>
          </svg>
          <div className="flex-1 min-w-0">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <SplitRow color={DOM_COLOR} label="Domestic" count={split.domFlights} pct={split.domPct} />
                <SplitRow color={INT_COLOR} label="International" count={split.intFlights} pct={split.intPct} />
                <tr style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                  <td className="py-2 text-[13px] font-semibold text-hz-text">Total</td>
                  <td className="py-2 text-[13px] font-bold tabular-nums text-right text-hz-text">
                    {split.total.toLocaleString()}
                  </td>
                  <td className="py-2 text-[13px] tabular-nums text-right text-hz-text-secondary pl-3">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function SplitRow({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <tr>
      <td className="py-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: color }} />
        <span className="text-[13px] text-hz-text align-middle">{label}</span>
      </td>
      <td className="py-2 text-[13px] tabular-nums text-right text-hz-text">{count.toLocaleString()}</td>
      <td className="py-2 text-[13px] tabular-nums text-right text-hz-text-secondary pl-3">{pct}%</td>
    </tr>
  )
}
