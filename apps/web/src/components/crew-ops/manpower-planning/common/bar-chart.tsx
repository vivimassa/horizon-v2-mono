'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/components/theme-provider'
import { colors } from '@skyhub/ui/theme'

export interface BarSeries {
  key: string
  label: string
  color: string
  values: number[] // 12 months — Required
  availableValues?: number[] // 12 months — optional Available (for tooltip delta)
}

interface Props {
  series: BarSeries[]
  months: string[]
  height?: number
}

interface HoverState {
  month: string
  monthIndex: number
  series: BarSeries
}

/** Grouped bar chart — one group per month, one bar per series.
 *  Lightweight SVG (no external lib). Hover reveals a SkyHub-compliant
 *  glass tooltip portaled to `document.body` — matches the 2.1.1
 *  Movement Control hover tooltip pattern. */
export function GroupedBarChart({ series, months, height = 260 }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const palette = isDark ? colors.dark : colors.light
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [hover, setHover] = useState<HoverState | null>(null)

  const maxVal = useMemo(() => {
    let max = 0
    for (const s of series) for (const v of s.values) if (v > max) max = v
    return max || 1
  }, [series])

  // Round max up to a sensible tick.
  const ticks = useMemo(() => {
    const step = niceStep(maxVal / 4)
    const top = Math.ceil(maxVal / step) * step
    const out: number[] = []
    for (let v = 0; v <= top; v += step) out.push(v)
    return out
  }, [maxVal])
  const topTick = ticks[ticks.length - 1] || maxVal

  return (
    <div className="w-full" style={{ color: palette.textSecondary }}>
      <svg
        viewBox={`0 0 1200 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        onMouseMove={(e) => {
          mousePosRef.current = { x: e.clientX, y: e.clientY }
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Gridlines + y-axis labels */}
        {ticks.map((t) => {
          const y = height - 30 - (t / topTick) * (height - 60)
          return (
            <g key={t}>
              <line
                x1={40}
                y1={y}
                x2={1200}
                y2={y}
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                strokeWidth={1}
              />
              <text x={4} y={y + 4} fontSize={11} fill={palette.textTertiary as string}>
                {t}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {months.map((m, mi) => {
          const groupW = (1200 - 40) / 12
          const groupX = 40 + groupW * mi
          const n = series.length
          const barW = Math.max(4, (groupW - 12) / n)
          return (
            <g key={m}>
              {series.map((s, si) => {
                const v = s.values[mi] ?? 0
                const h = (v / topTick) * (height - 60)
                const x = groupX + 6 + si * barW
                const y = height - 30 - h
                const isActive = hover && hover.monthIndex === mi && hover.series.key === s.key
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={y}
                    width={barW - 2}
                    height={h}
                    rx={2}
                    fill={s.color}
                    style={{ cursor: 'pointer', transition: 'opacity 120ms ease' }}
                    opacity={hover && !isActive ? 0.45 : 1}
                    onMouseEnter={(e) => {
                      mousePosRef.current = { x: e.clientX, y: e.clientY }
                      setHover({ month: m, monthIndex: mi, series: s })
                    }}
                    onMouseMove={(e) => {
                      mousePosRef.current = { x: e.clientX, y: e.clientY }
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                )
              })}
              <text
                x={groupX + groupW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize={11}
                fill={palette.textTertiary as string}
              >
                {m.toUpperCase()}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-2 text-[13px]">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span style={{ color: palette.textSecondary }}>{s.label}</span>
          </span>
        ))}
      </div>

      <BarHoverTooltip hover={hover} isDark={isDark} mousePosRef={mousePosRef} />
    </div>
  )
}

function niceStep(raw: number): number {
  if (raw <= 1) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / exp
  const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
  return nice * exp
}

// ─── Hover tooltip ──────────────────────────────────────────────
// Inverted-glass panel portaled to <body>. Tracks the mouse via DOM
// (no React re-renders per move). Style matches 2.1.1 Movement
// Control's `gantt-flight-tooltip.tsx`.
function BarHoverTooltip({
  hover,
  isDark,
  mousePosRef,
}: {
  hover: HoverState | null
  isDark: boolean
  mousePosRef: React.RefObject<{ x: number; y: number }>
}) {
  const tipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const el = tipRef.current
    if (!el || !hover) return

    const reposition = (x: number, y: number) => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      const MARGIN = 14
      const PAD = 8
      const vpW = window.innerWidth
      const vpH = window.innerHeight
      let left = x + MARGIN
      let top = y - MARGIN - h
      if (top < PAD) top = y + MARGIN
      if (top + h > vpH - PAD) top = vpH - h - PAD
      if (top < PAD) top = PAD
      if (left + w > vpW - PAD) left = x - w - MARGIN
      if (left < PAD) left = PAD
      el.style.left = left + 'px'
      el.style.top = top + 'px'
      el.style.visibility = 'visible'
    }

    reposition(mousePosRef.current.x, mousePosRef.current.y)
    const onMove = (e: MouseEvent) => reposition(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [hover, mousePosRef])

  if (!mounted || !hover) return null

  const required = hover.series.values[hover.monthIndex] ?? 0
  const available = hover.series.availableValues?.[hover.monthIndex]
  const hasAvail = typeof available === 'number'
  const delta = hasAvail ? available! - required : 0
  const deltaColor = delta < 0 ? '#FF3B3B' : delta > 0 ? '#06C270' : undefined

  const bg = isDark ? 'rgba(244,244,245,0.92)' : 'rgba(24,24,27,0.88)'
  const border = isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const heading = isDark ? '#18181b' : '#fafafa'
  const body = isDark ? 'rgba(24,24,27,0.70)' : 'rgba(250,250,250,0.70)'
  const muted = isDark ? 'rgba(24,24,27,0.55)' : 'rgba(250,250,250,0.50)'

  const content = (
    <div
      ref={tipRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        visibility: 'hidden',
        zIndex: 9999,
        pointerEvents: 'none',
        minWidth: 240,
      }}
    >
      <div
        className="rounded-xl p-4 space-y-2.5 text-[13px]"
        style={{
          background: bg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header: colored position badge + month label */}
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-bold px-2 py-0.5 rounded"
            style={{
              background: `${hover.series.color}22`,
              color: hover.series.color,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: hover.series.color }} />
            {hover.series.label}
          </span>
          <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: muted }}>
            {hover.month}
          </span>
        </div>

        {/* Info grid */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <span style={{ color: muted }}>Required</span>
            <span className="tabular-nums font-bold text-[17px]" style={{ color: heading }}>
              {required.toLocaleString()}
            </span>
          </div>
          {hasAvail && (
            <>
              <div className="flex justify-between items-baseline">
                <span style={{ color: muted }}>Available</span>
                <span className="tabular-nums font-semibold text-[14px]" style={{ color: body }}>
                  {available!.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span style={{ color: muted }}>Gap</span>
                <span
                  className="tabular-nums font-bold text-[14px]"
                  style={{
                    color: deltaColor ?? heading,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: delta < 0 ? 'rgba(255,59,59,0.15)' : delta > 0 ? 'rgba(6,194,112,0.15)' : 'transparent',
                  }}
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
