import React from 'react'
import { YStack, Text, useThemeName } from 'tamagui'

interface KPICardProps {
  value: number | string
  label: string
  tint?: string // hex color for tinted background
}

export function KPICard({ value, label, tint }: KPICardProps) {
  const theme = useThemeName()
  const isDark = theme === 'dark'

  const bg = tint
    ? isDark
      ? `${tint}18`
      : `${tint}10`
    : undefined

  return (
    <YStack
      flex={1}
      padding="$lg"
      borderRadius="$card"
      borderWidth={0.5}
      borderColor="$cardBorderColor"
      backgroundColor={bg ?? '$cardBackground'}
      gap={4}
    >
      <Text
        fontSize={18}
        fontWeight="600"
        lineHeight={24}
        color={tint ?? '$accentColor'}
      >
        {value}
      </Text>
      <Text
        fontSize={13}
        fontWeight="500"
        lineHeight={18}
        color="$colorSecondary"
      >
        {label}
      </Text>
    </YStack>
  )
}
