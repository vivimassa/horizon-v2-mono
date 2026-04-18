'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { SectionHeader } from './section-header'
import type { TrendPoint } from './schedule-summary-types'

const FLIGHTS_COLOR = 'var(--module-accent, #1e40af)'
const SEATS_COLOR = '#FF8800'

interface Props {
  trend: TrendPoint[]
}

const MIN_W = 600
const CHART_H = 240

export function CapacityTrendCard({ trend }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [vbW, setVbW] = useState<number>(MIN_W)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setVbW(Math.max(MIN_W, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (trend.length < 2) return null

  const vbH = CHART_H
  const padL = 64
  const padR = 20
  const padT = 20
  const padB = 36
  const chartW = vbW - padL - padR
  const chartH = vbH - padT - padB

  const maxFlights = Math.max(...trend.map((w) => w.flights))
  const maxSeats = Math.max(...trend.map((w) => w.seats))
  const peakIdx = trend.findIndex((w) => w.flights === maxFlights)

  const yStep = Math.max(1, Math.ceil(maxFlights / 4))
  const gridLines: number[] = []
  for (let v = 0; v <= maxFlights + yStep; v += yStep) gridLines.push(v)
  const yMax = gridLines[gridLines.length - 1] || 1

  const xScale = (i: number) => (trend.length === 1 ? padL + chartW / 2 : padL + (i / (trend.length - 1)) * chartW)
  const yFlights = (v: number) => padT + chartH - (v / yMax) * chartH
  const ySeats = (v: number) => padT + chartH - (v / (maxSeats || 1)) * chartH

  const flightsPath = trend.map((w, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yFlights(w.flights)}`).join(' ')
  const areaPath = `${flightsPath} L${xScale(trend.length - 1)},${padT + chartH} L${padL},${padT + chartH} Z`
  const seatsPath = trend.map((w, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${ySeats(w.seats)}`).join(' ')

  // Adaptive label interval based on pixel density per week (~68px min spacing).
  const MIN_LABEL_PX = 68
  const labelInterval = Math.max(1, Math.ceil((MIN_LABEL_PX * (trend.length - 1)) / chartW))

  const axisColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const axisLabelColor = isDark ? 'rgba(245,245,245,0.65)' : 'rgba(17,17,17,0.60)'

  const cardBg = isDark ? 'rgba(25,25,33,0.80)' : 'rgba(255,255,255,0.95)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const peakWeek = trend.reduce((b, w) => (w.flights > b.flights ? w : b), trend[0])

  return (
    <div className="mb-6">
      <SectionHeader title="Weekly Capacity Trend" description="Flights and seats per ISO week across the period" />
      <div
        className="rounded-[12px] p-4"
        style={{
          background: cardBg,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.18)'
            : '0 1px 2px rgba(96,97,112,0.06), 0 1px 3px rgba(96,97,112,0.04)',
        }}
      >
        <div ref={containerRef} className="w-full">
          <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height={CHART_H} preserveAspectRatio="none">
            <defs>
              <linearGradient id="hz-ss-flight-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={FLIGHTS_COLOR} stopOpacity="0.22" />
                <stop offset="100%" stopColor={FLIGHTS_COLOR} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {gridLines.map((v) => (
              <g key={v}>
                <line
                  x1={padL}
                  y1={yFlights(v)}
                  x2={vbW - padR}
                  y2={yFlights(v)}
                  stroke={axisColor}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={padL - 10}
                  y={yFlights(v) + 4}
                  textAnchor="end"
                  fill={axisLabelColor}
                  fontSize="13"
                  fontWeight="500"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {v.toLocaleString()}
                </text>
              </g>
            ))}

            <path d={areaPath} fill="url(#hz-ss-flight-area)" />
            <path
              d={seatsPath}
              fill="none"
              stroke={SEATS_COLOR}
              strokeWidth="2"
              strokeDasharray="6,4"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={flightsPath}
              fill="none"
              stroke={FLIGHTS_COLOR}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />

            {peakIdx >= 0 && trend.length > 0 && (
              <g>
                <circle
                  cx={xScale(peakIdx)}
                  cy={yFlights(trend[peakIdx].flights)}
                  r="5"
                  fill={FLIGHTS_COLOR}
                  stroke={isDark ? '#191921' : '#ffffff'}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={xScale(peakIdx)}
                  y={yFlights(trend[peakIdx].flights) - 10}
                  textAnchor="middle"
                  fill={FLIGHTS_COLOR}
                  fontSize="13"
                  fontWeight="600"
                >
                  Peak
                </text>
              </g>
            )}

            {trend.map((w, i) =>
              i % labelInterval === 0 ? (
                <text
                  key={i}
                  x={xScale(i)}
                  y={vbH - 12}
                  textAnchor="middle"
                  fill={axisLabelColor}
                  fontSize="13"
                  fontWeight="500"
                >
                  {w.label}
                </text>
              ) : null,
            )}
          </svg>
        </div>

        <div className="flex items-center justify-center gap-6 mt-3 pt-3" style={{ borderTop: `1px solid ${border}` }}>
          <Legend color={FLIGHTS_COLOR} label="Flights" />
          <Legend color={SEATS_COLOR} label="Seats" dashed />
          <span className="text-[13px] text-hz-text-secondary">
            Peak: W{peakWeek.weekNum} ({peakWeek.flights.toLocaleString()} flights)
          </span>
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[13px] font-medium text-hz-text">
      <span
        className="inline-block"
        style={{
          width: 20,
          height: 0,
          borderTop: `${dashed ? '2px dashed' : '2px solid'} ${color}`,
        }}
      />
      {label}
    </span>
  )
}
