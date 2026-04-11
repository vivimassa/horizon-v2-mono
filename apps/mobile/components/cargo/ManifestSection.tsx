import { View, Text } from 'react-native'
import { Package } from 'lucide-react-native'
import type { Palette } from '@skyhub/ui/theme'
import type { CargoHold } from '../../types/cargo'
import { ManifestItemRow } from './ManifestItemRow'

interface ManifestSectionProps {
  holds: Record<string, CargoHold>
  accent: string
  palette: Palette
  isDark: boolean
}

export function ManifestSection({ holds, accent, palette, isDark }: ManifestSectionProps) {
  const allItems = Object.values(holds).flatMap((h) => h.items)
  const totalWeight = Object.values(holds).reduce((sum, h) => sum + h.weight, 0)

  return (
    <>
      {Object.values(holds).map((hold) => (
        <View key={hold.key} className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Package size={12} color={accent} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: palette.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginLeft: 6,
                }}
              >
                {hold.name}
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: palette.text }}>
              {hold.weight.toLocaleString()} / {hold.capacity.toLocaleString()} kg
              <Text style={{ color: accent }}> {hold.percent}%</Text>
            </Text>
          </View>
          <View
            className="rounded-full h-1 mb-2.5 overflow-hidden"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
          >
            <View className="h-full rounded-full" style={{ width: `${hold.percent}%`, backgroundColor: accent }} />
          </View>
          {hold.items.map((item) => (
            <ManifestItemRow key={item.id} item={item} accent={accent} isDark={isDark} />
          ))}
          {hold.items.length === 0 && (
            <Text style={{ fontSize: 11, color: palette.textTertiary, textAlign: 'center', paddingVertical: 12 }}>
              Empty
            </Text>
          )}
        </View>
      ))}

      {/* Totals */}
      <View
        className="rounded-xl mb-4 p-3.5"
        style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
      >
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 12, color: palette.textSecondary }}>Total Pieces</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{allItems.length}</Text>
        </View>
        <View className="flex-row items-center justify-between mt-1">
          <Text style={{ fontSize: 12, color: palette.textSecondary }}>Total Weight</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>{totalWeight.toLocaleString()} kg</Text>
        </View>
      </View>
    </>
  )
}
