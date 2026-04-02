// SkyHub — SpotlightDock for React Native
// Full-width bottom dock with animated spotlight crossfade on tab switch
import React, { memo, useEffect, useRef } from 'react'
import { View, Text, Pressable, Animated, useColorScheme, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { accentTint } from '../theme/colors'
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
  isDark?: boolean
}

const ACCENT_DEFAULT = '#1e40af'

const TabButton = memo(function TabButton({
  tab,
  active,
  isDark,
  accent,
  isTablet,
  onPress,
}: {
  tab: TabDef
  active: boolean
  isDark: boolean
  accent: string
  isTablet: boolean
  onPress: () => void
}) {
  const Icon = tab.icon
  const indicatorColor = isDark ? '#ffffff' : accent
  const activeIconColor = isDark ? '#ffffff' : accent
  const inactiveIconColor = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.26)'
  const activeLabelColor = isDark ? 'rgba(255,255,255,0.90)' : accent
  const inactiveLabelColor = isDark ? 'rgba(255,255,255,0.26)' : 'rgba(0,0,0,0.30)'
  const glowColor = isDark ? 'rgba(255,255,255,0.25)' : accentTint(accent, 0.20)

  // Animate spotlight opacity and icon scale
  const spotlightAnim = useRef(new Animated.Value(active ? 1 : 0)).current
  const scaleAnim = useRef(new Animated.Value(active ? 1.08 : 1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(spotlightAnim, {
        toValue: active ? 1 : 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: active ? 1.08 : 1,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start()
  }, [active])

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center overflow-hidden"
      style={{ height: 56, gap: 2 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {/* Indicator bar + glow — animated fade */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          opacity: spotlightAnim,
        }}
      >
        <View
          style={{
            height: 2.5,
            backgroundColor: indicatorColor,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
          }}
        />
        <LinearGradient
          colors={[glowColor, accentTint(isDark ? '#ffffff' : accent, 0.06), 'transparent']}
          locations={[0, 0.4, 1]}
          style={{
            height: 40,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Icon with scale animation */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Icon
          size={isTablet ? 24 : 20}
          color={active ? activeIconColor : inactiveIconColor}
          strokeWidth={1.75}
        />
      </Animated.View>

      <Text
        style={{
          fontSize: isTablet ? 12 : 9.5,
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

export function SpotlightDock({ tabs, activeIndex, onTabChange, isDark: isDarkProp }: SpotlightDockProps) {
  const colorScheme = useColorScheme()
  const isDark = isDarkProp ?? colorScheme === 'dark'
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  return (
    <View
      className="absolute bottom-0 left-0 right-0"
      style={{ height: 56, zIndex: 50 }}
    >
      <View
        className="flex-1 flex-row"
        style={{
          backgroundColor: isDark ? '#121216' : '#ffffff',
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
            isTablet={isTablet}
            onPress={() => onTabChange(i)}
          />
        ))}
      </View>
    </View>
  )
}
