import { View, Text } from 'react-native'
import { Plane } from 'lucide-react-native'
import type { Palette } from '@skyhub/ui/theme'

interface CargoEmptyStateProps {
  palette: Palette
}

export function CargoEmptyState({ palette }: CargoEmptyStateProps) {
  return (
    <View className="items-center justify-center py-20">
      <Plane size={40} color={palette.textTertiary} strokeWidth={1} />
      <Text style={{ fontSize: 14, fontWeight: '500', color: palette.textSecondary, marginTop: 12 }}>
        Select a flight
      </Text>
      <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 4 }}>Tap the search bar above</Text>
    </View>
  )
}
