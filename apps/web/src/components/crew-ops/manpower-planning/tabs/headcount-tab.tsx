'use client'

import { useMemo } from 'react'
import { useTheme } from '@/components/theme-provider'
import { colors, type Palette } from '@skyhub/ui/theme'
import { crewAccent } from '@/components/crew-ops/crew-profile/common/draft-helpers'
import { GroupedBarChart, type BarSeries } from '../common/bar-chart'
import { positionColor } from '../common/position-colors'
import { useEngineCompute } from '../common/use-engine-compute'
import type { ManpowerEngineBundle } from '../manpower-planning-shell'

interface Props {
  bundle: ManpowerEngineBundle
}

export function HeadcountTab({ bundle }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const accent = crewAccent(isDark)
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const { months, positions, required, available, totalBh, totalAc } = useEngineCompute(bundle)

  const series: BarSeries[] = useMemo(
    () =>
      positions.map((p) => ({
        key: p.id,
        label: p.name,
        color: positionColor(p.code, p.color),
        values: required[p.name] ?? new Array(12).fill(0),
        availableValues: available[p.name] ?? new Array(12).fill(0),
      })),
    [positions, required, available],
  )

  // KPIs
  const peakRequired = useMemo(() => {
    let peak = 0
    let peakMonth = 0
    let peakPos = ''
    for (const p of positions) {
      const arr = required[p.name] ?? []
      arr.forEach((v, m) => {
        if (v > peak) {
          peak = v
          peakMonth = m
          peakPos = p.name
        }
      })
    }
    return { peak, peakMonth, peakPos }
  }, [positions, required])

  const criticalGaps = useMemo(() => {
    let count = 0
    for (const p of positions) {
      const req = required[p.name] ?? []
      const avail = available[p.name] ?? []
      for (let m = 0; m < 12; m++) {
        if ((avail[m] ?? 0) - (req[m] ?? 0) < 0) count++
      }
    }
    return count
  }, [positions, required, available])

  const totalCrew = useMemo(() => {
    let sum = 0
    for (const p of positions) sum += available[p.name]?.[0] ?? 0
    return sum
  }, [positions, available])

  return (
    <div className="p-5 space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="Peak Required"
          value={peakRequired.peak.toString()}
          hint={peakRequired.peakPos ? `${peakRequired.peakPos} · ${months[peakRequired.peakMonth]}` : '—'}
          accent={accent}
          palette={palette}
          isDark={isDark}
        />
        <KpiCard
          label="Critical-Gap Months"
          value={criticalGaps.toString()}
          hint={criticalGaps === 0 ? 'No gaps — plan is covered' : 'Position × month count with gap < 0'}
          accent={criticalGaps > 0 ? '#E63535' : '#06C270'}
          palette={palette}
          isDark={isDark}
        />
        <KpiCard
          label="Total Crew · Start Year"
          value={totalCrew.toString()}
          hint="Live headcount in Jan (from crew DB)"
          accent={accent}
          palette={palette}
          isDark={isDark}
        />
      </div>

      {/* Chart */}
      <section
        className="rounded-xl p-4"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          border: `1px solid ${border}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
          <h3 className="text-[15px] font-bold" style={{ color: palette.text }}>
            Required Headcount
          </h3>
          <span
            className="ml-auto text-[13px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${accent}22`, color: accent }}
          >
            {bundle.year}
          </span>
        </div>
        <GroupedBarChart series={series} months={months} />
      </section>

      {/* Monthly summary: Block Hours + Aircraft */}
      <section
        className="rounded-xl overflow-hidden"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
          border: `1px solid ${border}`,
        }}
      >
        <SummaryRow
          label="Block Hours"
          values={totalBh.map((v) => Math.round(v).toLocaleString())}
          palette={palette}
          isDark={isDark}
        />
        <SummaryRow label="Aircraft" values={totalAc.map(String)} palette={palette} isDark={isDark} last />
      </section>

      {/* Monthly detail */}
      <section
        className="rounded-xl overflow-hidden"
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
          border: `1px solid ${border}`,
        }}
      >
        <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: border }}>
          <div className="w-[3px] h-5 rounded-full" style={{ background: accent }} />
          <h3 className="text-[15px] font-bold" style={{ color: palette.text }}>
            Monthly Detail
          </h3>
        </div>
        <div
          className="grid text-[13px]"
          style={{
            gridTemplateColumns: '120px repeat(12, minmax(70px, 1fr))',
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            color: palette.textSecondary,
          }}
        >
          <div className="px-3 py-2 font-semibold uppercase tracking-wide">Position</div>
          {months.map((m) => (
            <div key={m} className="px-3 py-2 text-center font-semibold uppercase tracking-wide">
              {m}
            </div>
          ))}
        </div>
        {positions.map((p) => {
          const reqArr = required[p.name] ?? []
          const availArr = available[p.name] ?? []
          return (
            <div
              key={p.id}
              className="grid text-[13px] border-t"
              style={{
                gridTemplateColumns: '120px repeat(12, minmax(70px, 1fr))',
                borderColor: border,
                color: palette.text,
              }}
            >
              <div className="px-3 py-3 flex items-center gap-2 font-medium">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: positionColor(p.code, p.color) }}
                />
                {p.code}
              </div>
              {months.map((_m, mi) => {
                const req = reqArr[mi] ?? 0
                const avail = availArr[mi] ?? 0
                const delta = avail - req
                const color = delta < 0 ? '#E63535' : delta > 0 ? '#06C270' : palette.textTertiary
                const bg = delta < 0 ? '#E6353522' : delta > 0 ? '#06C27022' : 'transparent'
                return (
                  <div key={mi} className="px-2 py-2 text-center">
                    <div className="font-semibold">{req}</div>
                    <span
                      className="text-[13px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: bg, color }}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  palette,
  isDark,
}: {
  label: string
  value: string
  hint: string
  accent: string
  palette: Palette
  isDark: boolean
}) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
        border: `1px solid ${border}`,
      }}
    >
      <p className="text-[13px] uppercase tracking-wider font-medium" style={{ color: palette.textSecondary }}>
        {label}
      </p>
      <p className="text-[24px] font-bold leading-tight mt-1" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-[13px] mt-1" style={{ color: palette.textTertiary }}>
        {hint}
      </p>
    </div>
  )
}

function SummaryRow({
  label,
  values,
  palette,
  isDark,
  last,
}: {
  label: string
  values: string[]
  palette: Palette
  isDark: boolean
  last?: boolean
}) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  return (
    <div
      className="grid text-[13px]"
      style={{
        gridTemplateColumns: '120px repeat(12, minmax(70px, 1fr))',
        borderBottom: last ? 'none' : `1px solid ${border}`,
        color: palette.text,
      }}
    >
      <div
        className="px-3 py-2 font-semibold uppercase tracking-wide"
        style={{
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          color: palette.textSecondary,
        }}
      >
        {label}
      </div>
      {values.map((v, i) => (
        <div key={i} className="px-3 py-2 text-center font-mono" style={{ color: palette.text }}>
          {v}
        </div>
      ))}
    </div>
  )
}
