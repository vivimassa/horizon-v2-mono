'use client'

import { useMemo, useState } from 'react'
import { CalendarRange, Plane } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'
import { DOW_SHORT, fmtHM, formatDayTitle } from './compute-frequency'
import type { DayStats } from './frequency-analysis-types'

interface FrequencyAnalysisHeatmapProps {
  dayStats: Map<string, DayStats>
  dates: string[]
  maxTotal: number
  maxByType: Map<string, number>
  acTypeColors: Map<string, string>
}

/**
 * Calendar heatmap + day-detail card.
 *
 * Left (9 cols on lg): One cell per operating date. Intensity scales with total
 * operations; hover reveals counts. Clicking a cell pins it as the selected day.
 * Right (3 cols): Per-AC-type breakdown for the selected day (or overall totals
 * if no day is pinned).
 */
export function FrequencyAnalysisHeatmap({
  dayStats,
  dates,
  maxTotal,
  maxByType,
  acTypeColors,
}: FrequencyAnalysisHeatmapProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const cardBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.92)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const cellIdle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const accent = 'var(--module-accent, #1e40af)'

  const weeks = useMemo(() => groupIntoWeeks(dates, dayStats), [dates, dayStats])

  const selected = selectedDay ? dayStats.get(selectedDay) : null
  const overallByType = useMemo(() => aggregateByType(dayStats), [dayStats])
  const viewByType = selected ? selected.byType : overallByType
  const viewTotal = selected ? selected.total : sumMap(overallByType)
  const viewBlock = selected ? selected.blockMinutes : sumDayBlock(dayStats)
  const sortedTypes = useMemo(
    () =>
      [...viewByType.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0])
      }),
    [viewByType],
  )

  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: '0 2px 10px rgba(96,97,112,0.06)',
      }}
    >
      <Header
        title="Daily Flight Heatmap"
        subtitle={`${dates.length} day${dates.length === 1 ? '' : 's'} · peak ${maxTotal} · click a cell for details`}
      />

      <div className="grid grid-cols-12 gap-4 mt-3">
        <div className="col-span-12 lg:col-span-6">
          <div className="flex items-center gap-[3px] text-[13px] font-medium text-hz-text-tertiary mb-1.5 pl-10">
            {DOW_SHORT.map((l) => (
              <span key={l} className="flex-1 text-center">
                {l}
              </span>
            ))}
          </div>

          <div className="space-y-[3px]">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex items-center gap-[3px]">
                <span className="w-8 text-[13px] font-medium text-hz-text-tertiary tabular-nums">W{week.weekNo}</span>
                {week.cells.map((cell, cIdx) => {
                  if (!cell) {
                    return (
                      <div
                        key={cIdx}
                        className="flex-1 h-11 rounded-md"
                        style={{ background: cellIdle, opacity: 0.3 }}
                      />
                    )
                  }
                  const intensity = maxTotal > 0 ? cell.total / maxTotal : 0
                  const active = selectedDay === cell.date
                  return (
                    <Tooltip
                      key={cIdx}
                      content={`${formatDayTitle(cell.date)} · ${cell.total} flights · ${fmtHM(cell.blockMinutes)} block`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedDay(active ? null : cell.date)}
                        className="flex-1 h-11 rounded-md flex flex-col items-center justify-center transition-transform hover:scale-[1.04]"
                        style={{
                          background: cell.total === 0 ? cellIdle : accentWithAlpha(intensity),
                          border: `1px solid ${active ? accent : 'transparent'}`,
                          boxShadow: active ? '0 0 0 2px var(--module-accent, #1e40af)' : undefined,
                          minHeight: 44,
                        }}
                      >
                        <span
                          className="text-[13px] font-semibold tabular-nums"
                          style={{ color: intensity > 0.55 ? '#fff' : undefined }}
                        >
                          {cell.dateNum}
                        </span>
                        {cell.total > 0 && (
                          <span
                            className="text-[13px] font-bold tabular-nums"
                            style={{ color: intensity > 0.55 ? '#fff' : accent }}
                          >
                            {cell.total}
                          </span>
                        )}
                      </button>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Detail card */}
        <aside
          className="col-span-12 lg:col-span-6 rounded-xl p-3 flex flex-col"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
            border: `1px solid ${cardBorder}`,
            minHeight: 220,
          }}
        >
          <div className="flex items-center gap-2">
            <Plane size={14} className="text-module-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-wide text-hz-text-tertiary">
              {selected ? 'Selected Day' : 'Period Total'}
            </span>
          </div>
          <h3 className="text-[14px] font-semibold text-hz-text mt-1 truncate">
            {selected ? formatDayTitle(selected.date) : `${dates.length} days`}
          </h3>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: accent }}>
              {viewTotal}
            </span>
            <span className="text-[13px] font-medium text-hz-text-tertiary">flights</span>
            <span className="text-[13px] font-medium text-hz-text-tertiary ml-auto tabular-nums">
              {fmtHM(viewBlock)} block
            </span>
          </div>

          <div className="mt-3 space-y-1.5 flex-1 overflow-y-auto">
            {sortedTypes.length === 0 ? (
              <p className="text-[13px] text-hz-text-tertiary">No flights on this day.</p>
            ) : (
              sortedTypes.map(([type, count]) => {
                const max = selected ? (maxByType.get(type) ?? count) : viewTotal
                const pct = max > 0 ? (count / max) * 100 : 0
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-12 text-[13px] font-medium text-hz-text-secondary truncate">{type}</span>
                    <div
                      className="flex-1 h-2 rounded-full overflow-hidden"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundImage: typeBarGradient(acTypeColors.get(type) ?? accent, isDark),
                          boxShadow: isDark
                            ? 'inset 0 1px 0 rgba(255,255,255,0.10)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.30)',
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-[13px] font-bold tabular-nums">{count}</span>
                  </div>
                )
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

/* ── Helpers ─────────────────────────────────────────────── */

interface WeekRow {
  weekNo: number
  cells: (DayStats | null)[]
}

function groupIntoWeeks(dates: string[], dayStats: Map<string, DayStats>): WeekRow[] {
  if (dates.length === 0) return []
  const byDate = (iso: string) => dayStats.get(iso) ?? null
  const firstDow = dayStats.get(dates[0])?.dow ?? 1
  const rows: WeekRow[] = []
  let current: (DayStats | null)[] = new Array(firstDow - 1).fill(null)
  let weekNo = 1
  for (const iso of dates) {
    current.push(byDate(iso))
    if (current.length === 7) {
      rows.push({ weekNo, cells: current })
      current = []
      weekNo += 1
    }
  }
  if (current.length > 0) {
    while (current.length < 7) current.push(null)
    rows.push({ weekNo, cells: current })
  }
  return rows
}

function aggregateByType(dayStats: Map<string, DayStats>): Map<string, number> {
  const out = new Map<string, number>()
  dayStats.forEach((s) => {
    s.byType.forEach((v, k) => out.set(k, (out.get(k) ?? 0) + v))
  })
  return out
}

function sumMap(m: Map<string, number>): number {
  let total = 0
  m.forEach((v) => (total += v))
  return total
}

function sumDayBlock(m: Map<string, DayStats>): number {
  let total = 0
  m.forEach((s) => (total += s.blockMinutes))
  return total
}

/**
 * Interpolate an accent-tinted fill with alpha based on intensity [0,1].
 * Uses the module accent via an inline rgba() produced from the CSS variable's
 * fallback; browsers that strip the rgba will fall back to a plain accent.
 */
/**
 * Horizontal gradient for a per-type meter bar. Matches the gradient system
 * used in the pattern chart so the detail card reads as part of the same
 * visual family rather than clashing flat primaries.
 */
function typeBarGradient(base: string, isDark: boolean): string {
  const topMix = isDark ? 22 : 16
  const endMix = isDark ? 18 : 12
  return `linear-gradient(90deg, color-mix(in srgb, ${base} ${100 - topMix}%, white ${topMix}%) 0%, ${base} 55%, color-mix(in srgb, ${base} ${100 - endMix}%, black ${endMix}%) 100%)`
}

function accentWithAlpha(intensity: number): string {
  const clamped = Math.max(0.08, Math.min(1, intensity))
  return `color-mix(in srgb, var(--module-accent, #1e40af) ${Math.round(clamped * 90)}%, transparent)`
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-2.5">
      <span
        className="shrink-0"
        style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--module-accent, #1e40af)' }}
      />
      <CalendarRange size={14} className="text-module-accent shrink-0" />
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-hz-text truncate">{title}</h2>
        {subtitle ? <p className="text-[13px] text-hz-text-tertiary mt-0.5 truncate">{subtitle}</p> : null}
      </div>
    </header>
  )
}
