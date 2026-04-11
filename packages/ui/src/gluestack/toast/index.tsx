// Gluestack-compatible Toast primitive
import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { View, Text, Animated } from 'react-native'

interface ToastItem {
  id: string
  render: () => React.ReactNode
  duration?: number
}

interface ToastContextType {
  show: (config: { render: () => React.ReactNode; duration?: number }) => string
  close: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

let idCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const close = useCallback((id: string) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (config: { render: () => React.ReactNode; duration?: number }) => {
      const id = `toast-${++idCounter}`
      const duration = config.duration ?? 3000
      setToasts((prev) => [...prev, { id, render: config.render, duration }])
      timers.current[id] = setTimeout(() => close(id), duration)
      return id
    },
    [close],
  )

  return (
    <ToastContext.Provider value={{ show, close }}>
      {children}
      <View className="absolute top-14 left-4 right-4 z-50 items-center gap-2">
        {toasts.map((t) => (
          <View key={t.id}>{t.render()}</View>
        ))}
      </View>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      show: (_config: { render: () => React.ReactNode; duration?: number }) => 'noop',
      close: (_id: string) => {},
    }
  }
  return ctx
}

export function Toast({ children, className, style }: { children: React.ReactNode; className?: string; style?: any }) {
  return (
    <View
      className={`rounded-xl px-4 py-3 shadow-lg w-full ${className ?? ''}`}
      accessibilityRole="alert"
      style={style}
    >
      {children}
    </View>
  )
}

export function ToastTitle({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return (
    <Text className={`text-sm font-semibold ${className ?? ''}`} style={style}>
      {children}
    </Text>
  )
}

export function ToastDescription({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return (
    <Text className={`text-xs mt-0.5 ${className ?? ''}`} style={style}>
      {children}
    </Text>
  )
}
