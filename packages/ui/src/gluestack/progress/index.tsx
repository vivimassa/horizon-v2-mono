// Gluestack-compatible Progress primitive
import React from 'react'
import { View } from 'react-native'

export function Progress({
  value = 0,
  className,
  children,
}: {
  value?: number
  className?: string
  children?: React.ReactNode
}) {
  return (
    <View
      className={`h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 ${className ?? ''}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
    >
      {children ?? <ProgressFilledTrack value={value} />}
    </View>
  )
}

export function ProgressFilledTrack({
  value = 0,
  className,
}: {
  value?: number
  className?: string
}) {
  return (
    <View
      className={`h-full rounded-full bg-blue-600 ${className ?? ''}`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  )
}
