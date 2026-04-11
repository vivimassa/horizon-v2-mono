// SkyHub — SearchInput component
// Premium search field wrapping Gluestack Input for accessibility
import React, { useState } from 'react'
import { Pressable } from 'react-native'
import { domainIcons } from '../theme/icons'

const Search = domainIcons.search
const X = domainIcons.close
import { Input, InputField, InputSlot } from '../gluestack/input'
import { useTheme } from '../hooks/useTheme'
import { shadowStyles } from '../theme/shadows'
import { accentTint } from '../theme/colors'

interface SearchInputProps {
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  autoFocus?: boolean
}

export function SearchInput({ placeholder = 'Search...', value, onChangeText, autoFocus = false }: SearchInputProps) {
  const { palette, accentColor } = useTheme()
  const [isFocused, setIsFocused] = useState(false)

  const iconColor = isFocused ? accentColor : palette.textTertiary

  return (
    <Input
      className="flex-row items-center rounded-[10px] border h-10 px-3"
      style={{
        backgroundColor: palette.card,
        borderColor: isFocused ? accentTint(accentColor, 0.4) : palette.border,
        ...shadowStyles.input,
      }}
    >
      <InputSlot className="mr-2">
        <Search size={18} color={iconColor} strokeWidth={1.75} />
      </InputSlot>

      <InputField
        className="flex-1 text-sm"
        style={{ color: palette.text }}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {value.length > 0 ? (
        <InputSlot className="ml-1">
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={16} color={palette.textTertiary} strokeWidth={1.75} />
          </Pressable>
        </InputSlot>
      ) : null}
    </Input>
  )
}
