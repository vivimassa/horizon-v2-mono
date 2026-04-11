// SkyHub — SectionHeader component
// Groups of cards with accent bar + title + optional action + optional badge
import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
  /** Override the accent bar color (e.g. purple for admin sections) */
  color?: string
  /** Optional badge text (e.g. "Admin Only", count) */
  badge?: string
  /** Override badge tint color. Defaults to bar color. */
  badgeColor?: string
}

export function SectionHeader({ title, subtitle, action, color, badge, badgeColor }: SectionHeaderProps) {
  const { palette, accentColor } = useTheme()
  const barColor = color ?? accentColor
  const pillColor = badgeColor ?? barColor

  return (
    <View className="flex-row items-center mt-6 mb-2 first:mt-0">
      <View className="w-[3px] h-4 rounded-full mr-2" style={{ backgroundColor: barColor }} />
      <View className="flex-1 flex-row items-center" style={{ gap: 8 }}>
        <Text className="text-[15px] font-bold" style={{ color: palette.text, letterSpacing: -0.3 }}>
          {title}
        </Text>
        {badge ? (
          <View className="rounded px-2 py-0.5" style={{ backgroundColor: accentTint(pillColor, 0.12) }}>
            <Text className="text-[13px] font-semibold" style={{ color: pillColor }}>
              {badge}
            </Text>
          </View>
        ) : null}
        {subtitle ? (
          <Text className="text-xs" style={{ color: palette.textSecondary }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          <Text className="text-[13px] font-medium" style={{ color: barColor }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
