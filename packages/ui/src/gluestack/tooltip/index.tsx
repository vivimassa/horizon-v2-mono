// Gluestack-compatible Tooltip primitive (simplified)
import React, { useState } from 'react'
import { View, Text, Pressable } from 'react-native'

export function Tooltip({
  children,
  trigger,
}: {
  children: React.ReactNode
  trigger: (props: { onPress: () => void }) => React.ReactNode
}) {
  const [visible, setVisible] = useState(false)
  return (
    <View>
      {trigger({ onPress: () => setVisible(!visible) })}
      {visible && <View className="absolute top-full mt-1 z-50">{children}</View>}
    </View>
  )
}

export function TooltipContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`rounded-lg px-3 py-1.5 bg-gray-900 dark:bg-gray-100 ${className ?? ''}`}>
      {children}
    </View>
  )
}

export function TooltipText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-xs text-white dark:text-gray-900 ${className ?? ''}`}>{children}</Text>
}
