import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export type StatusKey = 'onTime' | 'delayed' | 'cancelled' | 'departed' | 'diverted' | 'scheduled'

const STATUS_CONFIG: Record<StatusKey, { bg: string; text: string; label: string }> = {
  onTime:    { bg: '#dcfce7', text: '#166534', label: 'On Time' },
  delayed:   { bg: '#fef3c7', text: '#92400e', label: 'Delayed' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
  departed:  { bg: '#dbeafe', text: '#1e40af', label: 'Departed' },
  diverted:  { bg: '#f3e8ff', text: '#6b21a8', label: 'Diverted' },
  scheduled: { bg: '#f5f5f5', text: '#555555', label: 'Scheduled' },
}

interface BadgeProps {
  variant: StatusKey
  label?: string
}

export function Badge({ variant, label }: BadgeProps) {
  const config = STATUS_CONFIG[variant]

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>
        {label ?? config.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
})
