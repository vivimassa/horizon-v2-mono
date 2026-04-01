// Gluestack-compatible Checkbox primitive
import React, { createContext, useContext } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Check } from 'lucide-react-native'

interface CheckboxCtx {
  isChecked: boolean
}

const Ctx = createContext<CheckboxCtx>({ isChecked: false })

export function Checkbox({
  children,
  value,
  isChecked,
  onChange,
  className,
  isDisabled,
}: {
  children: React.ReactNode
  value: string
  isChecked?: boolean
  onChange?: (checked: boolean) => void
  className?: string
  isDisabled?: boolean
}) {
  return (
    <Ctx.Provider value={{ isChecked: isChecked ?? false }}>
      <Pressable
        className={`flex-row items-center gap-2 min-h-[44px] ${className ?? ''}`}
        onPress={() => onChange?.(!isChecked)}
        disabled={isDisabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked, disabled: isDisabled }}
      >
        {children}
      </Pressable>
    </Ctx.Provider>
  )
}

export function CheckboxIndicator({ className }: { className?: string }) {
  const { isChecked } = useContext(Ctx)
  return (
    <View
      className={`w-5 h-5 rounded border-2 items-center justify-center ${
        isChecked ? 'border-blue-600 bg-blue-600' : 'border-gray-400'
      } ${className ?? ''}`}
    >
      {isChecked && <Check size={14} color="#ffffff" strokeWidth={2.5} />}
    </View>
  )
}

export function CheckboxLabel({
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

export function CheckboxIcon() {
  return null // Icon is rendered inline in CheckboxIndicator
}
