'use client'

import { memo } from 'react'
import { useTheme } from '@/components/theme-provider'
import { formatDurationHm, type RouteStats } from '@/lib/public-timetable/logic'

interface StubProps {
  operatorName: string
  fromCode: string
  toCode: string
  effectiveFrom: string
  stats: RouteStats
}

function formatShortDate(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

function PublicTimetableStubImpl({ operatorName, fromCode, toCode, effectiveFrom, stats }: StubProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const bg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.92)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  const maxFreq = Math.max(1, ...stats.dayFrequencies)
  const dows = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden h-full"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 6px 16px -6px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.06)',
        width: 320,
      }}
    >
      {/* Perforation strip — left edge */}
      <div
        className="absolute top-0 bottom-0 left-0 w-5"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${isDark ? 'rgba(14,14,20,1)' : 'rgba(255,255,255,1)'} 3px, transparent 3.5px)`,
          backgroundSize: '10px 14px',
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'left center',
        }}
        aria-hidden
      />

      <div className="flex flex-col flex-1 px-5 py-5 pl-9 min-h-0">
        <span className="text-[13px] font-semibold tracking-[0.22em] uppercase text-hz-text-tertiary">
          Public Timetable
        </span>
        <span className="text-[13px] font-medium text-hz-text-secondary mt-0.5">{operatorName}</span>

        <div className="h-px my-3" style={{ background: border }} />

        <StubRow label="From · To" value={`${fromCode || '---'} → ${toCode || '---'}`} />
        <StubRow label="Flights" value={`${stats.flightsPerWeek}/wk`} />
        <StubRow label="Duration" value={formatDurationHm(stats.avgBlockMinutes)} />
        <StubRow label="Period" value={formatShortDate(effectiveFrom)} />

        <div className="mt-auto pt-3">
          <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-hz-text-tertiary block mb-2">
            Weekly Pattern
          </span>
          <div className="flex items-end gap-1.5 h-12">
            {stats.dayFrequencies.map((f, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm"
                  style={{
                    height: `${Math.max(3, (f / maxFreq) * 28)}px`,
                    background:
                      f > 0 ? 'var(--module-accent, #2563eb)' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    opacity: f > 0 ? 0.9 : 1,
                  }}
                />
                <span className="text-[13px] font-medium text-hz-text-tertiary">{dows[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] font-medium text-hz-text-tertiary">{label}</span>
      <span className="text-[13px] font-semibold text-hz-text">{value}</span>
    </div>
  )
}

export const PublicTimetableStub = memo(PublicTimetableStubImpl)
