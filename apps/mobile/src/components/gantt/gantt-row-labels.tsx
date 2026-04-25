// Sticky row labels (aircraft column) for the Gantt — Skia canvas pinned left.
// Reads scrollY from GanttScrollContext to sync with the body during vertical pan.

import { useMemo } from 'react'
import { Canvas, Group, Line, Rect, Text, matchFont, vec, type SkFont } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { useGanttScroll } from './gantt-scroll-context'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'

const LABELS_WIDTH = 96

interface Props {
  height: number
  isDark: boolean
}

export function GanttRowLabels({ height, isDark }: Props) {
  const { scrollY } = useGanttScroll()
  const layout = useMobileGanttStore((s) => s.layout)
  const toggleTypeCollapse = useMobileGanttStore((s) => s.toggleTypeCollapse)
  const collapsed = useMobileGanttStore((s) => s.collapsedTypes)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)

  const rows = layout?.rows ?? []
  const totalHeight = layout?.totalHeight ?? height

  const bg = isDark ? '#0E0E14' : '#FAFAFC'
  const groupBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const text = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)'
  const subText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  const labelFont = useFont(13)
  const subFont = useFont(11)

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

  const tap = Gesture.Tap().onEnd((e) => {
    'worklet'
    runOnJS(handleTap)(e.y)
  })

  return (
    <GestureDetector gesture={tap}>
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

GanttRowLabels.WIDTH = LABELS_WIDTH

function useFont(size: number): SkFont | null {
  return useMemo(
    () =>
      matchFont({
        fontFamily: 'System',
        fontSize: size,
        fontStyle: 'normal',
        fontWeight: 'normal',
      }),
    [size],
  )
}
