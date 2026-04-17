'use client'

import { ArrowDownRight, ArrowUpRight, Armchair, Clock, Gauge, Info, Minus, Plane, Radar, Ruler } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DailyCount, SsimComparisonReport } from '@skyhub/logic'
import { useTheme } from '@/components/theme-provider'
import { SectionFrame } from './section-frame'

interface Props {
  report: SsimComparisonReport
  fileA: string
  fileB: string
}

interface Kpi {
  label: string
  icon: LucideIcon
  a: number
  b: number
  aSeries: number[]
  bSeries: number[]
  format: (n: number) => string
  direction: 'higher-better' | 'neutral'
  tooltip?: string
}

/**
 * Six-card summary with inline sparklines. Each card shows the B number
 * prominently, a dual-series mini line chart (A muted, B accent), and a
 * colored delta pill. Icons keep the row scannable without reading every
 * label.
 */
export function HeadlineKpis({ report, fileA, fileB }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { a, b, range, notes } = report

  // Build parallel daily series indexed by date so the sparkline shows a
  // continuous story across both files.
  const dates = uniqueSortedDates([...a.byDay, ...b.byDay])
  const aFlights = pickSeries(a.byDay, dates, 'flights')
  const bFlights = pickSeries(b.byDay, dates, 'flights')
  const aBlock = pickSeries(a.byDay, dates, 'blockHours')
  const bBlock = pickSeries(b.byDay, dates, 'blockHours')
  const aSeats = pickSeries(a.byDay, dates, 'seatsOffered')
  const bSeats = pickSeries(b.byDay, dates, 'seatsOffered')

  const askMillions = (n: number) => n / 1_000_000

  const kpis: Kpi[] = [
    {
      label: 'Flights',
      icon: Plane,
      a: a.flights,
      b: b.flights,
      aSeries: aFlights,
      bSeries: bFlights,
      format: (n) => Math.round(n).toLocaleString(),
      direction: 'higher-better',
    },
    {
      label: 'Block hours',
      icon: Clock,
      a: a.blockHours,
      b: b.blockHours,
      aSeries: aBlock,
      bSeries: bBlock,
      format: (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      direction: 'higher-better',
    },
    {
      label: 'Seats offered',
      icon: Armchair,
      a: a.seatsOffered,
      b: b.seatsOffered,
      aSeries: aSeats,
      bSeries: bSeats,
      format: (n) => Math.round(n).toLocaleString(),
      direction: 'higher-better',
    },
    {
      label: 'ASK (M seat-km)',
      icon: Radar,
      a: askMillions(a.askKm),
      b: askMillions(b.askKm),
      aSeries: aSeats.map((s, i) => (s * (aBlock[i] || 1)) / 1000),
      bSeries: bSeats.map((s, i) => (s * (bBlock[i] || 1)) / 1000),
      format: (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      direction: 'higher-better',
      tooltip: a.askIncomplete || b.askIncomplete ? notes[0] : undefined,
    },
    {
      label: 'BH / AC / day',
      icon: Gauge,
      a: a.utilizationBhPerAcPerDay,
      b: b.utilizationBhPerAcPerDay,
      aSeries: aFlights,
      bSeries: bFlights,
      format: (n) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
      direction: 'higher-better',
      tooltip:
        'Utilization = total block-hours / peak concurrent tails (per type) / days in range. Pure schedule math — no DB fleet lookup, fair across operators.',
    },
    {
      label: 'Avg stage (h)',
      icon: Ruler,
      a: a.avgStageHours,
      b: b.avgStageHours,
      aSeries: aBlock.map((bh, i) => (aFlights[i] ? bh / aFlights[i] : 0)),
      bSeries: bBlock.map((bh, i) => (bFlights[i] ? bh / bFlights[i] : 0)),
      format: (n) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
      direction: 'neutral',
    },
  ]

  return (
    <SectionFrame
      title="Headline"
      subtitle={`${range.from} → ${range.to} · ${range.days} day${range.days === 1 ? '' : 's'} · A: ${fileA} · B: ${fileB}`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {kpis.map((k) => (
          <KpiCard key={k.label} kpi={k} isDark={isDark} />
        ))}
      </div>

      {notes.length > 0 && (
        <p className="text-[13px] text-hz-text-tertiary mt-3 flex items-start gap-1.5">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>{notes.join(' · ')}</span>
        </p>
      )}
    </SectionFrame>
  )
}

function KpiCard({ kpi, isDark }: { kpi: Kpi; isDark: boolean }) {
  const delta = kpi.b - kpi.a
  const pct = kpi.a === 0 ? (kpi.b === 0 ? 0 : Infinity) : (delta / kpi.a) * 100
  const up = delta > 0.0001
  const down = delta < -0.0001
  const deltaColor = kpi.direction === 'neutral' || (!up && !down) ? '#8F90A6' : up ? '#06C270' : '#FF3B3B'
  const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus

  const panel = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const shadow = isDark ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)' : '0 1px 3px rgba(96,97,112,0.10)'
  const Icon = kpi.icon

  return (
    <div
      className="relative overflow-hidden flex flex-col"
      title={kpi.tooltip}
      style={{
        padding: '14px 14px 12px',
        borderRadius: 14,
        background: panel,
        border: `1px solid ${border}`,
        boxShadow: shadow,
        backdropFilter: 'blur(16px)',
        minHeight: 152,
      }}
    >
      {/* Accent top stripe */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 3, background: 'var(--module-accent, #1e40af)' }}
      />

      {/* Label + icon */}
      <div className="flex items-center gap-1.5 text-hz-text-tertiary">
        <Icon size={13} strokeWidth={2} />
        <span className="text-[13px] font-semibold uppercase tracking-wider">{kpi.label}</span>
      </div>

      {/* Big B value */}
      <div className="mt-1.5 text-[22px] font-bold text-hz-text leading-none tabular-nums">{kpi.format(kpi.b)}</div>

      {/* Sparkline */}
      <div className="mt-2 -mx-1">
        <Sparkline aSeries={kpi.aSeries} bSeries={kpi.bSeries} isDark={isDark} />
      </div>

      {/* Delta pill */}
      <div className="mt-auto pt-2 flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[13px] font-semibold"
          style={{
            background: `color-mix(in srgb, ${deltaColor} 14%, transparent)`,
            color: deltaColor,
          }}
        >
          <Arrow size={12} strokeWidth={2.5} />
          {Number.isFinite(pct) ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
        </span>
        <span className="text-[13px] text-hz-text-tertiary truncate">vs {kpi.format(kpi.a)}</span>
      </div>
    </div>
  )
}

function Sparkline({ aSeries, bSeries, isDark }: { aSeries: number[]; bSeries: number[]; isDark: boolean }) {
  const W = 120
  const H = 32
  const padY = 3
  const all = [...aSeries, ...bSeries]
  if (all.length === 0) return <div style={{ height: H }} />

  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = Math.max(1, max - min)
  const n = Math.max(aSeries.length, bSeries.length)
  const dx = n > 1 ? W / (n - 1) : 0

  const toPath = (series: number[]): string => {
    if (series.length === 0) return ''
    return series
      .map((v, i) => {
        const x = i * dx
        const y = H - padY - ((v - min) / span) * (H - padY * 2)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }

  const mutedColor = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)'

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
      {/* B area fill */}
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--module-accent, #1e40af)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--module-accent, #1e40af)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {n > 1 && (
        <path
          d={`${toPath(bSeries)} L${(bSeries.length - 1) * dx},${H} L0,${H} Z`}
          fill="url(#spark-fill)"
          stroke="none"
        />
      )}
      <path d={toPath(aSeries)} fill="none" stroke={mutedColor} strokeWidth={1.25} strokeLinecap="round" />
      <path
        d={toPath(bSeries)}
        fill="none"
        stroke="var(--module-accent, #1e40af)"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  )
}

function uniqueSortedDates(rows: DailyCount[]): string[] {
  const set = new Set<string>()
  for (const r of rows) set.add(r.date)
  return [...set].sort()
}

function pickSeries(rows: DailyCount[], dates: string[], field: 'flights' | 'blockHours' | 'seatsOffered'): number[] {
  const map = new Map<string, DailyCount>()
  for (const r of rows) map.set(r.date, r)
  return dates.map((d) => map.get(d)?.[field] ?? 0)
}
