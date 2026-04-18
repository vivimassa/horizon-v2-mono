'use client'

import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Tooltip } from '@/components/ui/tooltip'
import { DOW_FULL } from './compute-frequency'
import type { DowDistributionRow, FrequencyFlightRow, PatternBucket } from './frequency-analysis-types'

interface FrequencyAnalysisPatternChartProps {
  dowDistribution: DowDistributionRow[]
  patterns: PatternBucket
  acTypeColors: Map<string, string>
}

/**
 * Pattern distribution — two stacked views inside one section card:
 *   1. Operating-day breakdown: 7 DOW rows, stacked by aircraft-type color.
 *   2. Pattern-key buckets: daily / weekday / weekend / odd / even / other.
 *
 * Pure SVG + CSS; no charting library. All colors from accent/palette; no hex
 * literals except the fallback swatch via the accent CSS variable.
 */
export function FrequencyAnalysisPatternChart({
  dowDistribution,
  patterns,
  acTypeColors,
}: FrequencyAnalysisPatternChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const maxDowTotal = useMemo(() => {
    let m = 0
    for (const r of dowDistribution) if (r.total > m) m = r.total
    return m
  }, [dowDistribution])

  const cardBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.92)'
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const trackBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const accent = 'var(--module-accent, #1e40af)'

  const typesInLegend = useMemo(() => {
    const set = new Set<string>()
    for (const row of dowDistribution) row.byType.forEach((_v, k) => set.add(k))
    return [...set].sort()
  }, [dowDistribution])

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
        title="Frequency Distribution"
        subtitle={`${patterns.total} unique flights across ${dowDistribution.reduce((a, b) => a + b.total, 0)} weekly operations`}
      />

      <div className="grid grid-cols-12 gap-4 mt-3">
        {/* DOW bars */}
        <div className="col-span-12 lg:col-span-8 space-y-2">
          {dowDistribution.map((row) => {
            const pct = maxDowTotal > 0 ? (row.total / maxDowTotal) * 100 : 0
            return (
              <div key={row.dow} className="flex items-center gap-3">
                <span className="w-8 text-[13px] font-semibold text-hz-text-secondary">{row.label}</span>
                <div className="flex-1 relative h-6 rounded-md overflow-hidden" style={{ background: trackBg }}>
                  <div className="absolute inset-0 flex">
                    {[...row.byType.entries()]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([type, count]) => {
                        const segmentPct = maxDowTotal > 0 ? (count / maxDowTotal) * 100 : 0
                        const pctOfRow = row.total > 0 ? Math.round((count / row.total) * 100) : 0
                        const dowFull = DOW_FULL[row.dow - 1]
                        return (
                          <Tooltip key={type} content={`${dowFull} · ${type}: ${count} (${pctOfRow}% of day)`}>
                            <div
                              style={{
                                width: `${segmentPct}%`,
                                backgroundImage: typeGradient(acTypeColors.get(type) ?? accent, isDark),
                                boxShadow: isDark
                                  ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
                                  : 'inset 0 1px 0 rgba(255,255,255,0.25)',
                              }}
                            />
                          </Tooltip>
                        )
                      })}
                  </div>
                </div>
                <span
                  className="w-12 text-right text-[13px] font-bold tabular-nums"
                  style={{ opacity: row.total > 0 ? 1 : 0.4 }}
                >
                  {row.total}
                </span>
                <span className="w-12 text-right text-[13px] font-medium text-hz-text-tertiary tabular-nums">
                  {Math.round(pct)}%
                </span>
              </div>
            )
          })}
        </div>

        {/* Pattern buckets — grid stretches to fill the DOW-bar column height
            so the six tiles collectively match the left-hand chart height. */}
        <div className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 grid-rows-3 gap-2 h-full">
            <PatternTile label="Daily" count={patterns.daily.length} total={patterns.total} />
            <PatternTile label="Weekday" count={patterns.weekday.length} total={patterns.total} />
            <PatternTile label="Weekend" count={patterns.weekend.length} total={patterns.total} />
            <PatternTile label="Odd" count={patterns.odd.length} total={patterns.total} />
            <PatternTile label="Even" count={patterns.even.length} total={patterns.total} />
            <PatternTile
              label="Other"
              count={patterns.other.length}
              total={patterns.total}
              hint={patterns.uniqueOther > 0 ? `${patterns.uniqueOther} patterns` : undefined}
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      {typesInLegend.length > 0 && (
        <div
          className="mt-4 pt-3 flex flex-wrap justify-center gap-x-4 gap-y-2"
          style={{ borderTop: `1px solid ${cardBorder}` }}
        >
          {typesInLegend.map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundImage: typeGradient(acTypeColors.get(type) ?? accent, isDark) }}
              />
              <span className="text-[13px] font-medium text-hz-text-secondary">{type}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PatternTile({ label, count, total, hint }: { label: string; count: number; total: number; hint?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div
      className="flex flex-col justify-center rounded-xl px-3 py-2 min-h-0"
      style={{
        background: 'var(--module-accent-surface, rgba(30,64,175,0.06))',
        border: '1px solid rgba(125,125,140,0.12)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-hz-text-tertiary uppercase tracking-wide truncate">{label}</span>
        <span
          className="text-[20px] font-bold leading-none tabular-nums shrink-0"
          style={{ color: 'var(--module-accent, #1e40af)' }}
        >
          {count}
        </span>
      </div>
      <span className="text-[13px] font-medium text-hz-text-secondary tabular-nums mt-0.5 truncate">
        {pct}%{hint ? ` · ${hint}` : ''}
      </span>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-2.5">
      <span
        className="shrink-0"
        style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--module-accent, #1e40af)' }}
      />
      <BarChart3 size={14} className="text-module-accent shrink-0" />
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-hz-text truncate">{title}</h2>
        {subtitle ? <p className="text-[13px] text-hz-text-tertiary mt-0.5 truncate">{subtitle}</p> : null}
      </div>
    </header>
  )
}

/**
 * Soft vertical gradient for a stacked-bar segment. Lightens the top by a
 * small amount and darkens the bottom; `color-mix` falls back gracefully on
 * browsers that don't support it.
 */
function typeGradient(base: string, isDark: boolean): string {
  const topMix = isDark ? 22 : 16
  const bottomMix = isDark ? 18 : 12
  return `linear-gradient(180deg, color-mix(in srgb, ${base} ${100 - topMix}%, white ${topMix}%) 0%, ${base} 55%, color-mix(in srgb, ${base} ${100 - bottomMix}%, black ${bottomMix}%) 100%)`
}

// Helper tuple reference to keep TS quiet on unused import in case of tree-shake
// (this comment avoids an otherwise-useless suppression).
export type _PatternFlights = FrequencyFlightRow[]
