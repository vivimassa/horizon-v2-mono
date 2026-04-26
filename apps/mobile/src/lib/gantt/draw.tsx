// Skia draw layers for the mobile Gantt canvas.
// Each layer is a React component returning Skia primitives. Composed inside
// gantt-canvas.tsx under a single <Canvas> with shared transforms.
//
// Pure presentation — no state, no side effects. All inputs come from the
// shared layout (computed by @skyhub/logic) plus viewport bounds for culling.

import { memo } from 'react'
import { Circle, Group, Path, Rect, RoundedRect, Text, Line, vec, type SkFont } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'
import { useDerivedValue } from 'react-native-reanimated'
import type { BarLayout, RowLayout, TickMark, ROW_HEIGHT_LEVELS } from '@skyhub/types'
import { SLOT_RISK_COLORS, MISSING_TIMES_FLAG_COLOR, getDisplayTimes } from '@skyhub/logic'

const ROW_LABELS_WIDTH = 0 // labels live on a separate canvas; canvas content x=0 is timeline-relative
// XD danger red for the now-line (matches colors.status.danger).
const NOW_LINE_COLOR = '#FF3B3B'

interface ViewportBounds {
  scrollX: number
  scrollY: number
  width: number
  height: number
}

const inViewportX = (x: number, w: number, vb: ViewportBounds, buffer = 200) =>
  x + w >= vb.scrollX - buffer && x <= vb.scrollX + vb.width + buffer

const inViewportY = (y: number, h: number, vb: ViewportBounds, buffer = 200) =>
  y + h >= vb.scrollY - buffer && y <= vb.scrollY + vb.height + buffer

// ── Grid layer: weekend shading + day boundary verticals + row separators ──

interface GridProps {
  ticks: TickMark[]
  rows: RowLayout[]
  totalWidth: number
  totalHeight: number
  isDark: boolean
  viewport: ViewportBounds
}

export const GridLayer = memo(function GridLayer({
  ticks,
  rows,
  totalWidth,
  totalHeight,
  isDark,
  viewport,
}: GridProps) {
  const majorColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
  const rowSepColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const weekendColor = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)'

  const dayWidth = ticks.length > 1 ? ticks[1].x - ticks[0].x : 0

  return (
    <Group>
      {/* Weekend shading — every Sat/Sun column */}
      {dayWidth > 0 &&
        ticks
          .filter((t) => t.isMajor && t.date)
          .map((t) => {
            const dow = new Date(t.date! + 'T00:00:00Z').getUTCDay()
            if (dow !== 0 && dow !== 6) return null
            if (!inViewportX(t.x, dayWidth, viewport)) return null
            return <Rect key={`we-${t.x}`} x={t.x} y={0} width={dayWidth} height={totalHeight} color={weekendColor} />
          })}

      {/* Major vertical lines (day boundaries) */}
      {ticks
        .filter((t) => t.isMajor)
        .map((t) =>
          inViewportX(t.x, 1, viewport) ? (
            <Line key={`v-${t.x}`} p1={vec(t.x, 0)} p2={vec(t.x, totalHeight)} color={majorColor} strokeWidth={1} />
          ) : null,
        )}

      {/* Row separators */}
      {rows.map((r, i) =>
        inViewportY(r.y, r.height, viewport) ? (
          <Line
            key={`r-${i}`}
            p1={vec(0, r.y + r.height)}
            p2={vec(totalWidth, r.y + r.height)}
            color={rowSepColor}
            strokeWidth={1}
          />
        ) : null,
      )}
    </Group>
  )
})

// ── Group header layer: aircraft type heading bands ──

interface GroupHeadersProps {
  rows: RowLayout[]
  totalWidth: number
  isDark: boolean
  font: SkFont | null
  viewport: ViewportBounds
}

