// SkyHub — TextInput component
// Form input wrapper with label, error, hint, icon slots.
// Different from <SearchInput> (which is the search-bar variant).
import React, { useState } from 'react'
import { View, TextInput as RNTextInput, type TextInputProps as RNTextInputProps } from 'react-native'
import { useTheme } from '../hooks/useTheme'
import { accentTint } from '../theme/colors'
import { shadowStyles } from '../theme/shadows'
import { Text } from './Text'

const ERROR_RED = '#E63535'
const SUCCESS_GREEN = '#06C270'

interface TextInputProps extends RNTextInputProps {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  success?: boolean
}

export function TextInput({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  success,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps) {
  const { palette, accentColor } = useTheme()
  const [focused, setFocused] = useState(false)

  let borderColor = palette.border
  if (error) borderColor = ERROR_RED
  else if (success) borderColor = SUCCESS_GREEN
  else if (focused) borderColor = accentTint(accentColor, 0.6)

  return (
    <View>
      {label ? (
        <Text variant="fieldLabel" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 40,
          borderRadius: 8,
          borderWidth: focused ? 2 : 1,
          borderColor,
          backgroundColor: palette.card,
          paddingHorizontal: 12,
          ...shadowStyles.input,
        }}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}

        <RNTextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          placeholderTextColor={palette.textTertiary}
          style={[
            {
              flex: 1,
              fontSize: 14,
              fontWeight: '400',
              color: palette.text,
              paddingVertical: 0,
            },
            style,
          ]}
        />

        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" color={ERROR_RED} style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted style={{ marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}
