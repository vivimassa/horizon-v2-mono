import React from 'react'
import { XStack, Text, useThemeName } from 'tamagui'

export type StatusKey = 'onTime' | 'delayed' | 'cancelled' | 'departed' | 'diverted' | 'scheduled'

const STATUS_CONFIG: Record<StatusKey, {
  bg: string; text: string; darkBg: string; darkText: string; label: string
}> = {
  onTime:     { bg: '#dcfce7', text: '#166534', darkBg: 'rgba(22,163,74,0.15)',  darkText: '#4ade80', label: 'On Time' },
  delayed:    { bg: '#fef3c7', text: '#92400e', darkBg: 'rgba(245,158,11,0.15)', darkText: '#fbbf24', label: 'Delayed' },
  cancelled:  { bg: '#fee2e2', text: '#991b1b', darkBg: 'rgba(220,38,38,0.15)',  darkText: '#f87171', label: 'Cancelled' },
  departed:   { bg: '#dbeafe', text: '#1e40af', darkBg: 'rgba(30,64,175,0.15)',  darkText: '#60a5fa', label: 'Departed' },
  diverted:   { bg: '#f3e8ff', text: '#6b21a8', darkBg: 'rgba(124,58,237,0.15)', darkText: '#a78bfa', label: 'Diverted' },
  scheduled:  { bg: '#f5f5f5', text: '#555555', darkBg: '#303030',               darkText: '#999999', label: 'Scheduled' },
}

interface BadgeProps {
  variant: StatusKey
  label?: string
}

export function Badge({ variant, label }: BadgeProps) {
  const theme = useThemeName()
  const isDark = theme === 'dark'
  const config = STATUS_CONFIG[variant]

  return (
    <XStack
      paddingHorizontal={8}
      paddingVertical={3}
      borderRadius="$badge"
      backgroundColor={isDark ? config.darkBg : config.bg}
      alignSelf="flex-start"
    >
      <Text
        fontSize={11}
        fontWeight="600"
        lineHeight={14}
        color={isDark ? config.darkText : config.text}
      >
        {label ?? config.label}
      </Text>
    </XStack>
  )
}
