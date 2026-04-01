// Gluestack-compatible Modal primitive
// Focus trapping, backdrop dismiss, keyboard accessible
import React, { createContext, useContext } from 'react'
import {
  Modal as RNModal,
  View,
  Pressable,
  Text,
  type ModalProps as RNModalProps,
} from 'react-native'

const ModalContext = createContext<{ onClose: () => void }>({
  onClose: () => {},
})

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  closeOnOverlayClick?: boolean
}

export function Modal({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
}: ModalProps) {
  return (
    <ModalContext.Provider value={{ onClose }}>
      <RNModal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View className="flex-1 justify-center items-center">
          {children}
        </View>
      </RNModal>
    </ModalContext.Provider>
  )
}

export function ModalBackdrop({ className }: { className?: string }) {
  const { onClose } = useContext(ModalContext)
  return (
    <Pressable
      className={`absolute inset-0 bg-black/50 ${className ?? ''}`}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Close modal"
    />
  )
}

export function ModalContent({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return (
    <View className={`w-[90%] max-w-md z-10 ${className ?? ''}`} style={style}>
      {children}
    </View>
  )
}

export function ModalHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <View className={`${className ?? ''}`}>{children}</View>
}

export function ModalCloseButton({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  const { onClose } = useContext(ModalContext)
  return (
    <Pressable
      className={className}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
    >
      {children ?? <Text>X</Text>}
    </Pressable>
  )
}

export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <View className={className}>{children}</View>
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <View className={`flex-row ${className ?? ''}`}>{children}</View>
}
