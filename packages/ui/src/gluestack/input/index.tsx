// Gluestack-compatible Input primitive
// Provides accessible text input with slots for icons
import React, { forwardRef } from 'react'
import { View, TextInput, type TextInputProps } from 'react-native'

interface InputProps {
  children: React.ReactNode
  className?: string
  style?: any
  isDisabled?: boolean
  isReadOnly?: boolean
  isFocused?: boolean
}

interface InputFieldProps extends TextInputProps {
  className?: string
}

interface InputSlotProps {
  children: React.ReactNode
  className?: string
  onPress?: () => void
}

interface InputIconProps {
  as: React.ComponentType<any>
  className?: string
  size?: number
  color?: string
  strokeWidth?: number
}

export function Input({ children, className, style, isDisabled }: InputProps) {
  return (
    <View
      className={className}
      style={style}
      accessibilityState={{ disabled: isDisabled }}
      pointerEvents={isDisabled ? 'none' : 'auto'}
    >
      {children}
    </View>
  )
}

export const InputField = forwardRef<TextInput, InputFieldProps>(function InputField({ className, ...props }, ref) {
  return <TextInput ref={ref} className={className} accessibilityRole="none" {...props} />
})

export function InputSlot({ children, className, onPress }: InputSlotProps) {
  return (
    <View className={className} onTouchEnd={onPress}>
      {children}
    </View>
  )
}

export function InputIcon({ as: IconComponent, className, size = 18, color, strokeWidth = 1.75 }: InputIconProps) {
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} className={className} />
}
