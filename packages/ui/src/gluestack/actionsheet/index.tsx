// Gluestack-compatible Actionsheet primitive
import React, { createContext, useContext } from 'react'
import { Modal, View, Pressable, Text } from 'react-native'

const ActionsheetContext = createContext<{ onClose: () => void }>({
  onClose: () => {},
})

interface ActionsheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Actionsheet({ isOpen, onClose, children }: ActionsheetProps) {
  return (
    <ActionsheetContext.Provider value={{ onClose }}>
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View className="flex-1 justify-end">{children}</View>
      </Modal>
    </ActionsheetContext.Provider>
  )
}

export function ActionsheetBackdrop({ className }: { className?: string }) {
  const { onClose } = useContext(ActionsheetContext)
  return (
    <Pressable
      className={`absolute inset-0 bg-black/50 ${className ?? ''}`}
      onPress={onClose}
    />
  )
}

export function ActionsheetContent({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return (
    <View
      className={`rounded-t-2xl pb-8 ${className ?? ''}`}
      style={style}
    >
      <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 self-center mt-2 mb-3" />
      {children}
    </View>
  )
}

export function ActionsheetItem({
  children,
  onPress,
  className,
}: {
  children: React.ReactNode
  onPress?: () => void
  className?: string
}) {
  const { onClose } = useContext(ActionsheetContext)
  return (
    <Pressable
      className={`px-5 py-3.5 active:opacity-70 ${className ?? ''}`}
      onPress={() => {
        onPress?.()
        onClose()
      }}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  )
}

export function ActionsheetItemText({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return <Text className={`text-base ${className ?? ''}`} style={style}>{children}</Text>
}
