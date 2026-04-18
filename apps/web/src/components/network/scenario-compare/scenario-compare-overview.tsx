'use client'

import { useMemo } from 'react'
import { Minus, Pencil, Plus } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { ScenarioRef } from '@skyhub/api'
import type { DiffRow, DiffStatus, FlightStatus, ScenarioCompareResult, ScenarioStats } from './scenario-compare-types'

interface ScenarioCompareOverviewProps {
  scenarios: ScenarioRef[]
  perScenario: ScenarioCompareResult['perScenario']
  rows: DiffRow[]
  /** Map of aircraft ICAO type → color hex sourced from Aircraft Types DB. */
  typeColors?: Record<string, string>
}

// Fallback palette for types that have no color configured in the DB.
// Kept deterministic so the same unknown type always gets the same color
// across renders and across scenarios.
const FALLBACK_PALETTE = [
  '#0063F7',
  '#06C270',
  '#FF8800',
  '#AC5DD9',
  '#00A6FB',
  '#E63535',
  '#FFCC00',
  '#6600CC',
  '#00CFDE',
  '#FF3B3B',
]

function hashIndex(s: string, mod: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % mod
}

const LETTERS = ['A', 'B', 'C'] as const

// Per-scenario series colors: accent for A, teal for B, XD purple for C.
// Distinct enough for colorblind viewers, same "compare" family.
const SERIES_COLORS = ['var(--module-accent)', '#00A6FB', '#AC5DD9'] as const

const DIFF_STYLE: Record<DiffStatus, { color: string; bg: string; label: string; Icon: typeof Plus }> = {
  added: { color: '#16a34a', bg: 'rgba(22,163,74,0.14)', label: 'Added', Icon: Plus },
  modified: { color: '#d97706', bg: 'rgba(255,136,0,0.16)', label: 'Modified', Icon: Pencil },
  removed: { color: '#dc2626', bg: 'rgba(220,38,38,0.14)', label: 'Removed', Icon: Minus },
  unchanged: { color: '#8E8E93', bg: 'rgba(125,125,140,0.12)', label: 'Unchanged', Icon: Minus },
}

const STATUS_COLOR: Record<FlightStatus, string> = {
  active: '#06C270',
  draft: '#8E8E93',
  suspended: '#FF8800',
  cancelled: '#E63535',
}

const STATUS_LABEL: Record<FlightStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

type MetricKey = 'totalFlights' | 'totalSectors' | 'totalBlockHours' | 'uniqueStations' | 'uniqueRoutes'

const METRICS: { key: MetricKey; label: string; unit?: string; format: (n: number) => string }[] = [
  { key: 'totalFlights', label: 'Total Flights', format: (n) => n.toLocaleString() },
  { key: 'totalSectors', label: 'Total Sectors', format: (n) => n.toLocaleString() },
  {
    key: 'totalBlockHours',
    label: 'Block Hours',
    unit: 'h',
    format: (n) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)),
  },
  { key: 'uniqueStations', label: 'Unique Stations', format: (n) => n.toLocaleString() },
  { key: 'uniqueRoutes', label: 'Unique Routes', format: (n) => n.toLocaleString() },
]

