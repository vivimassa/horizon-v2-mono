import { Text, View } from 'react-native'
import { TYPE, type Theme } from '../../theme/tokens'

export type ChipKind = 'ontime' | 'delayed' | 'cancelled' | 'departed' | 'scheduled'

interface Props {
  t: Theme
  kind?: ChipKind
  children: string
}

export function Chip({ t, kind = 'scheduled', children }: Props) {
  const s = t.status[kind]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
      }}
    >
      <Text style={{ ...TYPE.badge, color: s.fg }}>{children}</Text>
    </View>
  )
}
