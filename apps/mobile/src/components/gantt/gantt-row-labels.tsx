// Sticky row labels (aircraft column) for the Gantt — Skia canvas pinned left.
// Reads scrollY from GanttScrollContext to sync with the body during vertical pan.

import { Canvas, Group, Line, Rect, Text, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useGanttScroll } from './gantt-scroll-context'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useCanvasFont } from '../../lib/gantt/use-canvas-font'

const DEFAULT_LABELS_WIDTH = 96

interface Props {
  height: number
  isDark: boolean
  width?: number
}

export function GanttRowLabels({ height, isDark, width }: Props) {
  const LABELS_WIDTH = width ?? DEFAULT_LABELS_WIDTH
  const { palette } = useAppTheme()
  const { scrollY } = useGanttScroll()
  const layout = useMobileGanttStore((s) => s.layout)
  const toggleTypeCollapse = useMobileGanttStore((s) => s.toggleTypeCollapse)
  const collapsed = useMobileGanttStore((s) => s.collapsedTypes)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)

  const rows = layout?.rows ?? []
  const totalHeight = layout?.totalHeight ?? height

  const bg = palette.background
  const groupBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const text = palette.text
  const subText = palette.textTertiary
  const border = palette.border

  const labelFont = useFont(13)
  const subFont = useFont(13)

  const transform = useDerivedValue(() => [{ translateY: -scrollY.value }])

  function handleTap(y: number) {
    const absoluteY = y + scrollY.value
    const row = rows.find((r) => absoluteY >= r.y && absoluteY < r.y + r.height)
    if (!row) return
    if (row.type === 'group_header' && row.aircraftTypeIcao) {
      toggleTypeCollapse(row.aircraftTypeIcao)
    } else if (row.type === 'aircraft' && row.registration) {
      openDetailSheet({ kind: 'aircraft', registration: row.registration })
    }
  }

  function handleLongPress(y: number) {
    const absoluteY = y + scrollY.value
    const row = rows.find((r) => absoluteY >= r.y && absoluteY < r.y + r.height)
    if (!row || row.type !== 'aircraft' || !row.registration) return
    openMutationSheet({ kind: 'aircraftContext', registration: row.registration })
  }

  const tap = Gesture.Tap().onEnd((e) => {
    'worklet'
    runOnJS(handleTap)(e.y)
  })

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(8)
    .onStart((e) => {
      'worklet'
      runOnJS(handleLongPress)(e.y)
    })

  const composed = Gesture.Race(longPress, tap)

  return (
    <GestureDetector gesture={composed}>
      <Canvas style={{ width: LABELS_WIDTH, height }}>
        <Rect x={0} y={0} width={LABELS_WIDTH} height={height} color={bg} />
        <Group transform={transform}>
          {rows.map((r, i) => (
            <Group key={i}>
              {r.type === 'group_header' && (
                <>
                  <Rect x={0} y={r.y} width={LABELS_WIDTH} height={r.height} color={groupBg} />
                  {labelFont && r.aircraftTypeIcao && (
                    <Text
                      x={10}
                      y={r.y + r.height / 2 + 4}
                      text={(collapsed.has(r.aircraftTypeIcao) ? '▸ ' : '▾ ') + r.aircraftTypeIcao}
                      font={labelFont}
                      color={text}
                    />
                  )}
                </>
              )}
              {r.type === 'aircraft' && labelFont && (
                <Text x={14} y={r.y + r.height / 2 + 4} text={r.registration ?? ''} font={labelFont} color={text} />
              )}
              {(r.type === 'unassigned' || r.type === 'suspended' || r.type === 'cancelled') && subFont && (
                <Text x={10} y={r.y + r.height / 2 + 4} text={r.label} font={subFont} color={subText} />
              )}
            </Group>
          ))}
        </Group>
        <Line p1={vec(LABELS_WIDTH - 1, 0)} p2={vec(LABELS_WIDTH - 1, height)} color={border} strokeWidth={1} />
      </Canvas>
    </GestureDetector>
  )
}

GanttRowLabels.WIDTH = DEFAULT_LABELS_WIDTH

const useFont = useCanvasFont
