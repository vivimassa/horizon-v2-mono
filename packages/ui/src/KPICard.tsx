import React from 'react'
import { View, Text, StyleSheet, type ViewStyle } from 'react-native'

interface KPICardProps {
  value: number | string
  label: string
  tint?: string
  style?: ViewStyle
}

export function KPICard({ value, label, tint, style }: KPICardProps) {
  return (
    <View
      style={[
        styles.card,
        tint ? { backgroundColor: `${tint}18` } : undefined,
        style,
      ]}
    >
      <Text style={[styles.value, { color: tint ?? '#0066FF' }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    gap: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    color: '#888',
  },
})
