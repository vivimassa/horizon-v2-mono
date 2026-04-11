// Gluestack-compatible Drawer primitive
import React, { createContext, useContext } from 'react'
import { Modal as RNModal, View, Pressable } from 'react-native'

const Ctx = createContext<{ onClose: () => void }>({ onClose: () => {} })

export function Drawer({
  isOpen,
  onClose,
  children,
  anchor = 'left',
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  anchor?: 'left' | 'right'
}) {
  return (
    <Ctx.Provider value={{ onClose }}>
      <RNModal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
        <View className={`flex-1 flex-row ${anchor === 'right' ? 'justify-end' : ''}`}>{children}</View>
      </RNModal>
    </Ctx.Provider>
  )
}

export function DrawerBackdrop({ className }: { className?: string }) {
  const { onClose } = useContext(Ctx)
  return <Pressable className={`absolute inset-0 bg-black/50 ${className ?? ''}`} onPress={onClose} />
}

export function DrawerContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`z-10 w-80 h-full ${className ?? ''}`}>{children}</View>
}

export function DrawerHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function DrawerBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`flex-1 ${className ?? ''}`}>{children}</View>
}

export function DrawerFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}
