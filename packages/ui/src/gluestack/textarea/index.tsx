// Gluestack-compatible Textarea primitive
import React, { forwardRef } from 'react'
import { View, TextInput, type TextInputProps } from 'react-native'

export function Textarea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export const TextareaInput = forwardRef<TextInput, TextInputProps & { className?: string }>(function TextareaInput(
  { className, ...props },
  ref,
) {
  return <TextInput ref={ref} className={className} multiline textAlignVertical="top" {...props} />
})
