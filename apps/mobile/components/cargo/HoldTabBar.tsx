import { View, Text, Pressable } from 'react-native'
import type { Palette } from '@skyhub/ui/theme'
import type { HoldKey, CargoHold } from '../../types/cargo'
import { HOLD_TABS } from '../../data/mock-cargo'

interface HoldTabBarProps {
  active: HoldKey
  onSelect: (k: HoldKey) => void
  holds: Record<string, CargoHold>
  accent: string
  palette: Palette
  isDark: boolean
}

export function HoldTabBar({ active, onSelect, holds, accent, palette, isDark }: HoldTabBarProps) {
  return (
    <View className="flex-row gap-2 mb-4">
      {HOLD_TABS.map((tab) => {
        const isActive = active === tab.key
        const hold = holds[tab.key]
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            className="flex-1 rounded-xl items-center py-2.5"
            style={{
              backgroundColor: isActive ? accent : isDark ? 'rgba(20,20,24,0.6)' : 'rgba(255,255,255,0.5)',
              borderWidth: 1.5,
              borderColor: isActive ? accent : palette.cardBorder,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: isActive ? '#fff' : palette.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {tab.label}
            </Text>
            <Text
              style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.7)' : palette.textTertiary, marginTop: 2 }}
            >
              {hold.weight.toLocaleString()} kg / {hold.percent}%
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
