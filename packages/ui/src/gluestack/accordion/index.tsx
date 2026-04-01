// Gluestack-compatible Accordion primitive
import React, { createContext, useContext, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ChevronDown } from 'lucide-react-native'

const ItemCtx = createContext<{ isExpanded: boolean; toggle: () => void }>({
  isExpanded: false,
  toggle: () => {},
})

export function Accordion({
  children,
  className,
  type = 'single',
}: {
  children: React.ReactNode
  className?: string
  type?: 'single' | 'multiple'
}) {
  return <View className={className}>{children}</View>
}

export function AccordionItem({
  children,
  value,
  className,
}: {
  children: React.ReactNode
  value: string
  className?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <ItemCtx.Provider value={{ isExpanded, toggle: () => setIsExpanded(!isExpanded) }}>
      <View className={className}>{children}</View>
    </ItemCtx.Provider>
  )
}

export function AccordionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function AccordionTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const { toggle } = useContext(ItemCtx)
  return (
    <Pressable className={`flex-row items-center justify-between py-3 ${className ?? ''}`} onPress={toggle}>
      {children}
    </Pressable>
  )
}

export function AccordionTitleText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-sm font-medium flex-1 ${className ?? ''}`}>{children}</Text>
}

export function AccordionContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isExpanded } = useContext(ItemCtx)
  if (!isExpanded) return null
  return <View className={`pb-3 ${className ?? ''}`}>{children}</View>
}

export function AccordionContentText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-sm ${className ?? ''}`}>{children}</Text>
}

export function AccordionIcon({ className }: { className?: string }) {
  const { isExpanded } = useContext(ItemCtx)
  return (
    <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
      <ChevronDown size={16} color="#888" className={className} />
    </View>
  )
}
