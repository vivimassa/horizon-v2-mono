import React from 'react'
import { TextInput, StyleSheet, type TextInputProps } from 'react-native'

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#999"
      {...props}
      style={[styles.input, props.style]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    color: '#111',
  },
})
