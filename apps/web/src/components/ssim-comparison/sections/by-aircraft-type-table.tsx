'use client'

import { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, Plane } from 'lucide-react'
import type { AircraftTypeStat, SsimComparisonReport } from '@skyhub/logic'
import { useTheme } from '@/components/theme-provider'
import { SectionFrame } from './section-frame'
import { typeColor } from './fleet-mix-donut'

/**
 * One card per aircraft type with horizontal bar pairs (A vs B) for the
 * three highest-signal metrics — flights, seats, block hours — plus a
 * utilization gauge showing BH/AC/day relative to a typical healthy
 * band. Replaces the previous triple-stacked numeric table, which was
 * too dense to scan.
 */
export function ByAircraftTypeTable({ report }: { report: SsimComparisonReport }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const orderedTypes = useMemo(() => {
    const s = new Set<string>()
    report.a.byAircraftType.forEach((t) => s.add(t.aircraftType))
    report.b.byAircraftType.forEach((t) => s.add(t.aircraftType))
    return [...s].sort()
  }, [report])

  const rows = useMemo(() => mergeByType(report.a.byAircraftType, report.b.byAircraftType), [report])

  // Global maxes so bars are comparable across cards
  const maxFlights = Math.max(1, ...rows.map((r) => Math.max(r.a?.flights ?? 0, r.b?.flights ?? 0)))
  const maxSeats = Math.max(1, ...rows.map((r) => Math.max(r.a?.seatsOffered ?? 0, r.b?.seatsOffered ?? 0)))
  const maxBlock = Math.max(1, ...rows.map((r) => Math.max(r.a?.blockHours ?? 0, r.b?.blockHours ?? 0)))

  return (
    <SectionFrame title="By aircraft type" subtitle={`${rows.length} type${rows.length === 1 ? '' : 's'}`}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {rows.map((row) => (
          <TypeCard
            key={row.type}
            row={row}
            color={typeColor(row.type, orderedTypes)}
            isDark={isDark}
            maxFlights={maxFlights}
            maxSeats={maxSeats}
            maxBlock={maxBlock}
          />
        ))}
      </div>
    </SectionFrame>
  )
}

interface TypeRow {
  type: string
  a: AircraftTypeStat | null
  b: AircraftTypeStat | null
}

function mergeByType(a: AircraftTypeStat[], b: AircraftTypeStat[]): TypeRow[] {
  const map = new Map<string, TypeRow>()
  for (const row of a) map.set(row.aircraftType, { type: row.aircraftType, a: row, b: null })
  for (const row of b) {
    const cur = map.get(row.aircraftType)
    if (cur) cur.b = row
    else map.set(row.aircraftType, { type: row.aircraftType, a: null, b: row })
  }
  return [...map.values()].sort((x, y) => {
    const xf = Math.max(x.a?.flights ?? 0, x.b?.flights ?? 0)
    const yf = Math.max(y.a?.flights ?? 0, y.b?.flights ?? 0)
    return yf - xf
  })
}

function TypeCard({
  row,
  color,
  isDark,
  maxFlights,
  maxSeats,
  maxBlock,
}: {
  row: TypeRow
  color: string
  isDark: boolean
  maxFlights: number
  maxSeats: number
  maxBlock: number
}) {
  const aFlights = row.a?.flights ?? 0
  const bFlights = row.b?.flights ?? 0
  const aSeats = row.a?.seatsOffered ?? 0
  const bSeats = row.b?.seatsOffered ?? 0
  const aBlock = row.a?.blockHours ?? 0
  const bBlock = row.b?.blockHours ?? 0
  const aUtil = row.a?.utilizationBhPerAcPerDay ?? 0
  const bUtil = row.b?.utilizationBhPerAcPerDay ?? 0
  const aPeak = row.a?.peakTails ?? 0
  const bPeak = row.b?.peakTails ?? 0

  const flightDelta = bFlights - aFlights
  const flightPct = aFlights === 0 ? Infinity : (flightDelta / aFlights) * 100

  const panel = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const shadow = isDark ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)' : '0 1px 3px rgba(96,97,112,0.10)'

  return (
    <div
      className="relative overflow-hidden"
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        background: panel,
        border: `1px solid ${border}`,
        boxShadow: shadow,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Left accent stripe (type-colored) */}
      <div className="absolute top-0 bottom-0 left-0" style={{ width: 3, background: color }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pl-1">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `color-mix(in srgb, ${color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            }}
          >
            <Plane size={18} style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="text-[18px] font-bold text-hz-text leading-none" style={{ color }}>
              {row.type}
            </div>
            <div className="mt-1 text-[13px] text-hz-text-tertiary">
              Peak tails{' '}
              <span className="tabular-nums text-hz-text-secondary">
                {aPeak} → <span className="text-hz-text font-semibold">{bPeak}</span>
              </span>
              {aPeak !== bPeak && (
                <span
                  className="ml-1 font-semibold tabular-nums"
                  style={{ color: bPeak > aPeak ? '#06C270' : '#FF3B3B' }}
                >
                  ({bPeak > aPeak ? '+' : ''}
                  {bPeak - aPeak})
                </span>
              )}
            </div>
          </div>
        </div>
        <DeltaBadge pct={flightPct} abs={flightDelta} label="flights" />
      </div>

      {/* Bars */}
      <div className="mt-3 space-y-2.5 pl-1">
        <ComparisonBar
          label="Flights"
          aValue={aFlights}
          bValue={bFlights}
          max={maxFlights}
          color={color}
          format={(n) => n.toLocaleString()}
        />
        <ComparisonBar
          label="Seats"
          aValue={aSeats}
          bValue={bSeats}
          max={maxSeats}
          color={color}
          format={(n) => compactNumber(n)}
        />
        <ComparisonBar
          label="Block hrs"
          aValue={aBlock}
          bValue={bBlock}
          max={maxBlock}
          color={color}
          format={(n) => Math.round(n).toLocaleString()}
        />
      </div>

      {/* Utilization gauge */}
      <div className="mt-3 pt-3 pl-1 border-t border-hz-border/40">
        <UtilizationGauge aValue={aUtil} bValue={bUtil} color={color} isDark={isDark} />
      </div>
    </div>
  )
}

