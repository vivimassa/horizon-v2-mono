// Gluestack-compatible Avatar primitive
import React from 'react'
import { View, Text, Image, type ImageSourcePropType } from 'react-native'

export function Avatar({
  children,
  className,
  size = 'md',
}: {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' }
  return (
    <View
      className={`rounded-full items-center justify-center bg-gray-300 dark:bg-gray-600 overflow-hidden ${sizeMap[size]} ${className ?? ''}`}
    >
      {children}
    </View>
  )
}

export function AvatarFallbackText({ children, className }: { children: React.ReactNode; className?: string }) {
  const text = typeof children === 'string' ? children.slice(0, 2).toUpperCase() : ''
  return <Text className={`text-sm font-semibold text-gray-600 dark:text-gray-300 ${className ?? ''}`}>{text}</Text>
}

export function AvatarImage({
  source,
  className,
}: {
  source: ImageSourcePropType | { uri: string }
  className?: string
}) {
  return <Image source={source} className={`w-full h-full ${className ?? ''}`} />
}
