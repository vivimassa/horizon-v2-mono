'use client'

import { memo } from 'react'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'
import type { StatusBoardFlightChip } from '@/stores/use-status-board-store'

interface RotationChipsProps {
  flights: StatusBoardFlightChip[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  completed: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
  airborne: { bg: 'rgba(37,99,235,0.15)', text: '#3B82F6', border: '#3B82F6' },
  future: { bg: 'transparent', text: '', border: '' },
  cancelled: { bg: 'rgba(255,59,59,0.10)', text: '#FF3B3B' },
  maintenance: { bg: 'rgba(113,113,122,0.12)', text: '#a1a1aa' },
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export const RotationChips = memo(function RotationChips({ flights }: RotationChipsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light

  if (flights.length === 0) {
    return (
      <span className="text-[13px]" style={{ color: palette.textTertiary }}>
        —
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {flights.map((f) => {
        const sc = STATUS_COLORS[f.status] ?? STATUS_COLORS.future
        const futureBorder =
          f.status === 'future'
            ? isDark
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(0,0,0,0.12)'
            : (sc.border ?? 'transparent')
        const textColor = f.status === 'future' ? palette.text : sc.text

        return (
          <div
            key={f.id}
            className="shrink-0 rounded-md px-1.5 py-0.5 flex flex-col items-center"
            style={{
              width: 110,
              background: sc.bg,
              border: `1px solid ${futureBorder}`,
            }}
          >
            <span className="text-[13px] font-semibold font-mono" style={{ color: textColor }}>
              {f.flightNumber}
            </span>
            <span className="text-[11px] font-mono" style={{ color: textColor, opacity: 0.8 }}>
              {f.depIcao}-{f.arrIcao} {fmtTime(f.stdUtc)}
            </span>
          </div>
        )
      })}
    </div>
  )
})
