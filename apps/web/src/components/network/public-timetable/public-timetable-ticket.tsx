'use client'

import { memo } from 'react'
import { useTheme } from '@/components/theme-provider'
import { TicketHeroBackground } from './ticket-hero-background'
import { formatDurationHm, type RouteStats } from '@/lib/public-timetable/logic'

interface TicketProps {
  operatorName: string
  fromCode: string
  toCode: string
  fromCity: string
  toCity: string
  fromUtcOffset: number
  toUtcOffset: number
  stats: RouteStats
}

function formatOffset(hours: number): string {
  const sign = hours >= 0 ? '+' : '-'
  const abs = Math.abs(hours)
  const h = Math.floor(abs)
  const m = Math.round((abs - h) * 60)
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function PublicTimetableTicketImpl({
  operatorName,
  fromCode,
  toCode,
  fromCity,
  toCity,
  fromUtcOffset,
  toUtcOffset,
  stats,
}: TicketProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const bg = isDark
    ? 'linear-gradient(135deg, rgba(14,20,40,0.96) 0%, rgba(18,27,54,0.96) 60%, rgba(12,18,34,0.96) 100%)'
    : 'linear-gradient(135deg, rgba(30,58,138,0.96) 0%, rgba(37,99,235,0.96) 55%, rgba(30,64,175,0.96) 100%)'
  const borderColor = isDark ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.18)'
  const shadow = isDark
    ? '0 24px 48px -18px rgba(0,0,0,0.65), 0 0 0 1px rgba(37,99,235,0.10) inset'
    : '0 24px 48px -16px rgba(37,99,235,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset'

  return (
    <div
      className="relative overflow-hidden rounded-2xl text-white h-full"
      style={{ background: bg, border: `1px solid ${borderColor}`, boxShadow: shadow }}
    >
      <TicketHeroBackground idPrefix="pt-hero-main" />

      <div
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.28), transparent)' }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col h-full px-6 py-5">
        <div className="flex items-start">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-[0.22em] uppercase text-white/75">
              Public Timetable
            </span>
            <span className="text-[13px] font-medium text-white/90 mt-0.5">{operatorName}</span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-6 mt-auto">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-[0.2em] uppercase text-white/70">From</span>
            <span className="text-[30px] font-bold leading-tight mt-0.5 max-w-[320px] truncate">{fromCity}</span>
            <span className="text-[13px] font-medium text-white/75 mt-0.5">
              {fromCode} · {formatOffset(fromUtcOffset)}
            </span>
          </div>

          <div className="flex-1 min-w-0" aria-hidden />

          <div className="flex flex-col items-end">
            <span className="text-[13px] font-semibold tracking-[0.2em] uppercase text-white/70">To</span>
            <span className="text-[30px] font-bold leading-tight mt-0.5 max-w-[320px] truncate">{toCity}</span>
            <span className="text-[13px] font-medium text-white/75 mt-0.5">
              {toCode} · {formatOffset(toUtcOffset)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-6 pt-3 border-t border-white/20">
          <StatCell label="Flights / wk" value={String(stats.flightsPerWeek)} />
          <StatCell
            label="Daily"
            value={stats.dailyMin === stats.dailyMax ? String(stats.dailyMax) : `${stats.dailyMin}-${stats.dailyMax}`}
          />
          <StatCell label="Flight Time" value={formatDurationHm(stats.avgBlockMinutes)} />
          <StatCell label="Earliest" value={stats.earliest} />
          <StatCell label="Latest" value={stats.latest} />
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[13px] font-semibold tracking-[0.16em] uppercase text-white/70">{label}</span>
      <span className="text-[18px] font-bold text-white mt-0.5">{value}</span>
    </div>
  )
}

export const PublicTimetableTicket = memo(PublicTimetableTicketImpl)
