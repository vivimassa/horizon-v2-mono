// Gluestack-compatible Popover primitive (simplified)
import React, { createContext, useContext, useState } from 'react'
import { View, Pressable, Modal } from 'react-native'

const Ctx = createContext<{ isOpen: boolean; setIsOpen: (v: boolean) => void }>({
  isOpen: false,
  setIsOpen: () => {},
})

export function Popover({
  children,
  trigger,
}: {
  children: React.ReactNode
  trigger: (props: { onPress: () => void }) => React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Ctx.Provider value={{ isOpen, setIsOpen }}>
      {trigger({ onPress: () => setIsOpen(true) })}
      {isOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
          <Pressable className="flex-1" onPress={() => setIsOpen(false)}>
            <View className="flex-1 justify-center items-center">{children}</View>
          </Pressable>
        </Modal>
      )}
    </Ctx.Provider>
  )
}

export function PopoverBackdrop() {
  return null // Handled by Popover
}

export function PopoverContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-xl shadow-lg ${className ?? ''}`}>{children}</View>
}

export function PopoverHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function PopoverBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function PopoverFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function PopoverArrow() {
  return null // Simplified — no arrow rendering
}
