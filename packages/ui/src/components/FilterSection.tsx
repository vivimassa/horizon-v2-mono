import { Text, View } from 'react-native'
import type { Palette } from '../theme/colors'

interface FilterSectionProps {
  label: string
  children: React.ReactNode
  palette: Palette
}

export function FilterSection({ label, children, palette }: FilterSectionProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: palette.textTertiary,
      }}>
        {label}
      </Text>
      {children}
    </View>
  )
}
