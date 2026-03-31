import React from 'react'
import {
  Pressable,
  View,
  StyleSheet,
  type ViewStyle,
  type ViewProps,
} from 'react-native'

interface CardProps extends ViewProps {
  pressable?: boolean
  elevated?: boolean
  padded?: boolean
  style?: ViewStyle
}

export function Card({ pressable, elevated, padded, style, children, ...rest }: CardProps) {
  const combined: ViewStyle[] = [
    styles.card,
    elevated && styles.elevated,
    padded && styles.padded,
    style,
  ].filter(Boolean) as ViewStyle[]

  if (pressable) {
    return (
      <Pressable
        style={({ pressed }) => [...combined, pressed && styles.pressed]}
        {...rest}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View style={combined} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: '#fafafa',
    borderColor: '#e0e0e0',
    gap: 8,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  padded: {
    padding: 16,
  },
  pressed: {
    opacity: 0.7,
  },
})
