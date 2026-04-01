// SkyHub — PageShell component
// Screen wrapper with animated gradient background, SafeAreaView, title
import React from 'react'
import { View, Text, ScrollView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../hooks/useTheme'
import type { BackgroundPreset } from '../stores/useThemeStore'
import { AnimatedBackground } from './AnimatedBackground'

interface PageShellProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  scrollable?: boolean
  headerRight?: React.ReactNode
  backgroundPreset?: BackgroundPreset
}

export function PageShell({
  title,
  subtitle,
  children,
  scrollable = true,
  headerRight,
  backgroundPreset: overridePreset,
}: PageShellProps) {
  const { palette, isDark, backgroundPreset: storePreset } = useTheme()

  const preset = overridePreset ?? storePreset

  const header = (
    <View className="flex-row items-center px-4 pt-3 pb-2">
      <View className="flex-1">
        <Text
          className="text-[20px] font-semibold"
          style={{ color: palette.text, lineHeight: 26 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-[12px] mt-0.5"
            style={{ color: palette.textSecondary }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {headerRight}
    </View>
  )

  const content = scrollable ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-4 pb-4 pt-2"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1 px-4 pb-4 pt-2">{children}</View>
  )

  // Web: use CSS animated background class
  if (Platform.OS === 'web') {
    const animClass = preset !== 'none' ? `anim-bg anim-bg-${preset}` : ''
    const fallbackBg = isDark
      ? 'linear-gradient(180deg, #1a1a1a, #141414)'
      : 'linear-gradient(180deg, #ffffff, #f5f5f5)'

    return (
      <SafeAreaView
        className={`flex-1 ${animClass}`}
        style={preset === 'none' ? { background: fallbackBg } as any : undefined}
        edges={['top']}
      >
        {header}
        {content}
      </SafeAreaView>
    )
  }

  // Native: use Reanimated + LinearGradient for animated backgrounds
  if (preset !== 'none') {
    return (
      <AnimatedBackground preset={preset} isDark={isDark}>
        <SafeAreaView className="flex-1" edges={['top']}>
          {header}
          {content}
        </SafeAreaView>
      </AnimatedBackground>
    )
  }

  // Fallback: static background
  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }}
      edges={['top']}
    >
      {header}
      {content}
    </SafeAreaView>
  )
}
