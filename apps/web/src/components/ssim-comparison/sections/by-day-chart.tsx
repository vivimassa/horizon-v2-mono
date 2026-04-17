'use client'

import { useMemo } from 'react'
import type { SsimComparisonReport } from '@skyhub/logic'
import { SectionFrame } from './section-frame'

/**
 * Daily flight-count comparison. Inline SVG bar chart — no charting lib.
 * Two bars per day (A then B), so the viewer can spot days where B adds
 * or drops flights vs the baseline.
 */
export function ByDayChart({ report }: { report: SsimComparisonReport }) {
  const days = useMemo(() => buildDailySeries(report), [report])
  const maxVal = useMemo(() => Math.max(1, ...days.map((d) => Math.max(d.a, d.b))), [days])

  if (days.length === 0) return null

  const BAR_WIDTH = 9
  const BAR_GAP = 2
  const GROUP_GAP = 8
  const H = 200
  const TOP_PAD = 10
  const BOT_PAD = 36
  const inner = H - TOP_PAD - BOT_PAD
  const groupWidth = BAR_WIDTH * 2 + BAR_GAP + GROUP_GAP
  const chartWidth = days.length * groupWidth

  return (
    <SectionFrame title="By day" subtitle={`${days.length} day${days.length === 1 ? '' : 's'} in range — A vs B`}>
      <div
        className="rounded-xl p-3 overflow-x-auto"
        style={{
          background: 'var(--color-hz-card, rgba(255,255,255,0.65))',
          border: '1px solid var(--color-hz-border, rgba(0,0,0,0.06))',
          boxShadow: '0 1px 3px rgba(96,97,112,0.10)',
        }}
      >
        <svg width={chartWidth} height={H} className="block">
          {/* baseline */}
          <line
            x1={0}
            x2={chartWidth}
            y1={H - BOT_PAD}
            y2={H - BOT_PAD}
            stroke="currentColor"
            className="text-hz-border"
          />

          {days.map((d, i) => {
            const x0 = i * groupWidth
            const hA = (d.a / maxVal) * inner
            const hB = (d.b / maxVal) * inner
            const xB = x0 + BAR_WIDTH + BAR_GAP
            return (
              <g key={d.date}>
                <rect x={x0} y={H - BOT_PAD - hA} width={BAR_WIDTH} height={hA} fill="#8F90A6" rx={2} opacity={0.6}>
                  <title>{`${d.date} · A: ${d.a}`}</title>
                </rect>
                <rect
                  x={xB}
                  y={H - BOT_PAD - hB}
                  width={BAR_WIDTH}
                  height={hB}
                  fill="var(--module-accent, #1e40af)"
                  rx={2}
                >
                  <title>{`${d.date} · B: ${d.b}`}</title>
                </rect>

                {/* sparse labels — every ~10 groups so 13px text never collides */}
                {days.length <= 10 || i % Math.max(1, Math.ceil(days.length / 10)) === 0 ? (
                  <text
                    x={x0 + BAR_WIDTH}
                    y={H - 14}
                    textAnchor="middle"
                    className="fill-hz-text-tertiary"
                    style={{ fontSize: 13 }}
                  >
                    {d.date.slice(5)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        <div className="flex items-center gap-4 mt-2 text-[13px] text-hz-text-tertiary">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-sm"
              style={{ width: 10, height: 10, background: '#8F90A6', opacity: 0.6 }}
            />
            File A
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-sm"
              style={{ width: 10, height: 10, background: 'var(--module-accent, #1e40af)' }}
            />
            File B
          </div>
        </div>
      </div>
    </SectionFrame>
  )
}

interface DayRow {
  date: string
  a: number
  b: number
}

function buildDailySeries(report: SsimComparisonReport): DayRow[] {
  const map = new Map<string, DayRow>()
  for (const d of report.a.byDay) map.set(d.date, { date: d.date, a: d.flights, b: 0 })
  for (const d of report.b.byDay) {
    const cur = map.get(d.date)
    if (cur) cur.b = d.flights
    else map.set(d.date, { date: d.date, a: 0, b: d.flights })
  }
  return [...map.values()].sort((x, y) => x.date.localeCompare(y.date))
}
