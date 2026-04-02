import { View, Text, Pressable } from 'react-native'
import type { Palette } from '@skyhub/ui/theme'

interface CargoActionBarProps {
  accent: string
  palette: Palette
  isDark: boolean
}

export function CargoActionBar({ accent, palette, isDark }: CargoActionBarProps) {
  return (
    <View className="flex-row gap-3">
      <Pressable
        className="flex-1 rounded-xl py-3 items-center"
        style={{ borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: palette.textSecondary }}>Cancel Load</Text>
      </Pressable>
      <Pressable
        className="flex-1 rounded-xl py-3 items-center"
        style={{ backgroundColor: accent, borderWidth: 1.5, borderColor: accent }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Confirm Load</Text>
      </Pressable>
    </View>
  )
}
