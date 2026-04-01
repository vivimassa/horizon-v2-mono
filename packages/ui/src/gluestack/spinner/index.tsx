// Gluestack-compatible Spinner primitive
import React from 'react'
import { ActivityIndicator } from 'react-native'

export function Spinner({
  className,
  color,
  size = 'small',
}: {
  className?: string
  color?: string
  size?: 'small' | 'large'
}) {
  return <ActivityIndicator className={className} color={color} size={size} />
}
