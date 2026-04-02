import { memo, useRef, useEffect } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'

interface ConnectorLineProps {
  fromX: number
  fromY: number
  toX: number
  toY: number
  accent: string
  visible: boolean
}

export const ConnectorLine = memo(function ConnectorLine({
  fromX,
  fromY,
  toX,
  toY,
  accent,
  visible,
}: ConnectorLineProps) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [visible])

  if (fromX === 0 && fromY === 0) return null

  // Diagonal from dot to near-dock, then horizontal into dock
  const midX = toX - 60
  const midY = toY

  const path = `M ${fromX} ${fromY} L ${midX} ${midY} L ${toX} ${toY}`

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity,
      }}
      pointerEvents="none"
    >
      <Svg style={{ width: '100%', height: '100%' }}>
        {/* Glow */}
        <Path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth={6}
          strokeOpacity={0.08}
          strokeLinecap="round"
        />
        {/* Main line */}
        <Path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeOpacity={0.45}
          strokeLinecap="round"
        />
        {/* Endpoint dot */}
        <Circle cx={toX} cy={toY} r={3} fill={accent} fillOpacity={0.3} />
      </Svg>
    </Animated.View>
  )
})
