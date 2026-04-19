// SkyHub — SpotlightDock for React Native
// Full-width bottom dock with animated spotlight crossfade on tab switch.
// Styled to read as glass-over-wallpaper via a semi-transparent tint layer —
// we deliberately avoid expo-blur's BlurView because the native module has
// registration issues under Expo SDK 54+ new-arch (ExpoBlurView not exported
// by NativeViewManagerAdapter). A translucent tint gets 90% of the look at
// zero native cost.
import React, { memo, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Animated, useColorScheme, useWindowDimensions, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronUp, ChevronDown } from 'lucide-react-native'
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
  /** When true, the dock starts collapsed (just a "Navigation" pill) so the
     focused screen is fully visible. Default: false (expanded). */
  startCollapsed?: boolean
}

const ACCENT_DEFAULT = '#1e40af'

const TabButton = memo(function TabButton({
  tab,
  active,
  isDark,
  accent,
  isTablet,
  width,
  onPress,
}: {
  tab: TabDef
  active: boolean
  isDark: boolean
  accent: string
  isTablet: boolean
  width: number
  onPress: () => void
}) {
  const Icon = tab.icon
  const indicatorColor = isDark ? '#ffffff' : accent
  const activeIconColor = isDark ? '#ffffff' : accent
  const inactiveIconColor = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.26)'
  const activeLabelColor = isDark ? 'rgba(255,255,255,0.90)' : accent
  const inactiveLabelColor = isDark ? 'rgba(255,255,255,0.26)' : 'rgba(0,0,0,0.30)'
  const glowColor = isDark ? 'rgba(255,255,255,0.25)' : accentTint(accent, 0.2)

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
      className="items-center justify-center overflow-hidden"
      style={{ width, height: isTablet ? 68 : 60, gap: 3 }}
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
        <Icon size={isTablet ? 24 : 20} color={active ? activeIconColor : inactiveIconColor} strokeWidth={1.75} />
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

export function SpotlightDock({
  tabs,
  activeIndex,
  onTabChange,
  isDark: isDarkProp,
  startCollapsed = false,
}: SpotlightDockProps) {
  const colorScheme = useColorScheme()
  const isDark = isDarkProp ?? colorScheme === 'dark'
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  const [collapsed, setCollapsed] = useState(startCollapsed)

  // Premium glass pill — narrow (sized to its content), centered horizontally,
  // with a soft shadow. Collapses to a tiny "Navigation" chip so the active
  // page stays immersive; tap to expand.
  const glassTint = isDark ? 'rgba(18,18,22,0.92)' : 'rgba(255,255,255,0.92)'
  const borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
  const dockHeight = isTablet ? 68 : 60
  const bottomInset = isTablet ? 18 : 14
  const tabWidth = isTablet ? 84 : 64
  const pillPaddingX = 6
  const dockWidth = tabs.length * tabWidth + pillPaddingX * 2
  // Stronger contrast in both modes so the collapsed pill + chevron handle
  // are unmistakably visible (was too faint before).
  const chipTextColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.75)'

  // Outer positioning wrapper — spans the full bottom row but lets taps pass
  // through empty space (pointerEvents: 'box-none'). Children are centered
  // horizontally via flex, which is far more reliable than alignSelf on an
  // absolutely-positioned element (that combination silently stretches the
  // pill to full-width on some RN versions — exactly the bug you saw).
  const outerWrapperStyle = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: bottomInset,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 50,
  }

  const sharedPillStyle = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: borderColor,
    overflow: 'hidden' as const,
    backgroundColor: glassTint,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.35 : 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  }

  if (collapsed) {
    return (
      <View style={outerWrapperStyle} pointerEvents="box-none">
        <Pressable
          onPress={() => setCollapsed(false)}
          accessibilityRole="button"
          accessibilityLabel="Expand navigation"
          hitSlop={10}
          style={{
            ...sharedPillStyle,
            height: 52,
            borderRadius: 26,
            paddingHorizontal: 26,
            // Inner layout lives on the Pressable itself so content auto-sizes
            // the pill (no explicit width = hugs its children).
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <ChevronUp size={22} color={chipTextColor} strokeWidth={2.8} />
          <Text style={{ fontSize: 15, fontWeight: '700', letterSpacing: 0.4, color: chipTextColor }}>Navigation</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={outerWrapperStyle} pointerEvents="box-none">
      {/* Collapse chevron handle — sibling of the dock (NOT a child) so the
         dock's `overflow: 'hidden'` can't clip it. Sized big enough to be
         obvious + easy to tap, matching the "Navigation" pill weight. */}
      <Pressable
        onPress={() => setCollapsed(true)}
        accessibilityRole="button"
        accessibilityLabel="Collapse navigation"
        hitSlop={12}
        style={{
          width: 96,
          height: 40,
          marginBottom: -10,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          backgroundColor: glassTint,
          borderWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: 0,
          borderColor: borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          zIndex: 2,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.25 : 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -4 },
        }}
      >
        <ChevronDown size={22} color={chipTextColor} strokeWidth={2.8} />
      </Pressable>

      <View
        style={{
          ...sharedPillStyle,
          width: dockWidth,
          height: dockHeight,
          borderRadius: 22,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: pillPaddingX }}>
          {tabs.map((tab, i) => (
            <TabButton
              key={tab.key}
              tab={tab}
              active={i === activeIndex}
              isDark={isDark}
              accent={ACCENT_DEFAULT}
              isTablet={isTablet}
              width={tabWidth}
              onPress={() => onTabChange(i)}
            />
          ))}
        </View>
      </View>
    </View>
  )
}
