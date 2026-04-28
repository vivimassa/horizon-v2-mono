import Svg, { Path } from 'react-native-svg'

interface Props {
  values: number[]
  color: string
  width?: number
  height?: number
}

/**
 * Compact line chart for stat tiles. Stroke-only, accent-colored.
 */
export function Sparkline({ values, color, width = 60, height = 22 }: Props) {
  if (values.length < 2) return <Svg width={width} height={height} />
  const max = Math.max(...values, 1)
  const stepX = width / (values.length - 1)
  const points = values.map((v, i) => [i * stepX, height - (v / max) * height] as const)
  const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
  return (
    <Svg width={width} height={height}>
      <Path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
