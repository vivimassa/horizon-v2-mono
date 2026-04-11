// SkyHub — EmptyState component
// Displayed when a list has no data
import React from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { Icon } from './Icon'
import { Button } from './Button'
import type { LucideIcon } from '../theme/icons'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { palette } = useTheme()

  return (
    <View className="items-center justify-center py-10 px-6">
      <Icon icon={icon} size="xl" color={palette.textTertiary} />
      <Text className="text-[14px] font-medium mt-3 text-center" style={{ color: palette.textSecondary }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-[13px] mt-1 text-center" style={{ color: palette.textTertiary }}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-4">
          <Button title={actionLabel} onPress={onAction} size="sm" />
        </View>
      ) : null}
    </View>
  )
}
