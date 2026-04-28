import { Text, type TextStyle } from 'react-native'
import { TYPE, type Theme } from '../../theme/tokens'

export function FieldLabel({ t, children, style }: { t: Theme; children: string; style?: TextStyle }) {
  return <Text style={[{ ...TYPE.field, color: t.textSec }, style]}>{children}</Text>
}
