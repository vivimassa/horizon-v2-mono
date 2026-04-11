// SkyHub — TabBar component
// Horizontal scrollable tab row with optional icon + label.
// Active tab: accent text/icon + 2px accent underline.
import React from 'react'
import { View, Pressable, ScrollView } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import type { LucideIcon } from '../theme/icons'
import { Text } from './Text'

export interface TabBarItem {
  key: string
  label: string
  icon?: LucideIcon
}

interface TabBarProps {
  tabs: TabBarItem[]
  activeTab: string
  onTabChange: (key: string) => void
  /** When true, tabs distribute evenly (no scroll). Default: false (scrollable). */
  stretch?: boolean
}

export function TabBar({ tabs, activeTab, onTabChange, stretch = false }: TabBarProps) {
  const { palette, accentColor } = useTheme()

  const content = (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab
        const Icon = tab.icon
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flex: stretch ? 1 : undefined,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 2,
              borderBottomColor: active ? accentColor : 'transparent',
              marginBottom: -1,
              backgroundColor: pressed
                ? accentTint(accentColor, 0.06)
                : active
                  ? accentTint(accentColor, 0.04)
                  : 'transparent',
            })}
          >
            {Icon ? (
              <Icon size={15} color={active ? accentColor : palette.textSecondary} strokeWidth={active ? 2 : 1.75} />
            ) : null}
            <Text
              variant="panelHeader"
              color={active ? accentColor : palette.textSecondary}
              style={{ fontWeight: active ? '700' : '500' }}
            >
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )

  if (stretch) return content

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      {content}
    </ScrollView>
  )
}
