import { View, Text } from 'react-native'
import { Package } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import type { DockItem } from '../../types/cargo'

interface LoadingDockProps {
  items: DockItem[]
  accent: string
  palette: Palette
  isDark: boolean
}

export function LoadingDock({ items, accent, palette, isDark }: LoadingDockProps) {
  return (
    <View
      className="rounded-xl p-3 mb-4"
      style={{
        backgroundColor: isDark ? 'rgba(20,20,24,0.6)' : 'rgba(255,255,255,0.5)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)',
      }}
    >
      <View className="flex-row items-center mb-2.5">
        <Package size={14} color={accent} strokeWidth={2} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: palette.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginLeft: 6,
          }}
        >
          Loading Dock
        </Text>
        <View className="ml-auto px-2 py-0.5 rounded-full" style={{ backgroundColor: accentTint(accent, 0.15) }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: accent }}>{items.length}</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <View
            key={item.id}
            className="rounded-lg px-3 py-2"
            style={{
              width: '48%',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: palette.text }}>{item.id}</Text>
            <Text style={{ fontSize: 10, color: palette.textTertiary, marginTop: 2 }}>
              {item.weight} kg · {item.type}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
