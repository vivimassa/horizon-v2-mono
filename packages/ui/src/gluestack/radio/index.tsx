// Gluestack-compatible Radio primitive
import React, { createContext, useContext } from 'react'
import { View, Text, Pressable } from 'react-native'

interface RadioGroupCtx {
  value: string
  onChange: (v: string) => void
}

const GroupCtx = createContext<RadioGroupCtx>({
  value: '',
  onChange: () => {},
})

export function RadioGroup({
  children,
  value,
  onChange,
  className,
}: {
  children: React.ReactNode
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <GroupCtx.Provider value={{ value, onChange }}>
      <View className={className} accessibilityRole="radiogroup">
        {children}
      </View>
    </GroupCtx.Provider>
  )
}

export function Radio({
  children,
  value,
  className,
  isDisabled,
}: {
  children: React.ReactNode
  value: string
  className?: string
  isDisabled?: boolean
}) {
  const { value: selected, onChange } = useContext(GroupCtx)
  const isSelected = selected === value
  return (
    <Pressable
      className={`flex-row items-center gap-2 min-h-[44px] ${className ?? ''}`}
      onPress={() => onChange(value)}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
    >
      <View
        className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
          isSelected ? 'border-blue-600' : 'border-gray-400'
        }`}
      >
        {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
      </View>
      {children}
    </Pressable>
  )
}

export function RadioIndicator() {
  return null // Rendered inline in Radio
}

export function RadioLabel({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return <Text className={`text-sm ${className ?? ''}`} style={style}>{children}</Text>
}

export function RadioIcon() {
  return null
}
