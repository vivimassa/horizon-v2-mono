// SkyHub — Divider component
// 1px horizontal or vertical line in palette.border
import React from 'react'
import { View } from 'react-native'
import { useTheme } from '../hooks/useTheme'

interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  marginY?: number
  marginX?: number
  /** Override the border color (defaults to palette.border) */
  color?: string
}

export function Divider({ orientation = 'horizontal', marginY = 0, marginX = 0, color }: DividerProps) {
  const { palette } = useTheme()
  const backgroundColor = color ?? palette.border

  if (orientation === 'vertical') {
    return (
      <View
        style={{
          width: 1,
          alignSelf: 'stretch',
          marginHorizontal: marginX,
          marginVertical: marginY,
          backgroundColor,
        }}
      />
    )
  }

  return (
    <View
      style={{
        height: 1,
        alignSelf: 'stretch',
        marginVertical: marginY,
        marginHorizontal: marginX,
        backgroundColor,
      }}
    />
  )
}
