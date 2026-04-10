import { useState, useMemo, memo } from 'react'
import { Text, View, Pressable, FlatList, Modal } from 'react-native'
import { ChevronDown, Check } from 'lucide-react-native'
import { accentTint, type Palette } from '../theme/colors'

interface DropdownOption {
  value: string
  label: string
  color?: string
}

interface DropdownSelectProps {
  options: DropdownOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  accent: string
  palette: Palette
  isDark: boolean
}

export const DropdownSelect = memo(function DropdownSelect({
  options, value, onChange, placeholder = 'Select...', accent, palette, isDark,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder
  const hasValue = value != null && value !== ''

  return (
    <>
      {/* Trigger */}
      <Pressable onPress={() => setOpen(true)}
        className="flex-row items-center rounded-lg"
        style={{
          height: 40, paddingHorizontal: 12,
          backgroundColor: palette.card,
          borderWidth: 1, borderColor: hasValue ? accentTint(accent, 0.3) : palette.cardBorder,
        }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: hasValue ? '600' : '400',
          color: hasValue ? palette.text : palette.textTertiary }} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <ChevronDown size={14} color={palette.textTertiary} strokeWidth={2} />
      </Pressable>

      {/* Modal */}
      <Modal visible={open} transparent animationType="fade">
        <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setOpen(false)}>
          <View className="flex-1 justify-center items-center">
            <Pressable onPress={() => {}} className="rounded-2xl overflow-hidden"
              style={{
                width: 280, maxHeight: 400,
                backgroundColor: isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.98)',
                borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
              }}>
              <FlatList data={options} keyExtractor={o => o.value}
                renderItem={({ item: opt }) => {
                  const isActive = opt.value === value
                  return (
                    <Pressable onPress={() => { onChange(opt.value); setOpen(false) }}
                      className="flex-row items-center active:opacity-70"
                      style={{ minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
                      {opt.color && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: opt.color }} />
                      )}
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: isActive ? '600' : '400',
                        color: isActive ? accent : palette.text }}>
                        {opt.label}
                      </Text>
                      {isActive && <Check size={14} color={accent} strokeWidth={2} />}
                    </Pressable>
                  )
                }} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  )
})