export const GroupHeadersLayer = memo(function GroupHeadersLayer({
  rows,
  totalWidth,
  isDark,
  font,
  viewport,
}: GroupHeadersProps) {
  const bg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const text = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)'

  return (
    <Group>
      {rows
        .filter(
          (r) =>
            r.type === 'group_header' || r.type === 'unassigned' || r.type === 'suspended' || r.type === 'cancelled',
        )
        .map((r, i) =>
          inViewportY(r.y, r.height, viewport) ? (
            <Group key={`gh-${i}`}>
              <Rect x={0} y={r.y} width={totalWidth} height={r.height} color={bg} />
              {font && <Text x={12} y={r.y + r.height / 2 + 4} text={r.label} font={font} color={text} />}
            </Group>
          ) : null,
        )}
    </Group>
  )
})

// ── Bars layer: flight bars with labels ──

interface BarsProps {
  bars: BarLayout[]
  rowConfig: (typeof ROW_HEIGHT_LEVELS)[number]
  font: SkFont | null
  viewport: ViewportBounds
  selectedIds: Set<string>
  accent: string
  /** Reanimated angle (radians) applied to bars whose rotation matches jiggleRotationId. */
  jiggleAngle?: SharedValue<number>
  /** Bars whose flight.rotationId matches this id will jiggle. Null = none. */
  jiggleRotationId?: string | null
  /** When true, selection has been confirmed: solid accent ring instead of jiggle. */
  selectionConfirmed?: boolean
}

export const BarsLayer = memo(function BarsLayer({
  bars,
  font,
  viewport,
  selectedIds,
  accent,
  jiggleAngle,
  jiggleRotationId,
  selectionConfirmed,
}: BarsProps) {
  return (
    <Group>
      {bars.map((b) => {
        if (!inViewportX(b.x, b.width, viewport)) return null
        if (!inViewportY(b.y, b.height, viewport)) return null
        const selected = selectedIds.has(b.flightId)
        const inJiggleSet = !!jiggleRotationId && (b.flight.rotationId ?? `__solo_${b.flight.id}`) === jiggleRotationId
        const showRing = selected && (selectionConfirmed || inJiggleSet)
        const labelWidth = font ? font.measureText(b.label).width : 0
        const showLabel = font && b.width > labelWidth + 10

        const content = (
          <>
            <RoundedRect x={b.x} y={b.y} width={b.width} height={b.height} r={4} color={b.color} />
            {showRing && (
              <RoundedRect
                x={b.x - 1.5}
                y={b.y - 1.5}
                width={b.width + 3}
                height={b.height + 3}
                r={5}
                color={accent}
                style="stroke"
                strokeWidth={2}
              />
            )}
            {showLabel && font && (
              <Text x={b.x + 6} y={b.y + b.height / 2 + 4} text={b.label} font={font} color={b.textColor} />
            )}
          </>
        )

        if (inJiggleSet && jiggleAngle && !selectionConfirmed) {
          return (
            <JigglingBar key={b.flightId} bar={b} jiggleAngle={jiggleAngle}>
              {content}
            </JigglingBar>
          )
        }

        return <Group key={b.flightId}>{content}</Group>
      })}
    </Group>
  )
})

function JigglingBar({
  bar,
  jiggleAngle,
  children,
}: {
  bar: BarLayout
  jiggleAngle: SharedValue<number>
  children: React.ReactNode
}) {
  const cx = bar.x + bar.width / 2
  const cy = bar.y + bar.height / 2
  const transform = useDerivedValue(() => {
    'worklet'
    return [
      { translateX: cx },
      { translateY: cy },
      { rotate: jiggleAngle.value },
      { translateX: -cx },
      { translateY: -cy },
    ]
  })
  return <Group transform={transform}>{children}</Group>
}

// ── Now line ──

interface NowLineProps {
  x: number | null
  totalHeight: number
}

export const NowLineLayer = memo(function NowLineLayer({ x, totalHeight }: NowLineProps) {
  if (x == null) return null
  return <Line p1={vec(x, 0)} p2={vec(x, totalHeight)} color={NOW_LINE_COLOR} strokeWidth={2} />
})

// ── TAT labels: minutes between consecutive bars on same row ──

interface TatProps {
  bars: BarLayout[]
  font: SkFont | null
  isDark: boolean
  viewport: ViewportBounds
}

