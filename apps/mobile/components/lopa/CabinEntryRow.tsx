import { memo } from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { MinusCircle } from 'lucide-react-native'
import { modeColor, type Palette } from '@skyhub/ui/theme'
import type { CabinClassRef, CabinEntry } from '@skyhub/api'

interface CabinEntryRowProps {
  cabin: CabinEntry
  cabinClasses: CabinClassRef[]
  palette: Palette
  isDark: boolean
  onChangeSeats: (seats: number) => void
  onRemove?: () => void
}

export const CabinEntryRow = memo(function CabinEntryRow({
  cabin, cabinClasses, palette, isDark, onChangeSeats, onRemove,
}: CabinEntryRowProps) {
  const cc = cabinClasses.find(c => c.code === cabin.classCode)
  const color = modeColor(cc?.color || '#9ca3af', isDark)
  const name = cc?.name || cabin.classCode

  return (
    <View
      className="flex-row items-center rounded-xl"
      style={{
        borderWidth: 1, borderColor: palette.cardBorder,
        paddingHorizontal: 12, paddingVertical: 10, gap: 10,
      }}
    >
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color }} />
      <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: palette.text, width: 28 }}>
        {cabin.classCode}
      </Text>
      <Text style={{ fontSize: 13, color: palette.textSecondary, flex: 1 }} numberOfLines={1}>
        {name}
      </Text>
      <TextInput
        value={String(cabin.seats)}
        onChangeText={(t) => onChangeSeats(Math.max(0, Number(t) || 0))}
        keyboardType="number-pad"
        selectTextOnFocus
        style={{
          width: 64, textAlign: 'right',
          fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: palette.text,
          borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 8,
          paddingHorizontal: 8, paddingVertical: 4,
          backgroundColor: palette.card,
        }}
      />
      <Text style={{ fontSize: 12, color: palette.textTertiary }}>seats</Text>
      {onRemove && (
        <Pressable onPress={onRemove} className="active:opacity-60" hitSlop={8}>
          <MinusCircle size={18} color={palette.textTertiary} strokeWidth={1.5} />
        </Pressable>
      )}
    </View>
  )
})
