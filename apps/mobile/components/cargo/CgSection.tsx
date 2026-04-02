import { View, Text } from 'react-native'
import { CheckCircle } from 'lucide-react-native'
import type { Palette } from '@skyhub/ui/theme'

interface CgSectionProps {
  cgMac: number
  accent: string
  palette: Palette
  isDark: boolean
}

export function CgSection({ cgMac, accent, palette, isDark }: CgSectionProps) {
  return (
    <View
      className="rounded-xl mb-4 p-3.5"
      style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Center of Gravity
        </Text>
        <View className="flex-row items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}>
          <CheckCircle size={10} color={isDark ? '#4ade80' : '#166534'} strokeWidth={2} />
          <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#4ade80' : '#166534', marginLeft: 4 }}>Within Limits</Text>
        </View>
      </View>
      <View className="flex-row items-center mb-2">
        <Text style={{ fontSize: 22, fontWeight: '700', color: accent }}>{cgMac}%</Text>
        <Text style={{ fontSize: 11, color: palette.textTertiary, marginLeft: 6 }}>MAC</Text>
      </View>
      <View className="rounded-full overflow-hidden h-1.5" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
        <View className="absolute h-1.5 rounded-full" style={{ left: '15%', width: '50%', backgroundColor: isDark ? 'rgba(22,163,74,0.2)' : 'rgba(22,163,74,0.15)' }} />
        <View
          className="absolute w-2.5 h-2.5 rounded-full"
          style={{ left: `${cgMac}%`, top: -2, backgroundColor: accent, borderWidth: 2, borderColor: '#fff' }}
        />
      </View>
      <View className="flex-row justify-between mt-2">
        <Text style={{ fontSize: 9, color: palette.textTertiary }}>FWD 15%</Text>
        <Text style={{ fontSize: 9, color: palette.textTertiary }}>AFT 65%</Text>
      </View>
    </View>
  )
}
