// Sticky time header for the Gantt — Skia canvas pinned to the top.
// Reads scrollX from GanttScrollContext so it stays glued to the body during pan.

import { useMemo } from 'react'
import { View } from 'react-native'
import { Canvas, Group, Line, Rect, Text, matchFont, vec, type SkFont } from '@shopify/react-native-skia'
import { useDerivedValue, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useGanttScroll } from './gantt-scroll-context'
import { useMobileGanttStore } from '../../stores/use-mobile-gantt-store'

const HEADER_HEIGHT = 44

interface Props {
  width: number
  isDark: boolean
}

export function GanttTimeHeader({ width, isDark }: Props) {
  const { scrollX } = useGanttScroll()
  const layout = useMobileGanttStore((s) => s.layout)
  const openDetailSheet = useMobileGanttStore((s) => s.openDetailSheet)
  const ticks = layout?.ticks ?? []
  const totalWidth = layout?.totalWidth ?? width

  function handleTap(absX: number) {
    // Find the major tick whose column the tap falls in.
    const majors = ticks.filter((t) => t.isMajor && t.date)
    if (majors.length === 0) return
    let target = majors[0]
    for (const m of majors) {
      if (m.x <= absX) target = m
      else break
    }
    if (target.date) openDetailSheet({ kind: 'day', date: target.date })
  }

  const tap = Gesture.Tap().onEnd((e) => {
    'worklet'
    const absX = e.x + scrollX.value
    runOnJS(handleTap)(absX)
  })

  const bg = isDark ? '#0E0E14' : '#FAFAFC'
  const text = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)'
  const subText = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'

  const majorFont = useFont(13)
  const minorFont = useFont(11)

  const transform = useDerivedValue(() => [{ translateX: -scrollX.value }])

  return (
    <GestureDetector gesture={tap}>
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
