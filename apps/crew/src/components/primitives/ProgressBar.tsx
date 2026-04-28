import { View } from 'react-native'
import type { Theme } from '../../theme/tokens'

interface Props {
  t: Theme
  used: number
  limit: number
  height?: number
}

export function ProgressBar({ t, used, limit, height = 8 }: Props) {
  const pct = Math.max(0, Math.min(100, (used / Math.max(limit, 0.0001)) * 100))
  let color = t.duty.flight
  if (pct >= 80) color = t.status.delayed.fg
  if (pct >= 95) color = t.status.cancelled.fg
  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: t.hover,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  )
}
