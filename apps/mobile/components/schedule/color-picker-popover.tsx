import { memo } from 'react'
import { Text, View, Pressable, Modal } from 'react-native'
import { X } from 'lucide-react-native'
import type { Palette } from '@skyhub/ui/theme'

const PALETTE = [
  // Row 1: theme
  '#000000',
  '#1C1C28',
  '#555770',
  '#8F90A6',
  '#C7C9D9',
  '#E4E4EB',
  '#F2F2F5',
  '#FFFFFF',
  // Row 2: vivid
  '#FF3B3B',
  '#FF8800',
  '#FFCC00',
  '#06C270',
  '#0063F7',
  '#6B4EFF',
  '#E63535',
  '#00B7C4',
  // Row 3: pastel
  '#FFE5E5',
  '#FFF3D6',
  '#FFF8CC',
  '#D6F5E8',
  '#D6E4FF',
  '#EDE5FF',
  '#FCE4E4',
  '#D6F7FA',
  // Row 4: mid-tone
  '#FF7A7A',
  '#FFB347',
  '#FFE066',
  '#57D9A3',
  '#5B8DEF',
  '#9B8AFF',
  '#F06060',
  '#73DFE7',
  // Row 5: dark
  '#B71C1C',
  '#E65100',
  '#F57F17',
  '#1B5E20',
  '#0D47A1',
  '#4A148C',
  '#880E4F',
  '#006064',
]

export const ColorPickerPopover = memo(function ColorPickerPopover({
  visible,
  title,
  onPick,
  onClose,
  palette,
  isDark,
}: {
  visible: boolean
  title: string
  onPick: (color: string) => void
  onClose: () => void
  palette: Palette
  isDark: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={onClose}>
        <View className="flex-1 justify-center items-center">
          <Pressable
            onPress={() => {}}
            className="rounded-2xl p-4"
            style={{
              width: 260,
              backgroundColor: isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.98)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: palette.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {title}
              </Text>
              <Pressable onPress={onClose} className="p-1 active:opacity-60">
                <X size={16} color={palette.textTertiary} strokeWidth={2} />
              </Pressable>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {PALETTE.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => {
                    onPick(color)
                    onClose()
                  }}
                  className="active:scale-110"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 4,
                    backgroundColor: color,
                    borderWidth: color === '#FFFFFF' ? 1 : 0,
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                  }}
                />
              ))}
            </View>
            <Pressable
              onPress={() => {
                onPick('')
                onClose()
              }}
              className="items-center py-2 mt-3 rounded-lg active:opacity-70"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '500', color: palette.textSecondary }}>No Color</Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
})
