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
  const { palette, accentColor, isDark } = useTheme()

  // Inactive text/icon — bump contrast on dark mode so labels don't fade out.
  const inactiveColor = isDark ? 'rgba(255,255,255,0.55)' : palette.textSecondary
  const indicatorHeight = 3

  const content = (
    <View
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : palette.border,
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
              borderBottomWidth: indicatorHeight,
              borderBottomColor: active ? accentColor : 'transparent',
              marginBottom: -1,
              backgroundColor: pressed
                ? accentTint(accentColor, isDark ? 0.12 : 0.08)
                : active
                  ? accentTint(accentColor, isDark ? 0.1 : 0.05)
                  : 'transparent',
            })}
          >
            {/* Inner static View forces icon+label onto a single row — the
               Pressable's style-as-function was dropping flexDirection on
               some RN versions, stacking them vertically. Also gives a large
               54px+ tap target (paddingVertical 16 + content ~22px). */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingHorizontal: 18,
                paddingVertical: 16,
              }}
            >
              {Icon ? (
                <Icon size={17} color={active ? accentColor : inactiveColor} strokeWidth={active ? 2.25 : 1.9} />
              ) : null}
              <Text
                variant="cardTitle"
                color={active ? accentColor : inactiveColor}
                style={{ fontWeight: active ? '700' : '600', letterSpacing: 0.2 }}
              >
                {tab.label}
              </Text>
            </View>
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
