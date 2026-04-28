import type React from 'react'
import { Text, View, type ViewStyle } from 'react-native'
import { TYPE, type Theme } from '../../theme/tokens'

interface Props {
  t: Theme
  children: React.ReactNode
  action?: string
  style?: ViewStyle
}

export function SectionHeader({ t, children, action, style }: Props) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, style]}>
      <Text style={{ ...TYPE.section, color: t.text }}>{children}</Text>
      {action && <Text style={{ ...TYPE.caption, color: t.accent, fontWeight: '600' }}>{action}</Text>}
    </View>
  )
}
