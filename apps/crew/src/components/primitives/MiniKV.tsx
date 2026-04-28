import { Text, View } from 'react-native'
import { TYPE, type Theme } from '../../theme/tokens'
import { FieldLabel } from './FieldLabel'

export function MiniKV({ t, label, value }: { t: Theme; label: string; value: string }) {
  return (
    <View style={{ minWidth: 0 }}>
      <FieldLabel t={t}>{label}</FieldLabel>
      <Text
        numberOfLines={1}
        style={{
          ...TYPE.cardTitle,
          color: t.text,
          fontSize: 14,
          fontWeight: '600',
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  )
}