export function ScenarioCompareOverview({
  scenarios,
  perScenario,
  rows,
  typeColors = {},
}: ScenarioCompareOverviewProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const diffCounts = useMemo(() => {
    const c: Record<DiffStatus, number> = { added: 0, removed: 0, modified: 0, unchanged: 0 }
    for (const r of rows) c[r.overallStatus] += 1
    return c
  }, [rows])

  const totalRows = rows.length
  const changedRows = diffCounts.added + diffCounts.removed + diffCounts.modified

  const orderedStats: (ScenarioStats | undefined)[] = scenarios.map(
    (s) => perScenario.find((p) => p.scenarioId === s._id)?.stats,
  )

  // Union of aircraft types across scenarios, sorted by total flight count
  // so the dominant type always anchors the donut's first segment.
  const aircraftUnion = useMemo(() => {
    const totals = new Map<string, number>()
    for (const s of orderedStats) {
      if (!s) continue
      for (const [type, count] of Object.entries(s.aircraftCounts)) {
        totals.set(type, (totals.get(type) ?? 0) + count)
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([type]) => type)
  }, [orderedStats])

  // Resolve each aircraft type to its DB color, falling back to a deterministic
  // palette pick so the same type keeps the same swatch even without a DB color.
  const resolvedTypeColors = useMemo(() => {
    const out: Record<string, string> = {}
    for (const type of aircraftUnion) {
      out[type] = typeColors[type] ?? FALLBACK_PALETTE[hashIndex(type, FALLBACK_PALETTE.length)]
    }
    return out
  }, [aircraftUnion, typeColors])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tileBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const barTrack = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const innerBg = isDark ? '#191921' : '#FFFFFF'

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-4"
      style={{
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Change summary */}
      <Section
        title="Change summary"
        rightSlot={
          <span className="text-[13px] font-medium text-hz-text-tertiary tabular-nums">
            {changedRows.toLocaleString()} of {totalRows.toLocaleString()} flights changed
          </span>
        }
      >
        <DiffStackBar counts={diffCounts} total={totalRows} track={barTrack} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['added', 'modified', 'removed', 'unchanged'] as DiffStatus[]).map((k) => {
            const s = DIFF_STYLE[k]
            const count = diffCounts[k]
            const pct = totalRows > 0 ? (count / totalRows) * 100 : 0
            return (
              <div
                key={k}
                className="rounded-xl px-3 py-2 flex items-center gap-2.5"
                style={{ background: s.bg, border: `1px solid ${tileBorder}` }}
              >
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md"
                  style={{ background: s.color, color: '#fff' }}
                  aria-hidden="true"
                >
                  <s.Icon size={13} strokeWidth={2.5} />
                </span>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-[13px] font-semibold text-hz-text-secondary">{s.label}</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold tabular-nums" style={{ color: s.color }}>
                      {count.toLocaleString()}
                    </span>
                    <span className="text-[13px] font-medium text-hz-text-tertiary tabular-nums">
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Divider color={sectionBorder} />

      {/* Metric comparison (left) + Status mix (right) — same row so both
          comparison graphics are glanceable without scrolling. Collapses to
          stacked on narrow viewports. */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 min-w-0">
          <Section title="Metric comparison" rightSlot={<ScenarioLegend scenarios={scenarios} />}>
            <div
              className="rounded-xl p-4 flex items-stretch gap-3"
              style={{ background: barTrack, border: `1px solid ${tileBorder}` }}
            >
              {METRICS.map((m) => {
                const values = orderedStats.map((stat) => (stat ? (stat[m.key] as number) : 0))
                const max = values.reduce((a, b) => Math.max(a, b), 0)
                return (
                  <div key={m.key} className="flex-1 flex flex-col gap-2 min-w-0">
                    <div className="h-[140px] flex items-end justify-center gap-1.5">
                      {values.map((v, idx) => {
                        const pct = max > 0 ? (v / max) * 100 : 0
                        const color = SERIES_COLORS[idx] ?? 'var(--module-accent)'
                        const displayPct = v > 0 ? Math.max(pct, 4) : 0
                        return (
                          <div
                            key={idx}
                            className="relative flex-1 max-w-[26px] rounded-t"
                            style={{
                              height: `${displayPct}%`,
                              minHeight: v > 0 ? 6 : 0,
                              background: color,
                              transition: 'height 240ms ease-out',
                            }}
                            title={`${LETTERS[idx] ?? '?'} ${scenarios[idx]?.name ?? ''}: ${m.format(v)}${m.unit ?? ''}`}
                          />
                        )
                      })}
                    </div>
                    <div className="flex justify-center gap-1.5">
                      {values.map((v, idx) => (
                        <span
                          key={idx}
                          className="flex-1 max-w-[26px] text-center text-[13px] font-semibold tabular-nums text-hz-text truncate"
                        >
                          {m.format(v)}
                        </span>
                      ))}
                    </div>
                    <div
                      className="text-center text-[13px] font-semibold text-hz-text pt-1.5 truncate"
                      style={{ borderTop: `1px solid ${tileBorder}` }}
                      title={m.label}
                    >
                      {m.label}
                      {m.unit ? <span className="text-hz-text-secondary font-medium ml-0.5">({m.unit})</span> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        </div>

        <div className="xl:col-span-2 min-w-0">
          <Section title="Status mix" rightSlot={<StatusLegend />}>
            <div className="flex flex-col gap-2">
              {scenarios.map((s, idx) => {
                const stats = orderedStats[idx]
                return (
                  <StatusDonutCard
                    key={s._id}
                    letter={LETTERS[idx] ?? '?'}
                    name={s.name}
                    stats={stats}
                    tileBorder={tileBorder}
                    innerBg={innerBg}
                    trackColor={barTrack}
                  />
                )
              })}
            </div>
          </Section>
        </div>
      </div>

      <Divider color={sectionBorder} />

      {/* Flights by aircraft type — one donut per scenario, colored by the
          Aircraft Types DB so colors stay consistent across SkyHub modules. */}
      <Section
        title="Flights by aircraft type"
        rightSlot={<AircraftTypeLegend types={aircraftUnion} colors={resolvedTypeColors} />}
      >
        {aircraftUnion.length === 0 ? (
          <p className="text-[13px] text-hz-text-tertiary">No aircraft data in the selected period.</p>
        ) : (
          <div
            className={`grid gap-3 ${scenarios.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}
          >
            {scenarios.map((s, idx) => {
              const stats = orderedStats[idx]
              return (
                <AircraftDonutCard
                  key={s._id}
                  letter={LETTERS[idx] ?? '?'}
                  name={s.name}
                  counts={stats?.aircraftCounts ?? {}}
                  orderedTypes={aircraftUnion}
                  colors={resolvedTypeColors}
                  tileBorder={tileBorder}
                  innerBg={innerBg}
                  trackColor={barTrack}
                />
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  rightSlot,
  children,
}: {
  title: string
  rightSlot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <div className="w-[3px] h-5 rounded-full bg-module-accent shrink-0" />
        <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{title}</span>
        {rightSlot ? <div className="ml-auto min-w-0">{rightSlot}</div> : null}
      </div>
      {children}
    </div>
  )
}

function Divider({ color }: { color: string }) {
  return <div className="h-px shrink-0" style={{ background: color }} />
}

function ScenarioLegend({ scenarios }: { scenarios: ScenarioRef[] }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {scenarios.map((s, idx) => (
        <span key={s._id} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-hz-text">
          <span
            className="w-2.5 h-2.5 rounded-[3px]"
            style={{ background: SERIES_COLORS[idx] ?? 'var(--module-accent)' }}
          />
          <span className="font-bold tracking-wider">{LETTERS[idx] ?? '?'}</span>
          <span className="text-hz-text-secondary truncate max-w-[140px]" title={s.name}>
            {s.name}
          </span>
        </span>
      ))}
    </div>
  )
}

function StatusLegend() {
  const order: FlightStatus[] = ['active', 'draft', 'suspended', 'cancelled']
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {order.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-hz-text-secondary">
          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  )
}

function DiffStackBar({ counts, total, track }: { counts: Record<DiffStatus, number>; total: number; track: string }) {
  if (total === 0) {
    return <div className="h-2.5 rounded-full" style={{ background: track }} aria-hidden="true" />
  }
  const order: DiffStatus[] = ['added', 'modified', 'removed', 'unchanged']
  return (
    <div
      className="flex h-2.5 rounded-full overflow-hidden"
      style={{ background: track }}
      role="img"
      aria-label="Change mix"
    >
      {order.map((k) => {
        const v = counts[k]
        if (!v) return null
        const pct = (v / total) * 100
        return <div key={k} style={{ width: `${pct}%`, background: DIFF_STYLE[k].color }} />
      })}
    </div>
  )
}

function StatusDonutCard({
  letter,
  name,
  stats,
  tileBorder,
  innerBg,
  trackColor,
}: {
  letter: string
  name: string
  stats: ScenarioStats | undefined
  tileBorder: string
  innerBg: string
  trackColor: string
}) {
  const breakdown = stats?.statusBreakdown
  const total = breakdown ? (Object.values(breakdown) as number[]).reduce((a, b) => a + b, 0) : 0
  const activePct = breakdown && total > 0 ? (breakdown.active / total) * 100 : 0

  return (
    <div className="rounded-xl p-3 flex items-center gap-3 min-w-0" style={{ border: `1px solid ${tileBorder}` }}>
      <StatusDonut breakdown={breakdown} total={total} innerBg={innerBg} trackColor={trackColor} size={84} />
      <div className="flex flex-col min-w-0 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="px-1.5 rounded text-[13px] font-bold text-white bg-module-accent tracking-wider shrink-0"
            aria-label={`Scenario ${letter}`}
          >
            {letter}
          </span>
          <span className="text-[13px] font-bold text-hz-text truncate" title={name}>
            {name}
          </span>
        </div>
        <span className="text-[13px] font-semibold text-hz-text-secondary">
          <span className="tabular-nums text-hz-text">{total.toLocaleString()}</span> flights
        </span>
        <span className="text-[13px] font-medium tabular-nums" style={{ color: STATUS_COLOR.active }}>
          {activePct.toFixed(0)}% active
        </span>
      </div>
    </div>
  )
}

function StatusDonut({
  breakdown,
  total,
  innerBg,
  trackColor,
  size = 84,
}: {
  breakdown: Record<FlightStatus, number> | undefined
  total: number
  innerBg: string
  trackColor: string
  size?: number
}) {
  const segments: { color: string; value: number }[] = []
  if (breakdown && total > 0) {
    const order: FlightStatus[] = ['active', 'draft', 'suspended', 'cancelled']
    for (const s of order) {
      const count = breakdown[s]
      if (!count) continue
      segments.push({ color: STATUS_COLOR[s], value: count })
    }
  }
  return (
    <CategoryDonut
      segments={segments}
      total={total}
      innerBg={innerBg}
      trackColor={trackColor}
      size={size}
      ariaLabel="Status breakdown"
    />
  )
}

function AircraftDonutCard({
  letter,
  name,
  counts,
  orderedTypes,
  colors,
  tileBorder,
  innerBg,
  trackColor,
}: {
  letter: string
  name: string
  counts: Record<string, number>
  orderedTypes: string[]
  colors: Record<string, string>
  tileBorder: string
  innerBg: string
  trackColor: string
}) {
  const total = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0)
  const segments = orderedTypes
    .map((t) => ({ color: colors[t], value: counts[t] ?? 0, label: t }))
    .filter((s) => s.value > 0)
  const topType = segments[0]
  const topPct = total > 0 && topType ? (topType.value / total) * 100 : 0

  return (
    <div className="rounded-xl p-3 flex items-center gap-3 min-w-0" style={{ border: `1px solid ${tileBorder}` }}>
      <CategoryDonut
        segments={segments}
        total={total}
        innerBg={innerBg}
        trackColor={trackColor}
        size={84}
        ariaLabel={`${name} — flights by aircraft type`}
      />
      <div className="flex flex-col min-w-0 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="px-1.5 rounded text-[13px] font-bold text-white bg-module-accent tracking-wider shrink-0"
            aria-label={`Scenario ${letter}`}
          >
            {letter}
          </span>
          <span className="text-[13px] font-bold text-hz-text truncate" title={name}>
            {name}
          </span>
        </div>
        <span className="text-[13px] font-semibold text-hz-text-secondary">
          <span className="tabular-nums text-hz-text">{total.toLocaleString()}</span> flights
          <span className="text-hz-text-tertiary">
            {' '}
            · {segments.length} type{segments.length === 1 ? '' : 's'}
          </span>
        </span>
        {topType ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: topType.color }} aria-hidden="true" />
            <span className="text-hz-text font-semibold">{topType.label}</span>
            <span className="text-hz-text-secondary tabular-nums">{topPct.toFixed(0)}%</span>
          </span>
        ) : (
          <span className="text-[13px] text-hz-text-tertiary">—</span>
        )}
      </div>
    </div>
  )
}

function AircraftTypeLegend({ types, colors }: { types: string[]; colors: Record<string, string> }) {
  if (types.length === 0) return null
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {types.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-hz-text-secondary">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: colors[t] }} />
          <span className="text-hz-text font-semibold tabular-nums">{t}</span>
        </span>
      ))}
    </div>
  )
}

// Generic donut — shared by Status Mix and Flights by Aircraft Type.
function CategoryDonut({
  segments,
  total,
  innerBg,
  trackColor,
  size = 84,
  ariaLabel,
}: {
  segments: { color: string; value: number }[]
  total: number
  innerBg: string
  trackColor: string
  size?: number
  ariaLabel?: string
}) {
  const stroke = Math.max(8, Math.round(size * 0.14))
  const r = size / 2 - stroke / 2 - 1
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const rendered: { color: string; length: number; offset: number }[] = []
  if (total > 0) {
    let offset = 0
    for (const s of segments) {
      if (!s.value) continue
      const length = (s.value / total) * circumference
      rendered.push({ color: s.color, length, offset })
      offset += length
    }
  }
  return (
    <svg width={size} height={size} className="shrink-0" role="img" aria-label={ariaLabel}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      {rendered.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${s.length} ${circumference}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill={innerBg} />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={Math.max(13, Math.round(size * 0.22))}
        fontWeight={700}
        fill="var(--color-hz-text)"
      >
        {total.toLocaleString()}
      </text>
    </svg>
  )
}
