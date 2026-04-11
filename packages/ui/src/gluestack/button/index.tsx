// Gluestack-compatible Button primitive
// Provides accessible button with loading, disabled, aria support
import React from 'react'
import { Pressable, Text, ActivityIndicator, type PressableProps, type ViewStyle } from 'react-native'

interface ButtonProps extends Omit<PressableProps, 'children'> {
  children?: React.ReactNode
  className?: string
  isDisabled?: boolean
  isLoading?: boolean
}

interface ButtonTextProps {
  children: React.ReactNode
  className?: string
  style?: any
}

interface ButtonSpinnerProps {
  className?: string
  color?: string
  size?: 'small' | 'large'
}

interface ButtonIconProps {
  as: React.ComponentType<any>
  className?: string
  size?: number
  color?: string
  strokeWidth?: number
}

export function Button({ children, className, isDisabled, isLoading, ...props }: ButtonProps) {
  return (
    <Pressable
      className={className}
      disabled={isDisabled || isLoading}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled || isLoading }}
      {...props}
    >
      {children}
    </Pressable>
  )
}

export function ButtonText({ children, className, style }: ButtonTextProps) {
  return (
    <Text className={className} style={style}>
      {children}
    </Text>
  )
}

export function ButtonSpinner({ className, color = '#ffffff', size = 'small' }: ButtonSpinnerProps) {
  return <ActivityIndicator className={className} color={color} size={size} />
}

export function ButtonIcon({ as: IconComponent, className, size = 18, color, strokeWidth = 1.75 }: ButtonIconProps) {
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} className={className} />
}
