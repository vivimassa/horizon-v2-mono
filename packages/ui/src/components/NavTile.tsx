// SkyHub — NavTile for mobile drill-down navigation
// Renders a pressable card for section/page navigation
import React, { memo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import { shadowStyles } from '../theme/shadows'
import type { LucideIcon } from '../theme/icons'

interface NavTileProps {
  label: string
  num: string
  icon: LucideIcon
  color: string
  count?: number
  onPress: () => void
}

export const NavTile = memo(function NavTile({
  label,
  num,
  icon: IconComponent,
  color,
  count,
  onPress,
}: NavTileProps) {
  const { palette } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      className="rounded-[14px] border relative"
      style={({ pressed }) => ({
        backgroundColor: palette.card,
        borderColor: palette.cardBorder,
        padding: 14,
        paddingBottom: 12,
        ...shadowStyles.card,
        ...(pressed ? { transform: [{ scale: 0.97 }], ...shadowStyles.cardPressed } : {}),
      })}
      accessibilityRole="button"
    >
      {/* Number badge — top right */}
      <Text
        className="absolute"
        style={{
          top: 8,
          right: 8,
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: '700',
          color: palette.textTertiary,
          letterSpacing: -0.3,
        }}
      >
        {num}
      </Text>

      {/* Icon circle */}
      <View
        className="w-9 h-9 rounded-[10px] items-center justify-center mb-2"
        style={{ backgroundColor: accentTint(color, 0.08) }}
      >
        <IconComponent size={20} color={color} strokeWidth={1.75} />
      </View>

      {/* Label */}
      <Text
        className="text-[13px] font-semibold pr-[30px]"
        style={{ color: palette.text, lineHeight: 17 }}
        numberOfLines={2}
      >
        {label}
      </Text>

      {/* Page count (for section tiles) */}
      {count !== undefined && (
        <Text
          className="text-[11px] mt-0.5"
          style={{ color: palette.textSecondary }}
        >
          {count} {count === 1 ? 'page' : 'pages'}
        </Text>
      )}
    </Pressable>
  )
})
