// SkyHub — Card component
// Every grouped content block wraps in <Card>
import React, { useCallback } from 'react'
import { View, Pressable, type ViewStyle } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { shadowStyles } from '../theme/shadows'

interface CardProps {
  children: React.ReactNode
  padding?: 'compact' | 'standard'
  pressable?: boolean
  onPress?: () => void
  className?: string
}

export function Card({
  children,
  padding = 'standard',
  pressable = false,
  onPress,
  className,
}: CardProps) {
  const { palette, isDark } = useTheme()

  const paddingClass = padding === 'compact' ? 'p-3' : 'p-4'
  const baseClass = `rounded-xl border ${paddingClass} ${className ?? ''}`

  const dynamicStyle: ViewStyle = {
    backgroundColor: palette.card,
    borderColor: palette.cardBorder,
    ...shadowStyles.card,
  }

  if (pressable || onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={baseClass}
        style={({ pressed }) => ({
          ...dynamicStyle,
          ...(pressed ? { transform: [{ scale: 0.98 }], ...shadowStyles.cardPressed } : {}),
        })}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View className={baseClass} style={dynamicStyle}>
      {children}
    </View>
  )
}