export const TatLabelsLayer = memo(function TatLabelsLayer({ bars, font, isDark, viewport }: TatProps) {
  if (!font) return null
  const color = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'
  // Group bars by row, sort by x within row
  const byRow = new Map<number, BarLayout[]>()
  for (const b of bars) {
    const list = byRow.get(b.row) ?? []
    list.push(b)
    byRow.set(b.row, list)
  }
  const out: React.ReactElement[] = []
  for (const rowBars of byRow.values()) {
    if (rowBars.length < 2) continue
    rowBars.sort((a, b) => a.x - b.x)
    const firstY = rowBars[0].y
    if (!inViewportY(firstY, rowBars[0].height, viewport)) continue
    for (let i = 0; i < rowBars.length - 1; i++) {
      const curr = rowBars[i]
      const next = rowBars[i + 1]
      const gap = next.x - (curr.x + curr.width)
      if (gap < 25) continue
      if (!inViewportX(curr.x + curr.width, gap, viewport)) continue
      const tatMs = getDisplayTimes(next.flight).depMs - getDisplayTimes(curr.flight).arrMs
      if (tatMs <= 0) continue
      const tatMin = Math.round(tatMs / 60_000)
      if (tatMin >= 180) continue
      const label = `${String(Math.floor(tatMin / 60)).padStart(2, '0')}:${String(tatMin % 60).padStart(2, '0')}`
      const labelW = font.measureText(label).width
      const cx = curr.x + curr.width + gap / 2 - labelW / 2
      const cy = curr.y + curr.height / 2 + 3
      out.push(<Text key={`tat-${curr.flightId}`} x={cx} y={cy} text={label} font={font} color={color} />)
    }
  }
  return <Group>{out}</Group>
})

// ── Slot risk lines: thin colored bar under flight bars ──

interface SlotRiskProps {
  bars: BarLayout[]
  viewport: ViewportBounds
}

export const SlotRiskLayer = memo(function SlotRiskLayer({ bars, viewport }: SlotRiskProps) {
  const LINE_H = 3
  const LINE_GAP = 2
  return (
    <Group>
      {bars.map((b) => {
        const risk = b.flight.slotRiskLevel
        if (!risk || risk === 'safe') return null
        const color = SLOT_RISK_COLORS[risk]
        if (!color) return null
        if (!inViewportX(b.x, b.width, viewport)) return null
        const lineY = b.y + b.height + LINE_GAP
        if (!inViewportY(lineY, LINE_H, viewport)) return null
        return (
          <RoundedRect
            key={`sr-${b.flightId}`}
            x={b.x}
            y={lineY}
            width={b.width}
            height={LINE_H}
            r={LINE_H / 2}
            color={color}
          />
        )
      })}
    </Group>
  )
})

// ── Missing-times flags: orange triangular flags at top corners of bars missing OOOI ──

interface MissingTimesProps {
  bars: BarLayout[]
  graceMins: number
  /** Tick — pass a value that changes every 60s so the layer recomputes against current time. */
  nowTick: number
  viewport: ViewportBounds
}

export const MissingTimesLayer = memo(function MissingTimesLayer({
  bars,
  graceMins,
  nowTick,
  viewport,
}: MissingTimesProps) {
  // nowTick referenced so memoization invalidates each minute
  void nowTick
  const now = Date.now()
  const graceMs = graceMins * 60_000
  const FLAG_SIZE = 10
  return (
    <Group>
      {bars.map((b) => {
        if (!inViewportX(b.x, b.width, viewport)) return null
        if (!inViewportY(b.y, b.height, viewport)) return null
        const f = b.flight
        const etdVal = f.etdUtc ?? Number.POSITIVE_INFINITY
        const depThreshold = Math.min(f.stdUtc, etdVal) + graceMs
        const depMissing = now >= depThreshold && (!f.atdUtc || !f.offUtc)
        const etaVal = f.etaUtc ?? Number.POSITIVE_INFINITY
        const arrThreshold = Math.min(f.staUtc, etaVal) + graceMs
        const arrMissing = now >= arrThreshold && (!f.ataUtc || !f.onUtc)
        if (!depMissing && !arrMissing) return null
        const fs = Math.max(4, Math.min(FLAG_SIZE, b.width / 2, b.height))
        const items: React.ReactElement[] = []
        if (depMissing) {
          const path = `M ${b.x} ${b.y} L ${b.x + fs} ${b.y} L ${b.x} ${b.y + fs} Z`
          items.push(<Path key={`mtL-${b.flightId}`} path={path} color={MISSING_TIMES_FLAG_COLOR} />)
        }
        if (arrMissing) {
          const rx = b.x + b.width
          const path = `M ${rx} ${b.y} L ${rx - fs} ${b.y} L ${rx} ${b.y + fs} Z`
          items.push(<Path key={`mtR-${b.flightId}`} path={path} color={MISSING_TIMES_FLAG_COLOR} />)
        }
        return <Group key={`mt-${b.flightId}`}>{items}</Group>
      })}
    </Group>
  )
})

