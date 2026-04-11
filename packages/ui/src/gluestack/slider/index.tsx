// Gluestack-compatible Slider primitive (simplified)
import React from 'react'
import { View, Text } from 'react-native'

export function Slider({
  value = 0,
  minValue = 0,
  maxValue = 100,
  onChange,
  className,
  children,
}: {
  value?: number
  minValue?: number
  maxValue?: number
  onChange?: (v: number) => void
  className?: string
  children?: React.ReactNode
}) {
  const pct = ((value - minValue) / (maxValue - minValue)) * 100
  return (
    <View className={`h-10 justify-center ${className ?? ''}`} accessibilityRole="adjustable">
      {children ?? (
        <>
          <SliderTrack>
            <SliderFilledTrack style={{ width: `${pct}%` }} />
          </SliderTrack>
          <SliderThumb style={{ left: `${pct}%` }} />
        </>
      )}
    </View>
  )
}

export function SliderTrack({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <View className={`h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 ${className ?? ''}`}>{children}</View>
}

export function SliderFilledTrack({ className, style }: { className?: string; style?: any }) {
  return <View className={`h-full rounded-full bg-blue-600 ${className ?? ''}`} style={style} />
}

export function SliderThumb({ className, style }: { className?: string; style?: any }) {
  return (
    <View
      className={`absolute w-5 h-5 rounded-full bg-white border-2 border-blue-600 -mt-2 -ml-2.5 shadow ${className ?? ''}`}
      style={style}
    />
  )
}
