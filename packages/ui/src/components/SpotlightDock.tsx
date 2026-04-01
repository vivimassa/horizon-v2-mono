// SkyHub — SpotlightDock for React Native
// Full-width bottom dock with spotlight glow on active tab
import React, { memo } from 'react'
import { View, Text, Pressable, useColorScheme } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, accentTint } from '../theme/colors'
import type { LucideIcon } from '../theme/icons'

interface TabDef {
  key: string
  label: string
  icon: LucideIcon
}

interface SpotlightDockProps {
  tabs: TabDef[]
  activeIndex: number
  onTabChange: (index: number) => void
}

const ACCENT_DEFAULT = '#1e40af'

const TabButton = memo(function TabButton({
  tab,
  active,
  isDark,
  accent,
  onPress,
}: {
  tab: TabDef
  active: boolean
  isDark: boolean
  accent: string
  onPress: () => void
}) {
  const Icon = tab.icon
  const indicatorColor = isDark ? '#ffffff' : accent
  const activeIconColor = isDark ? '#ffffff' : accent
  const inactiveIconColor = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.26)'
  const activeLabelColor = isDark ? 'rgba(255,255,255,0.90)' : accent
  const inactiveLabelColor = isDark ? 'rgba(255,255,255,0.26)' : 'rgba(0,0,0,0.30)'
  const glowColor = isDark ? 'rgba(255,255,255,0.25)' : accentTint(accent, 0.20)

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center overflow-hidden"
      style={{ height: 56, gap: 2 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {active && (
        <View
          className="absolute top-0 left-1/2"
          style={{
            width: 28,
            height: 2.5,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
            backgroundColor: indicatorColor,
            transform: [{ translateX: -14 }],
          }}
        />
      )}

      {active && (
        <LinearGradient
          colors={[glowColor, 'transparent']}
          className="absolute top-0 left-1/2 pointer-events-none"
          style={{
            width: 44,
            height: 38,
            transform: [{ translateX: -22 }],
            borderRadius: 22,
          }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      )}

      <Icon
        size={20}
        color={active ? activeIconColor : inactiveIconColor}
        strokeWidth={1.75}
      />

      <Text
        style={{
          fontSize: 9.5,
          fontWeight: active ? '700' : '500',
          letterSpacing: 0.1,
          color: active ? activeLabelColor : inactiveLabelColor,
        }}
      >
        {tab.label}
      </Text>
    </Pressable>
  )
})

export function SpotlightDock({ tabs, activeIndex, onTabChange }: SpotlightDockProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <View
      className="absolute bottom-0 left-0 right-0"
      style={{ height: 56, zIndex: 50 }}
    >
      <BlurView
        intensity={isDark ? 80 : 60}
        tint={isDark ? 'dark' : 'light'}
        className="flex-1"
      >
        <View
          className="flex-1 flex-row"
          style={{
            backgroundColor: isDark ? 'rgba(18,18,22,0.50)' : 'rgba(255,255,255,0.30)',
            borderTopWidth: 0.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          {tabs.map((tab, i) => (
            <TabButton
              key={tab.key}
              tab={tab}
              active={i === activeIndex}
              isDark={isDark}
              accent={ACCENT_DEFAULT}
              onPress={() => onTabChange(i)}
            />
          ))}
        </View>
      </BlurView>
    </View>
  )
}
