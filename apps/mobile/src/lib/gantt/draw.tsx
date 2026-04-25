// Skia draw layers for the mobile Gantt canvas.
// Each layer is a React component returning Skia primitives. Composed inside
// gantt-canvas.tsx under a single <Canvas> with shared transforms.
//
// Pure presentation — no state, no side effects. All inputs come from the
// shared layout (computed by @skyhub/logic) plus viewport bounds for culling.

import { memo } from 'react'
import { Group, Rect, RoundedRect, Text, Line, vec, type SkFont } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'
import { useDerivedValue } from 'react-native-reanimated'
import type { BarLayout, RowLayout, TickMark, ROW_HEIGHT_LEVELS } from '@skyhub/types'

const ROW_LABELS_WIDTH = 0 // labels live on a separate canvas; canvas content x=0 is timeline-relative
const NOW_LINE_COLOR = '#ef4444'

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

export { ROW_LABELS_WIDTH }
