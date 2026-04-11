// SkyHub — StatusChip component
// Compact status indicator with bg + text color from theme tokens
import React from 'react'
import { View, Text } from 'react-native'
import { getStatusColors, type StatusKey } from '../theme/colors'
import { useTheme } from '../hooks/useTheme'

const statusLabels: Record<StatusKey, string> = {
  onTime: 'On Time',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
  departed: 'Departed',
  diverted: 'Diverted',
  scheduled: 'Scheduled',
}

interface StatusChipProps {
  status: StatusKey
  label?: string
}

export function StatusChip({ status, label }: StatusChipProps) {
  const { isDark } = useTheme()
  const { bg, text } = getStatusColors(status, isDark)

  return (
    <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: bg }}>
      <Text className="text-[13px] font-semibold" style={{ color: text, lineHeight: 16 }}>
        {label ?? statusLabels[status]}
      </Text>
    </View>
  )
}
