// SkyHub — Badge component
// Count/label indicator with variant support
import React from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'

interface BadgeProps {
  label: string | number
  variant?: 'default' | 'accent' | 'muted'
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const { palette, accentColor, isDark } = useTheme()

  let bg: string
  let textColor: string

  switch (variant) {
    case 'accent':
      bg = accentTint(accentColor, 0.12)
      textColor = accentColor
      break
    case 'muted':
      bg = isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'
      textColor = palette.textTertiary
      break
    default:
      bg = isDark ? 'rgba(255,255,255,0.10)' : '#e8e8e8'
      textColor = palette.textSecondary
      break
  }

  return (
    <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: bg }}>
      <Text
        className="text-[11px] font-semibold"
        style={{ color: textColor, lineHeight: 14 }}
      >
        {String(label)}
      </Text>
    </View>
  )
}
