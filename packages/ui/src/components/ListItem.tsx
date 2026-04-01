// SkyHub — ListItem component
// Rows inside Cards with press feedback, separators, active state
import React, { memo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { domainIcons } from '../theme/icons'

const ChevronRight = domainIcons.chevronRight
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import type { LucideIcon } from '../theme/icons'
import { Icon } from './Icon'

interface ListItemProps {
  title: string
  subtitle?: string
  leftIcon?: LucideIcon
  leftElement?: React.ReactNode
  rightElement?: React.ReactNode
  showChevron?: boolean
  onPress?: () => void
  isActive?: boolean
  isLast?: boolean
}

export const ListItem = memo(function ListItem({
  title,
  subtitle,
  leftIcon,
  leftElement,
  rightElement,
  showChevron = false,
  onPress,
  isActive = false,
  isLast = false,
}: ListItemProps) {
  const { palette, accentColor } = useTheme()

  const activeStyle = isActive
    ? { backgroundColor: accentTint(accentColor, 0.08) }
    : undefined

  const content = (
    <View
      className="flex-row items-center px-3 py-2.5 min-h-[44px]"
      style={activeStyle}
    >
      {leftElement ?? (leftIcon ? (
        <View className="w-9 items-center mr-2">
          <Icon icon={leftIcon} size="md" accentActive={isActive} />
        </View>
      ) : null)}

      <View className="flex-1 mr-2">
        <Text
          className="text-[13px] font-medium"
          style={{ color: palette.text }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-[11px] mt-0.5"
            style={{ color: palette.textSecondary }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightElement}

      {showChevron ? (
        <ChevronRight
          size={16}
          color={palette.textTertiary}
          strokeWidth={1.75}
        />
      ) : null}
    </View>
  )

  const separator = !isLast ? (
    <View
      className="ml-12 mr-3"
      style={{ height: 0.5, backgroundColor: palette.border }}
    />
  ) : null

  if (onPress) {
    return (
      <>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) =>
            pressed ? { backgroundColor: palette.backgroundHover } : undefined
          }
        >
          {content}
        </Pressable>
        {separator}
      </>
    )
  }

  return (
    <>
      {content}
      {separator}
    </>
  )
})
