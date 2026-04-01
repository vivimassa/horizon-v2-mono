// Gluestack-compatible Select primitive
import React, { createContext, useContext, useState } from 'react'
import { View, Text, Pressable, Modal, ScrollView } from 'react-native'

interface SelectCtx {
  value: string
  onValueChange: (v: string) => void
  isOpen: boolean
  setIsOpen: (v: boolean) => void
  label: string
}

const Ctx = createContext<SelectCtx>({
  value: '',
  onValueChange: () => {},
  isOpen: false,
  setIsOpen: () => {},
  label: '',
})

export function Select({
  children,
  selectedValue,
  onValueChange,
  className,
}: {
  children: React.ReactNode
  selectedValue?: string
  onValueChange?: (v: string) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Ctx.Provider
      value={{
        value: selectedValue ?? '',
        onValueChange: onValueChange ?? (() => {}),
        isOpen,
        setIsOpen,
        label: '',
      }}
    >
      <View className={className}>{children}</View>
    </Ctx.Provider>
  )
}

export function SelectTrigger({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  const { setIsOpen } = useContext(Ctx)
  return (
    <Pressable
      className={`flex-row items-center ${className ?? ''}`}
      onPress={() => setIsOpen(true)}
      accessibilityRole="button"
      style={style}
    >
      {children}
    </Pressable>
  )
}

export function SelectInput({
  placeholder,
  className,
  style,
}: {
  placeholder?: string
  className?: string
  style?: any
}) {
  const { value } = useContext(Ctx)
  return (
    <Text className={`flex-1 ${className ?? ''}`} style={style}>
      {value || placeholder || 'Select...'}
    </Text>
  )
}

export function SelectIcon({
  as: IconComponent,
  className,
  size = 16,
  color,
}: {
  as?: React.ComponentType<any>
  className?: string
  size?: number
  color?: string
}) {
  if (!IconComponent) return null
  return <IconComponent size={size} color={color} className={className} />
}

export function SelectPortal({ children }: { children: React.ReactNode }) {
  const { isOpen, setIsOpen } = useContext(Ctx)
  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
      <View className="flex-1 justify-center items-center">
        {children}
      </View>
    </Modal>
  )
}

export function SelectBackdrop({ className }: { className?: string }) {
  const { setIsOpen } = useContext(Ctx)
  return (
    <Pressable
      className={`absolute inset-0 bg-black/50 ${className ?? ''}`}
      onPress={() => setIsOpen(false)}
    />
  )
}

export function SelectContent({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return (
    <View className={`z-10 w-[80%] max-w-sm rounded-xl overflow-hidden ${className ?? ''}`} style={style}>
      <ScrollView className="max-h-72">{children}</ScrollView>
    </View>
  )
}

export function SelectItem({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  const { value: selected, onValueChange, setIsOpen } = useContext(Ctx)
  const isSelected = selected === value
  return (
    <Pressable
      className={`px-4 py-3 ${isSelected ? 'opacity-100' : 'opacity-80'} active:opacity-60 ${className ?? ''}`}
      onPress={() => {
        onValueChange(value)
        setIsOpen(false)
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Text className={`text-sm ${isSelected ? 'font-semibold' : ''} ${className ?? ''}`}>
        {label}
      </Text>
    </Pressable>
  )
}
