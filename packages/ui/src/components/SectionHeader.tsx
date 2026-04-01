// SkyHub — SectionHeader component
// Groups of cards with accent bar + title + optional action
import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTheme } from '../hooks/useTheme'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const { palette, accentColor } = useTheme()

  return (
    <View className="flex-row items-center mt-6 mb-2 first:mt-0">
      <View
        className="w-[3px] h-4 rounded-full mr-2"
        style={{ backgroundColor: accentColor }}
      />
      <View className="flex-1">
        <Text
          className="text-[15px] font-bold"
          style={{ color: palette.text, letterSpacing: -0.3 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-xs mt-0.5"
            style={{ color: palette.textSecondary }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text
            className="text-[13px] font-medium"
            style={{ color: accentColor }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
