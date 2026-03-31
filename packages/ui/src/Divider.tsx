import React from 'react'
import { View, StyleSheet, type ViewProps } from 'react-native'

export function Divider(props: ViewProps) {
  return <View {...props} style={[styles.divider, props.style]} />
}

const styles = StyleSheet.create({
  divider: {
    height: 0.5,
    width: '100%',
    backgroundColor: '#e0e0e0',
  },
})
