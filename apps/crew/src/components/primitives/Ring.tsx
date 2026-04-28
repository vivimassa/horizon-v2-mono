import { View } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import type { Theme } from '../../theme/tokens'

interface Props {
  t: Theme
  used: number
  limit: number
  size?: number
  stroke?: number
}

export function Ring({ t, used, limit, size = 56, stroke = 6 }: Props) {
  const pct = Math.max(0, Math.min(1, used / Math.max(limit, 0.0001)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let color = t.duty.flight
  if (pct >= 0.8) color = t.status.delayed.fg
  if (pct >= 0.95) color = t.status.cancelled.fg
  const cxy = size / 2
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cxy} cy={cxy} r={r} stroke={t.hover} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cxy}
          cy={cxy}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c}`}
          strokeDashoffset={c - c * pct}
          strokeLinecap="round"
          rotation={-90}
          originX={cxy}
          originY={cxy}
        />
        <SvgText
          x="50%"
          y="50%"
          textAnchor="middle"
          fontSize={size * 0.27}
          fontWeight="700"
          fill={t.text}
          dy={size * 0.09}
        >
          {`${Math.round(pct * 100)}%`}
        </SvgText>
      </Svg>
    </View>
  )
}
