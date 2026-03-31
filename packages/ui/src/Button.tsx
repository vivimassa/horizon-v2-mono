import React from 'react'
import {
  Pressable,
  Text,
  StyleSheet,
  type ViewStyle,
  type PressableProps,
} from 'react-native'

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string
  variant?: 'primary' | 'outline'
  style?: ViewStyle
}

export function Button({ title, variant = 'primary', style, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.outline,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textOutline]}>
        {title}
      </Text>
    </Pressable>
  )
}

const ACCENT = '#0066FF'

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    minHeight: 36,
  },
  primary: {
    backgroundColor: ACCENT,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  textPrimary: {
    color: '#ffffff',
  },
  textOutline: {
    color: ACCENT,
  },
})
