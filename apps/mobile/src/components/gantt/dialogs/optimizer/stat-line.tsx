// Single label/value row used by all optimizer panes.

import { View, Text } from 'react-native'

export function StatLine({
  label,
  value,
  palette,
  highlight,
}: {
  label: string
  value: string
  palette: { text: string; textSecondary: string }
  highlight?: string
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 13, color: palette.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: highlight ?? palette.text, fontFamily: 'monospace' }}>
        {value}
      </Text>
    </View>
  )
}
