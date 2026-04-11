// Gluestack-compatible Badge primitive
import React from 'react'
import { View, Text } from 'react-native'

export function GluestackBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-md px-2 py-0.5 ${className ?? ''}`}>{children}</View>
}