// ── Drag ghost layer: floating translucent copies of dragged bars ──

interface DragGhostProps {
  bars: BarLayout[]
  draggedIds: Set<string>
  deltaX: SharedValue<number>
  deltaY: SharedValue<number>
  active: SharedValue<boolean>
  accent: string
}

export const DragGhostLayer = memo(function DragGhostLayer({
  bars,
  draggedIds,
  deltaX,
  deltaY,
  active,
  accent,
}: DragGhostProps) {
  if (draggedIds.size === 0) return null
  return (
    <Group>
      {bars.map((b) => {
        if (!draggedIds.has(b.flightId)) return null
        return (
          <DragGhostBar
            key={`gh-${b.flightId}`}
            bar={b}
            deltaX={deltaX}
            deltaY={deltaY}
            active={active}
            accent={accent}
          />
        )
      })}
    </Group>
  )
})

function DragGhostBar({
  bar,
  deltaX,
  deltaY,
  active,
  accent,
}: {
  bar: BarLayout
  deltaX: SharedValue<number>
  deltaY: SharedValue<number>
  active: SharedValue<boolean>
  accent: string
}) {
  const transform = useDerivedValue(() => {
    'worklet'
    return [{ translateX: active.value ? deltaX.value : 0 }, { translateY: active.value ? deltaY.value : 0 }]
  })
  const opacity = useDerivedValue(() => {
    'worklet'
    return active.value ? 0.55 : 0
  })
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect x={bar.x} y={bar.y} width={bar.width} height={bar.height} r={4} color={bar.color} />
      <RoundedRect
        x={bar.x - 1.5}
        y={bar.y - 1.5}
        width={bar.width + 3}
        height={bar.height + 3}
        r={5}
        color={accent}
        style="stroke"
        strokeWidth={2}
      />
    </Group>
  )
}

// ── Delay markers: red dot + minutes text above bars with considerable delay ──

interface DelaysProps {
  bars: BarLayout[]
  considerableMins: number
  font: SkFont | null
  viewport: ViewportBounds
}

export const DelaysLayer = memo(function DelaysLayer({ bars, considerableMins, font, viewport }: DelaysProps) {
  const DOT = 4
  const color = '#FF3B3B'
  return (
    <Group>
      {bars.map((b) => {
        const delays = b.flight.delays
        if (!delays || delays.length === 0) return null
        const total = delays.reduce((s, d) => s + (d.minutes ?? 0), 0)
        if (total < considerableMins) return null
        if (!inViewportX(b.x, b.width, viewport)) return null
        if (!inViewportY(b.y - DOT, b.height + DOT, viewport)) return null
        const cx = b.x + DOT + 1
        const cy = b.y - DOT - 1
        const label = `+${total}`
        return (
          <Group key={`dl-${b.flightId}`}>
            <Circle cx={cx} cy={cy} r={DOT} color={color} />
            {font && <Text x={cx + DOT + 3} y={cy + 4} text={label} font={font} color={color} />}
          </Group>
        )
      })}
    </Group>
  )
})

export { ROW_LABELS_WIDTH }
