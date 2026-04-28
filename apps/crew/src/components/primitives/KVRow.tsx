import { Text, View } from 'react-native'
import type { Theme } from '../../theme/tokens'
import { FieldLabel } from './FieldLabel'

export function KVRow({ t, k, v, mono }: { t: Theme; k: string; v: string; mono?: boolean }) {
  // Only apply mono font when the value is real coded text — placeholder
  // em-dashes look like dev-debug junk in Menlo.
  const isPlaceholder = !v || v === '—'
  return (
    <View>
      <FieldLabel t={t} style={{ fontSize: 11 }}>
        {k}
      </FieldLabel>
      <Text
        style={{
          color: isPlaceholder ? t.textSec : t.text,
          fontSize: 13,
          marginTop: 4,
          fontFamily: mono && !isPlaceholder ? 'Menlo' : undefined,
        }}
      >
        {v}
      </Text>
    </View>
  )
}
