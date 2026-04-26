// Sticky time header for the Gantt — Skia canvas pinned to the top.
// Reads scrollX from GanttScrollContext so it stays glued to the body during pan.

import { View } from 'react-native'
import { Canvas, Group, Line, Rect, Text, vec } from '@shopify/react-native-skia'
import { useCanvasFont } from '../../lib/gantt/use-canvas-font'
import { useDerivedValue, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useGanttScroll } from './gantt-scroll-context'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'
import { useAppTheme } from '../../../providers/ThemeProvider'

const HEADER_HEIGHT = 44

interface Props {
  width: number
  isDark: boolean
}

export function GanttTimeHeader({ width, isDark }: Props) {
  void isDark
  const { palette } = useAppTheme()
  const { scrollX } = useGanttScroll()
  const layout = useMobileGanttStore((s) => s.layout)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)
  const openMutationSheet = useMobileGanttStore((s) => s.openMutationSheet)
  const ticks = layout?.ticks ?? []
  const totalWidth = layout?.totalWidth ?? width

  function findDayAt(absX: number): string | null {
    const majors = ticks.filter((t) => t.isMajor && t.date)
    if (majors.length === 0) return null
    let target = majors[0]
    for (const m of majors) {
      if (m.x <= absX) target = m
      else break
    }
    return target.date ?? null
  }

  function handleTap(absX: number) {
    const date = findDayAt(absX)
    if (date) openDetailSheet({ kind: 'day', date })
  }
  function handleLongPress(absX: number) {
    const date = findDayAt(absX)
    if (date) openMutationSheet({ kind: 'dayContext', date })
  }

  const tap = Gesture.Tap().onEnd((e) => {
    'worklet'
    const absX = e.x + scrollX.value
    runOnJS(handleTap)(absX)
  })
  const longPress = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(8)
    .onStart((e) => {
      'worklet'
      const absX = e.x + scrollX.value
      runOnJS(handleLongPress)(absX)
    })
  const composed = Gesture.Race(longPress, tap)

  const bg = palette.background
  const text = palette.text
  const subText = palette.textTertiary
  const border = palette.border

  const majorFont = useFont(13)
  const minorFont = useFont(13)

  const transform = useDerivedValue(() => [{ translateX: -scrollX.value }])

  return (
    <GestureDetector gesture={composed}>
      <View>
        <Canvas style={{ width, height: HEADER_HEIGHT }}>
          <Rect x={0} y={0} width={width} height={HEADER_HEIGHT} color={bg} />
          <Group transform={transform}>
            {ticks.map((t, i) => (
              <Group key={i}>
                {t.isMajor && <Line p1={vec(t.x, 0)} p2={vec(t.x, HEADER_HEIGHT)} color={border} strokeWidth={1} />}
                {majorFont && t.isMajor && <Text x={t.x + 6} y={18} text={t.label} font={majorFont} color={text} />}
                {minorFont && !t.isMajor && <Text x={t.x + 4} y={34} text={t.label} font={minorFont} color={subText} />}
              </Group>
            ))}
          </Group>
          <Line p1={vec(0, HEADER_HEIGHT - 1)} p2={vec(width, HEADER_HEIGHT - 1)} color={border} strokeWidth={1} />
        </Canvas>
      </View>
    </GestureDetector>
  )
}

GanttTimeHeader.HEIGHT = HEADER_HEIGHT

const useFont = useCanvasFont