function ComparisonBar({
  label,
  aValue,
  bValue,
  max,
  color,
  format,
}: {
  label: string
  aValue: number
  bValue: number
  max: number
  color: string
  format: (n: number) => string
}) {
  const aWidth = max === 0 ? 0 : (aValue / max) * 100
  const bWidth = max === 0 ? 0 : (bValue / max) * 100
  const delta = bValue - aValue
  const deltaColor = delta > 0 ? '#06C270' : delta < 0 ? '#FF3B3B' : '#8F90A6'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">{label}</span>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-[13px] text-hz-text-tertiary">{format(aValue)}</span>
          <span className="text-[13px] text-hz-text-tertiary">→</span>
          <span className="text-[13px] font-bold text-hz-text">{format(bValue)}</span>
          <span className="text-[13px] font-semibold" style={{ color: deltaColor }}>
            {delta > 0 ? '+' : ''}
            {format(Math.abs(delta))}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {/* A bar — muted */}
        <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(127,127,143,0.15)' }}>
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full"
            style={{ width: `${aWidth}%`, background: 'rgba(127,127,143,0.55)' }}
          />
        </div>
        {/* B bar — accent */}
        <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(127,127,143,0.15)' }}>
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full"
            style={{ width: `${bWidth}%`, background: color }}
          />
        </div>
      </div>
    </div>
  )
}

function UtilizationGauge({
  aValue,
  bValue,
  color,
  isDark,
}: {
  aValue: number
  bValue: number
  color: string
  isDark: boolean
}) {
  // Gauge scale: 0-16 BH/AC/day. Target zone: 10-14 (industry healthy band)
  const SCALE_MAX = 16
  const TARGET_LO = 10
  const TARGET_HI = 14
  const aPct = Math.min(100, (aValue / SCALE_MAX) * 100)
  const bPct = Math.min(100, (bValue / SCALE_MAX) * 100)
  const targetLoPct = (TARGET_LO / SCALE_MAX) * 100
  const targetHiPct = (TARGET_HI / SCALE_MAX) * 100
  const delta = bValue - aValue

  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary">Utilization</span>
          <span className="text-[13px] text-hz-text-tertiary">BH / AC / day</span>
        </div>
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-[18px] font-bold text-hz-text">{bValue.toFixed(1)}</span>
          <span className="text-[13px] text-hz-text-tertiary">vs {aValue.toFixed(1)}</span>
          {Math.abs(delta) >= 0.05 && (
            <span className="text-[13px] font-semibold" style={{ color: delta > 0 ? '#06C270' : '#FF3B3B' }}>
              ({delta > 0 ? '+' : ''}
              {delta.toFixed(1)})
            </span>
          )}
        </div>
      </div>

      {/* Gauge track */}
      <div className="relative h-4 rounded-full overflow-hidden" style={{ background: trackBg }}>
        {/* Target zone */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${targetLoPct}%`,
            width: `${targetHiPct - targetLoPct}%`,
            background: 'color-mix(in srgb, #06C270 18%, transparent)',
            borderLeft: '1px dashed rgba(6,194,112,0.4)',
            borderRight: '1px dashed rgba(6,194,112,0.4)',
          }}
          title="Target zone 10–14 BH/AC/day"
        />
        {/* B fill */}
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ width: `${bPct}%`, background: `color-mix(in srgb, ${color} 65%, transparent)` }}
        />
        {/* A marker */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `calc(${aPct}% - 1px)`,
            width: 2,
            background: 'rgba(127,127,143,0.8)',
          }}
          title={`File A: ${aValue.toFixed(1)}`}
        />
        {/* B marker (dot) */}
        <div
          className="absolute rounded-full"
          style={{
            left: `calc(${bPct}% - 6px)`,
            top: 'calc(50% - 6px)',
            width: 12,
            height: 12,
            background: color,
            border: '2px solid #fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1 text-[13px] text-hz-text-tertiary tabular-nums">
        <span>0</span>
        <span style={{ color: '#06C270' }}>target 10–14</span>
        <span>{SCALE_MAX}</span>
      </div>
    </div>
  )
}

function DeltaBadge({ pct, abs, label }: { pct: number; abs: number; label: string }) {
  const up = abs > 0
  const down = abs < 0
  const color = up ? '#06C270' : down ? '#FF3B3B' : '#8F90A6'
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <div
      className="shrink-0 flex items-center gap-1 rounded-full px-2 py-1"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      <Icon size={13} strokeWidth={2.5} />
      <span className="text-[13px] font-semibold tabular-nums">
        {Number.isFinite(pct) ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
      </span>
      <span className="text-[13px] text-hz-text-tertiary">{label}</span>
    </div>
  )
}

function compactNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}
