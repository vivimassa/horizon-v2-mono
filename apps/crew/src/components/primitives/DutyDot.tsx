import { View } from 'react-native'
import type { Theme } from '../../theme/tokens'

export type DutyKind = 'flight' | 'standby' | 'rest' | 'training' | 'ground'

export function DutyDot({ t, kind, size = 6 }: { t: Theme; kind: DutyKind; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: t.duty[kind],
      }}
    />
  )
}
