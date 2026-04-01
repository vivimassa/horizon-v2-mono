// Gluestack-compatible AlertDialog primitive
import React, { createContext, useContext } from 'react'
import { Modal as RNModal, View, Pressable, Text } from 'react-native'

const Ctx = createContext<{ onClose: () => void }>({ onClose: () => {} })

export function AlertDialog({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Ctx.Provider value={{ onClose }}>
      <RNModal visible={isOpen} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <View className="flex-1 justify-center items-center">{children}</View>
      </RNModal>
    </Ctx.Provider>
  )
}

export function AlertDialogBackdrop({ className }: { className?: string }) {
  const { onClose } = useContext(Ctx)
  return <Pressable className={`absolute inset-0 bg-black/50 ${className ?? ''}`} onPress={onClose} />
}

export function AlertDialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`w-[85%] max-w-sm z-10 ${className ?? ''}`}>{children}</View>
}

export function AlertDialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function AlertDialogCloseButton({ children, className }: { children?: React.ReactNode; className?: string }) {
  const { onClose } = useContext(Ctx)
  return <Pressable className={className} onPress={onClose} hitSlop={8}>{children ?? <Text>X</Text>}</Pressable>
}

export function AlertDialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function AlertDialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={`flex-row ${className ?? ''}`}>{children}</View>
}
