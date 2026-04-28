import { useId } from 'react'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

interface Props {
  values: number[]
  color: string
  max?: number
  width?: number
  height?: number
}

/**
 * Area chart with gradient fill (color → transparent). Used for the Stats
 * hero block-hours visualisation. Renders inline points on each value.
 */
export function AreaChart({ values, color, max, width = 320, height = 90 }: Props) {
  const id = 'areaGrad-' + useId().replace(/:/g, '_')
  const peak = max ?? Math.max(...values, 1)
  const pad = 4
  const stepX = (width - pad * 2) / Math.max(1, values.length - 1)
  const points = values.map((v, i) => [pad + i * stepX, height - pad - (v / peak) * (height - pad * 2)] as const)
  const stroke = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
  const fill =
    stroke +
    ` L ${points[points.length - 1]![0].toFixed(1)},${(height - pad).toFixed(1)}` +
    ` L ${points[0]![0].toFixed(1)},${(height - pad).toFixed(1)} Z`

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={fill} fill={`url(#${id})`} />
      <Path d={stroke} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={p[0]} cy={p[1]} r={2} fill={color} />
      ))}
    </Svg>
  )
}
