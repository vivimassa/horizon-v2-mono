// SkyHub — Card component
// Every grouped content block wraps in <Card>
import React from 'react'
import { View, Pressable, Platform, type ViewStyle } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { shadowStyles } from '../theme/shadows'

interface CardProps {
  children: React.ReactNode
  /** 'default' = solid card, 'glass' = translucent panel (dark mode hero cards) */
  variant?: 'default' | 'glass'
  padding?: 'compact' | 'standard' | 'spacious'
  /** Shadow elevation level */
  elevation?: 'card' | 'raised' | 'floating'
  pressable?: boolean
  onPress?: () => void
  className?: string
}

export function Card({
  children,
  variant = 'default',
  padding = 'standard',
  elevation = 'card',
  pressable = false,
  onPress,
  className,
}: CardProps) {
  const { palette, isDark } = useTheme()

  const paddingClass = padding === 'compact' ? 'p-3' : padding === 'spacious' ? 'p-5' : 'p-4'
  const baseClass = `rounded-xl border ${paddingClass} ${className ?? ''}`

  const isGlass = variant === 'glass' && isDark

  const dynamicStyle: ViewStyle = {
    backgroundColor: isGlass ? 'rgba(25,25,33,0.85)' : palette.card,
    borderColor: isGlass ? 'rgba(255,255,255,0.06)' : palette.cardBorder,
    ...shadowStyles[elevation],
  }

  // Glass variant on web gets backdrop-filter
  const webGlassStyle: ViewStyle = isGlass && Platform.OS === 'web'
    ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any
    : {}

  if (pressable || onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={baseClass}
        style={({ pressed }) => ({
          ...dynamicStyle,
          ...webGlassStyle,
          ...(pressed ? { transform: [{ scale: 0.98 }], ...shadowStyles.cardPressed } : {}),
        })}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View className={baseClass} style={{ ...dynamicStyle, ...webGlassStyle }}>
      {children}
    </View>
  )
}
