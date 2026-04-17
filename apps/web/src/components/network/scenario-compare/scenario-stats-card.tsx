'use client'

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import type { ScenarioRef } from '@skyhub/api'
import type { ScenarioStats, FlightStatus } from './scenario-compare-types'

interface ScenarioStatsCardProps {
  side: string
  scenario: ScenarioRef
  stats: ScenarioStats
  other: ScenarioStats | null
}

interface MetricRow {
  label: string
  value: string
  numeric: number
  otherNumeric: number | null
  unit?: string
}

const STATUS_COLOR: Record<FlightStatus, string> = {
  draft: '#8E8E93',
  active: '#06C270',
  suspended: '#FF8800',
  cancelled: '#E63535',
}

const STATUS_LABEL: Record<FlightStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

const SCENARIO_STATUS_STYLE: Record<ScenarioRef['status'], { bg: string; fg: string; label: string }> = {
  draft: { bg: 'rgba(125,125,140,0.18)', fg: '#8E8E93', label: 'Draft' },
  review: { bg: 'rgba(255,136,0,0.18)', fg: '#FF8800', label: 'Review' },
  published: { bg: 'rgba(6,194,112,0.18)', fg: '#06C270', label: 'Published' },
  archived: { bg: 'rgba(125,125,140,0.22)', fg: '#606170', label: 'Archived' },
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

export function ScenarioStatsCard({ side, scenario, stats, other }: ScenarioStatsCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const rowBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const shadow = isDark ? '0 2px 12px rgba(0,0,0,0.35)' : '0 2px 12px rgba(96,97,112,0.10)'

  const metrics: MetricRow[] = [
    {
      label: 'Total Flights',
      value: stats.totalFlights.toLocaleString(),
      numeric: stats.totalFlights,
      otherNumeric: other?.totalFlights ?? null,
    },
    {
      label: 'Total Sectors',
      value: stats.totalSectors.toLocaleString(),
      numeric: stats.totalSectors,
      otherNumeric: other?.totalSectors ?? null,
    },
    {
      label: 'Block Hours',
      value: formatNumber(stats.totalBlockHours),
      numeric: stats.totalBlockHours,
      otherNumeric: other?.totalBlockHours ?? null,
    },
    {
      label: 'Unique Stations',
      value: stats.uniqueStations.toLocaleString(),
      numeric: stats.uniqueStations,
      otherNumeric: other?.uniqueStations ?? null,
    },
    {
      label: 'Unique Routes',
      value: stats.uniqueRoutes.toLocaleString(),
      numeric: stats.uniqueRoutes,
      otherNumeric: other?.uniqueRoutes ?? null,
    },
  ]

  const scenarioStatus = SCENARIO_STATUS_STYLE[scenario.status] ?? SCENARIO_STATUS_STYLE.draft
  const aircraftPreview = stats.aircraftTypes.slice(0, 4)
  const aircraftOverflow = stats.aircraftTypes.length - aircraftPreview.length

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 min-w-0"
      style={{
        background: glassBg,
        border: `1px solid ${glassBorder}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: shadow,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-[3px] h-5 rounded-full bg-module-accent shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[15px] font-bold text-hz-text truncate">{scenario.name}</span>
            <span
              className="text-[13px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: scenarioStatus.bg, color: scenarioStatus.fg }}
            >
              {scenarioStatus.label}
            </span>
          </div>
          {scenario.description && (
            <p className="text-[13px] text-hz-text-tertiary mt-0.5 truncate">{scenario.description}</p>
          )}
        </div>
        <span
          className="shrink-0 px-2 py-0.5 rounded-md text-[13px] font-bold text-white tracking-wider bg-module-accent"
          aria-label={`Scenario ${side}`}
        >
          {side}
        </span>
      </div>

      {/* Metric rows */}
      <div className="flex flex-col">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className="flex items-baseline justify-between py-2.5"
            style={{ borderBottom: i === metrics.length - 1 ? 'none' : `1px solid ${rowBorder}` }}
          >
            <span className="text-[13px] font-semibold uppercase tracking-wide text-hz-text-tertiary">{m.label}</span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[22px] font-semibold tabular-nums text-hz-text">{m.value}</span>
              <DeltaChip value={m.numeric} other={m.otherNumeric} />
            </div>
          </div>
        ))}
      </div>

      {/* Aircraft types */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-hz-text-tertiary">Aircraft</span>
        {aircraftPreview.length === 0 ? (
          <span className="text-[13px] text-hz-text-tertiary">—</span>
        ) : (
          aircraftPreview.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-md text-[13px] font-semibold text-hz-text"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${rowBorder}`,
              }}
            >
              {t}
            </span>
          ))
        )}
        {aircraftOverflow > 0 && (
          <span className="text-[13px] font-medium text-hz-text-tertiary">+{aircraftOverflow} more</span>
        )}
      </div>

      {/* Status breakdown */}
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-hz-text-tertiary mr-1">Status</span>
        {(Object.keys(stats.statusBreakdown) as FlightStatus[]).map((s) => {
          const count = stats.statusBreakdown[s]
          if (count === 0) return null
          const color = STATUS_COLOR[s]
          return (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[13px] font-medium"
              style={{ background: `${color}22`, color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              {STATUS_LABEL[s]} {count.toLocaleString()}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function DeltaChip({ value, other }: { value: number; other: number | null }) {
  if (other === null) return null
  const diff = value - other
  if (Math.abs(diff) < 1e-9) {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-hz-text-tertiary tabular-nums">
        <Minus size={12} />0
      </span>
    )
  }
  const up = diff > 0
  const color = up ? '#16a34a' : '#dc2626'
  const abs = Math.abs(diff)
  const formatted = Number.isInteger(abs) ? Math.round(abs).toLocaleString() : abs.toFixed(1)
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums" style={{ color }}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {formatted}
    </span>
  )
}
