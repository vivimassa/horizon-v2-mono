'use client'

import { useTheme } from '@/components/theme-provider'
import type { MovementMessageStats } from '@skyhub/api'

interface Props {
  stats: MovementMessageStats | null
  accentColor: string
}

const STATUSES: Array<{ key: keyof MovementMessageStats; label: string; color: (isDark: boolean) => string }> = [
  { key: 'total', label: 'Total', color: () => '#606170' },
  { key: 'held', label: 'Held', color: () => '#FF8800' },
  { key: 'pending', label: 'Pending', color: () => '#FDDD48' },
  { key: 'sent', label: 'Sent', color: () => '#0063F7' },
  { key: 'applied', label: 'Applied', color: () => '#06C270' },
  { key: 'failed', label: 'Failed', color: () => '#FF3B3B' },
  { key: 'discarded', label: 'Discarded', color: (isDark) => (isDark ? '#555770' : '#9CA3AF') },
]

export function MessageStatsBar({ stats, accentColor }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div
      className="flex items-stretch gap-1 px-3 py-2 border-b shrink-0"
      style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
    >
      {STATUSES.map((s, i) => {
        const value = stats?.[s.key] ?? 0
        const isHeld = s.key === 'held'
        const color = isHeld ? accentColor : s.color(isDark)
        return (
          <div
            key={s.key as string}
            className="flex-1 min-w-0 flex flex-col items-start px-3 py-1.5 rounded-lg"
            style={
              isHeld && value > 0
                ? {
                    background: `${accentColor}12`,
                    border: `1px solid ${accentColor}40`,
                  }
                : i === 0
                  ? undefined
                  : undefined
            }
          >
            <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color }}>
              {s.label}
            </span>
            <span className="text-[20px] font-bold text-hz-text tabular-nums">{value}</span>
          </div>
        )
      })}
    </div>
  )
}
