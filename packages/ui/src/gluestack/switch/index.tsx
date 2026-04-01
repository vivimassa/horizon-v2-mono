// Gluestack-compatible Switch primitive
import React from 'react'
import { Switch as RNSwitch, type SwitchProps } from 'react-native'

export function Switch({
  value,
  onValueChange,
  className,
  trackColor,
  thumbColor,
  ...props
}: SwitchProps & { className?: string }) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      trackColor={trackColor ?? { false: '#d4d4d4', true: '#1e40af' }}
      thumbColor={thumbColor ?? '#ffffff'}
      accessibilityRole="switch"
      {...props}
    />
  )
}
