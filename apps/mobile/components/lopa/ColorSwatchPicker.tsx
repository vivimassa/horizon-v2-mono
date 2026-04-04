import { memo } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { Check } from 'lucide-react-native'
import type { Palette } from '@skyhub/ui/theme'

const SWATCHES = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ec4899', '#9ca3af',
]

interface ColorSwatchPickerProps {
  value: string
  onChange: (hex: string) => void
  palette: Palette
  isDark: boolean
  editing: boolean
}

export const ColorSwatchPicker = memo(function ColorSwatchPicker({
  value, onChange, palette, isDark, editing,
}: ColorSwatchPickerProps) {
  if (!editing) {
    return (
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View
          style={{
            width: 20, height: 20, borderRadius: 10,
            backgroundColor: value || '#9ca3af',
            borderWidth: 1, borderColor: palette.cardBorder,
          }}
        />
        <Text style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: '500', color: palette.text }}>
          {value || '---'}
        </Text>
      </View>
    )
  }

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {SWATCHES.map((hex) => {
          const selected = value?.toLowerCase() === hex.toLowerCase()
          return (
            <Pressable
              key={hex}
              onPress={() => onChange(hex)}
              className="items-center justify-center active:opacity-70"
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: hex,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? palette.text : palette.cardBorder,
              }}
            >
              {selected && <Check size={14} color="#fff" strokeWidth={3} />}
            </Pressable>
          )
        })}
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => {
          const v = t.startsWith('#') ? t : `#${t}`
          onChange(v.slice(0, 7))
        }}
        maxLength={7}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="#3b82f6"
        placeholderTextColor={palette.textTertiary}
        style={{
          fontSize: 13, fontFamily: 'monospace', color: palette.text,
          borderWidth: 1, borderColor: palette.cardBorder,
          borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
          backgroundColor: palette.card,
        }}
      />
    </View>
  )
})
