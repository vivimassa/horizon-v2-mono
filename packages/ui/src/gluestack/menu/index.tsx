// Gluestack-compatible Menu primitive (simplified)
import React, { useState } from 'react'
import { View, Text, Pressable, Modal } from 'react-native'

export function Menu({
  children,
  trigger,
}: {
  children: React.ReactNode
  trigger: (props: { onPress: () => void }) => React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <View>
      {trigger({ onPress: () => setIsOpen(true) })}
      {isOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
          <Pressable className="flex-1" onPress={() => setIsOpen(false)}>
            <View className="flex-1 justify-center items-center">
              <View className="rounded-xl shadow-lg bg-white dark:bg-neutral-800 min-w-[200px] py-1">
                {React.Children.map(children, (child) =>
                  React.isValidElement(child)
                    ? React.cloneElement(child as React.ReactElement<any>, {
                        _onClose: () => setIsOpen(false),
                      })
                    : child,
                )}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  )
}

export function MenuItem({
  children,
  onPress,
  className,
  _onClose,
}: {
  children: React.ReactNode
  onPress?: () => void
  className?: string
  _onClose?: () => void
}) {
  return (
    <Pressable
      className={`px-4 py-3 active:bg-gray-100 dark:active:bg-gray-700 ${className ?? ''}`}
      onPress={() => {
        onPress?.()
        _onClose?.()
      }}
      accessibilityRole="menuitem"
    >
      {children}
    </Pressable>
  )
}

export function MenuItemLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-sm ${className ?? ''}`}>{children}</Text>
}
