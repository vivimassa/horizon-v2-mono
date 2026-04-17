'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import type { AircraftTypeStat, SsimComparisonReport } from '@skyhub/logic'
import { useTheme } from '@/components/theme-provider'
import { SectionFrame } from './section-frame'

/**
 * Colour palette used across the aircraft-type visualisations. Each type
 * is pinned to a deterministic slot so A320 has the same hue in the
 * donut, the bar comparisons, and any legend we add later.
 */
export const TYPE_PALETTE: string[] = [
  'var(--module-accent, #1e40af)',
  '#8B5CF6', // purple
  '#06B6D4', // teal
  '#F97316', // orange
  '#EC4899', // pink
  '#EAB308', // yellow
  '#10B981', // emerald
  '#F43F5E', // rose
]

export function typeColor(type: string, orderedTypes: string[]): string {
  const idx = orderedTypes.indexOf(type)
  return TYPE_PALETTE[(idx >= 0 ? idx : orderedTypes.length) % TYPE_PALETTE.length]
}

interface Props {
  report: SsimComparisonReport
  fileA: string
  fileB: string
}

/**
 * Twin donut charts showing share of flights per aircraft type for File A
 * and File B side-by-side, with a small "shift" list below highlighting
 * the types that gained or lost the most mix share.
 */
export function FleetMixDonut({ report, fileA, fileB }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const orderedTypes = useMemo(() => {
    const s = new Set<string>()
    report.a.byAircraftType.forEach((t) => s.add(t.aircraftType))
    report.b.byAircraftType.forEach((t) => s.add(t.aircraftType))
    return [...s].sort()
  }, [report])

  const aTotal = report.a.flights
  const bTotal = report.b.flights
  const aSlices = buildSlices(report.a.byAircraftType, aTotal, orderedTypes)
  const bSlices = buildSlices(report.b.byAircraftType, bTotal, orderedTypes)

  const shifts = buildShifts(aSlices, bSlices)

  const panel = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const shadow = isDark ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)' : '0 1px 3px rgba(96,97,112,0.10)'

  return (
    <SectionFrame title="Fleet mix" subtitle="Share of flights per aircraft type">
      <div
        className="rounded-xl p-4"
        style={{
          background: panel,
          border: `1px solid ${border}`,
          boxShadow: shadow,
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          {/* Donut A */}
          <Donut slices={aSlices} total={aTotal} label="File A" fileName={fileA} isDark={isDark} />

          <div className="flex items-center justify-center">
            <div
              className="rounded-full p-2"
              style={{ background: 'color-mix(in srgb, var(--module-accent, #1e40af) 14%, transparent)' }}
            >
              <ArrowRight size={18} style={{ color: 'var(--module-accent, #1e40af)' }} />
            </div>
          </div>

          {/* Donut B */}
          <Donut slices={bSlices} total={bTotal} label="File B" fileName={fileB} isDark={isDark} />
        </div>

        {/* Shifts row */}
        {shifts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-hz-border/40">
            <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2">
              Biggest shifts
            </div>
            <div className="flex flex-wrap gap-2">
              {shifts.slice(0, 6).map((s) => {
                const positive = s.deltaPp > 0
                const color = positive ? '#06C270' : s.deltaPp < 0 ? '#FF3B3B' : '#8F90A6'
                return (
                  <div
                    key={s.type}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{
                      background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${s.color} 25%, transparent)`,
                    }}
                  >
                    <span
                      className="inline-block rounded-full"
                      style={{ width: 10, height: 10, background: s.color }}
                    />
                    <span className="text-[13px] font-semibold text-hz-text">{s.type}</span>
                    <span className="text-[13px] text-hz-text-tertiary tabular-nums">
                      {s.aPct.toFixed(1)}% → {s.bPct.toFixed(1)}%
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
                      {positive ? '+' : ''}
                      {s.deltaPp.toFixed(1)}pp
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </SectionFrame>
  )
}

interface Slice {
  type: string
  count: number
  pct: number
  color: string
}

function buildSlices(stats: AircraftTypeStat[], total: number, orderedTypes: string[]): Slice[] {
  if (total === 0) return []
  return stats
    .map((s) => ({
      type: s.aircraftType,
      count: s.flights,
      pct: (s.flights / total) * 100,
      color: typeColor(s.aircraftType, orderedTypes),
    }))
    .sort((a, b) => b.count - a.count)
}

interface Shift {
  type: string
  aPct: number
  bPct: number
  deltaPp: number
  color: string
}

function buildShifts(aSlices: Slice[], bSlices: Slice[]): Shift[] {
  const map = new Map<string, Shift>()
  for (const s of aSlices) {
    map.set(s.type, { type: s.type, aPct: s.pct, bPct: 0, deltaPp: -s.pct, color: s.color })
  }
  for (const s of bSlices) {
    const cur = map.get(s.type)
    if (cur) {
      cur.bPct = s.pct
      cur.deltaPp = s.pct - cur.aPct
    } else {
      map.set(s.type, { type: s.type, aPct: 0, bPct: s.pct, deltaPp: s.pct, color: s.color })
    }
  }
  return [...map.values()].sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp))
}

function Donut({
  slices,
  total,
  label,
  fileName,
  isDark,
}: {
  slices: Slice[]
  total: number
  label: string
  fileName: string
  isDark: boolean
}) {
  const SIZE = 160
  const R = 60
  const STROKE = 18
  const C = SIZE / 2
  const CIRC = 2 * Math.PI * R
  const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'

  let offset = 0
  const topSlice = slices[0]

  return (
    <div className="flex flex-col items-center">
      <div className="text-[13px] font-semibold uppercase tracking-wider text-hz-text-tertiary mb-2">
        {label} ·{' '}
        <span className="normal-case text-hz-text-secondary truncate max-w-[180px] inline-block align-bottom">
          {fileName}
        </span>
      </div>

      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="block -rotate-90">
          {/* Track */}
          <circle cx={C} cy={C} r={R} fill="none" stroke={trackColor} strokeWidth={STROKE} />

          {/* Slices */}
          {slices.map((s) => {
            const len = (s.pct / 100) * CIRC
            const el = (
              <circle
                key={s.type}
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              >
                <title>{`${s.type}: ${s.count.toLocaleString()} flights · ${s.pct.toFixed(1)}%`}</title>
              </circle>
            )
            offset += len
            return el
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[13px] text-hz-text-tertiary uppercase tracking-wider font-semibold">Flights</div>
          <div className="text-[20px] font-bold text-hz-text tabular-nums leading-none">{total.toLocaleString()}</div>
          {topSlice && (
            <div className="mt-1 text-[13px] font-semibold" style={{ color: topSlice.color }}>
              {topSlice.type} {topSlice.pct.toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-[200px]">
        {slices.map((s) => (
          <div key={s.type} className="flex items-center gap-1.5 text-[13px] text-hz-text-secondary">
            <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: s.color }} />
            <span className="font-semibold text-hz-text">{s.type}</span>
            <span className="tabular-nums">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
