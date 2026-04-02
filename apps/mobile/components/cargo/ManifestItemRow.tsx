import { memo } from 'react'
import { View, Text } from 'react-native'
import { Package } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import type { CargoItem } from '../../types/cargo'

interface ManifestItemRowProps {
  item: CargoItem
  accent: string
  isDark: boolean
}

export const ManifestItemRow = memo(function ManifestItemRow({ item, accent, isDark }: ManifestItemRowProps) {
  const priorityMap: Record<string, { label: string; bg: string; text: string }> = {
    rush: { label: 'Rush', bg: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7', text: isDark ? '#fbbf24' : '#92400e' },
    mail: { label: 'Mail', bg: isDark ? 'rgba(30,64,175,0.15)' : '#dbeafe', text: isDark ? '#60a5fa' : '#1e40af' },
  }
  const p = item.priority ? priorityMap[item.priority] : null

  return (
    <View
      className="flex-row items-center rounded-lg mb-1.5 px-3 py-2.5"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }}
    >
      <View
        className="w-8 h-8 rounded-md items-center justify-center mr-2.5"
        style={{ backgroundColor: accentTint(accent, 0.1) }}
      >
        <Package size={14} color={accent} strokeWidth={1.8} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#f5f5f5' : '#1f2937' }}>
            {item.id}
          </Text>
          {p && (
            <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: p.bg }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: p.text, textTransform: 'uppercase' }}>
                {p.label}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 11, color: isDark ? '#71717a' : '#9ca3af', marginTop: 2 }}>
          {item.weight} kg · {item.type}
        </Text>
      </View>
    </View>
  )
})
