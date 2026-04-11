// Gluestack-compatible FormControl primitive
import React, { createContext, useContext } from 'react'
import { View, Text } from 'react-native'

interface FormControlCtx {
  isInvalid?: boolean
  isDisabled?: boolean
  isRequired?: boolean
}

const Ctx = createContext<FormControlCtx>({})

export function FormControl({
  children,
  className,
  isInvalid,
  isDisabled,
  isRequired,
}: {
  children: React.ReactNode
  className?: string
  isInvalid?: boolean
  isDisabled?: boolean
  isRequired?: boolean
}) {
  return (
    <Ctx.Provider value={{ isInvalid, isDisabled, isRequired }}>
      <View className={`gap-1 ${className ?? ''}`}>{children}</View>
    </Ctx.Provider>
  )
}

export function FormControlLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function FormControlLabelText({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return (
    <Text className={`text-xs font-semibold uppercase tracking-wider ${className ?? ''}`} style={style}>
      {children}
    </Text>
  )
}

export function FormControlHelper({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={className}>{children}</View>
}

export function FormControlHelperText({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: any
}) {
  return (
    <Text className={`text-xs ${className ?? ''}`} style={style}>
      {children}
    </Text>
  )
}

export function FormControlError({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isInvalid } = useContext(Ctx)
  if (!isInvalid) return null
  return <View className={className}>{children}</View>
}

export function FormControlErrorText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-xs text-red-500 ${className ?? ''}`}>{children}</Text>
}

export function FormControlErrorIcon({
  as: IconComponent,
  className,
  size = 14,
}: {
  as: React.ComponentType<any>
  className?: string
  size?: number
}) {
  return <IconComponent size={size} color="#ef4444" className={className} />
}
