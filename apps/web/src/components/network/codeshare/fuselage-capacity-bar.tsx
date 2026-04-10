"use client"

import { CABIN_CLASSES } from './codeshare-types'

interface FuselageCapacityBarProps {
  cabinConfig: Record<string, number>
  allocations: Record<string, number>
  brandColor?: string | null
  isDark: boolean
}

export function FuselageCapacityBar({
  cabinConfig, allocations, brandColor, isDark,
}: FuselageCapacityBarProps) {
  const totalSeats = Object.values(cabinConfig).reduce((s, v) => s + v, 0)
  if (totalSeats === 0) return null

  const segments: { code: string; seats: number; allocated: number; color: string }[] = []
  for (const cc of CABIN_CLASSES) {
    const seats = cabinConfig[cc.code]
    if (!seats) continue
    const allocated = allocations[cc.code] || 0
    // Use brand color for F class, cabin colors for rest
    const color = cc.code === 'F' && brandColor ? brandColor : cc.color
    segments.push({ code: cc.code, seats, allocated, color })
  }

  return (
    <div>
      {/* Labels */}
      <div className="flex mb-1 gap-0.5">
        {segments.map(seg => (
          <div
            key={seg.code}
            className="text-center"
            style={{ width: `${(seg.seats / totalSeats) * 100}%` }}
          >
            <span className="text-[13px] font-semibold" style={{ color: seg.color }}>
              {seg.code}
            </span>
            <span className="text-[13px] ml-1" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}>
              {seg.allocated}/{seg.seats}
            </span>
          </div>
        ))}
      </div>

      {/* Bar */}
      <div className="flex h-5 rounded-lg overflow-hidden gap-px" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
        {segments.map(seg => {
          const widthPct = (seg.seats / totalSeats) * 100
          const allocPct = seg.seats > 0 ? (seg.allocated / seg.seats) * 100 : 0
          return (
            <div key={seg.code} className="relative h-full" style={{ width: `${widthPct}%` }}>
              {/* Retained (full cabin) — lighter tint */}
              <div className="absolute inset-0" style={{ background: `${seg.color}20` }} />
              {/* Partner allocated — solid */}
              <div
                className="absolute left-0 top-0 bottom-0 transition-all duration-300"
                style={{ width: `${allocPct}%`, background: `${seg.color}90` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
