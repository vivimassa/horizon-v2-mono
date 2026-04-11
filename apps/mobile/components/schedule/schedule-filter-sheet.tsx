import { useState, memo } from 'react'
import { Text, View, Pressable, TextInput, Modal } from 'react-native'
import { X } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'

export interface ScheduleFilters {
  dateFrom: string
  dateTo: string
  dep: string
  arr: string
  acType: string
  status: string
}

const STATUSES = ['', 'draft', 'active', 'suspended', 'cancelled']
const STATUS_LABELS: Record<string, string> = {
  '': 'All',
  draft: 'Draft',
  active: 'Active',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

export const ScheduleFilterSheet = memo(function ScheduleFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  palette,
  accent,
  isDark,
  isTablet,
}: {
  visible: boolean
  onClose: () => void
  filters: ScheduleFilters
  onApply: (f: ScheduleFilters) => void
  palette: Palette
  accent: string
  isDark: boolean
  isTablet: boolean
}) {
  const [draft, setDraft] = useState<ScheduleFilters>(filters)

  const handleApply = () => {
    onApply(draft)
    onClose()
  }
  const handleClear = () => {
    const empty: ScheduleFilters = { dateFrom: '', dateTo: '', dep: '', arr: '', acType: '', status: '' }
    setDraft(empty)
    onApply(empty)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View className="flex-1 mt-20 rounded-t-2xl" style={{ backgroundColor: palette.background }}>
          <View
            className="flex-row items-center px-4 pt-4 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 }}>Filter Schedule</Text>
            <Pressable onPress={onClose} className="p-2 active:opacity-60">
              <X size={20} color={palette.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12 }}>
              <FilterField
                label="From Date"
                value={draft.dateFrom}
                placeholder="YYYY-MM-DD"
                onChange={(v) => setDraft((p) => ({ ...p, dateFrom: v }))}
                palette={palette}
                flex={1}
              />
              <FilterField
                label="To Date"
                value={draft.dateTo}
                placeholder="YYYY-MM-DD"
                onChange={(v) => setDraft((p) => ({ ...p, dateTo: v }))}
                palette={palette}
                flex={1}
              />
            </View>
            <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12 }}>
              <FilterField
                label="DEP Station"
                value={draft.dep}
                placeholder="ICAO code"
                onChange={(v) => setDraft((p) => ({ ...p, dep: v.toUpperCase() }))}
                palette={palette}
                mono
                flex={1}
              />
              <FilterField
                label="ARR Station"
                value={draft.arr}
                placeholder="ICAO code"
                onChange={(v) => setDraft((p) => ({ ...p, arr: v.toUpperCase() }))}
                palette={palette}
                mono
                flex={1}
              />
            </View>
            <View className={isTablet ? 'flex-row' : ''} style={{ gap: 12 }}>
              <FilterField
                label="AC Type"
                value={draft.acType}
                placeholder="e.g. A320"
                onChange={(v) => setDraft((p) => ({ ...p, acType: v.toUpperCase() }))}
                palette={palette}
                mono
                flex={1}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: palette.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: '600',
                    marginBottom: 4,
                  }}
                >
                  Status
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {STATUSES.map((s) => {
                    const active = draft.status === s
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setDraft((p) => ({ ...p, status: s }))}
                        className="px-3 py-1.5 rounded-lg"
                        style={{
                          backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent',
                          borderWidth: 1,
                          borderColor: active ? accent : palette.cardBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: active ? '600' : '400',
                            color: active ? accent : palette.text,
                          }}
                        >
                          {STATUS_LABELS[s]}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </View>

            <View className="flex-row mt-4" style={{ gap: 12 }}>
              <Pressable
                onPress={handleClear}
                className="flex-1 items-center py-3 rounded-xl active:opacity-70"
                style={{ backgroundColor: accentTint(accent, isDark ? 0.1 : 0.05) }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                className="flex-1 items-center py-3 rounded-xl active:opacity-70"
                style={{ backgroundColor: accent }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
})

function FilterField({
  label,
  value,
  placeholder,
  onChange,
  palette,
  mono,
  flex = 1,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (v: string) => void
  palette: Palette
  mono?: boolean
  flex?: number
}) {
  return (
    <View style={{ flex }}>
      <Text
        style={{
          fontSize: 12,
          color: palette.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: '600',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        autoCapitalize={mono ? 'characters' : 'none'}
        style={{
          fontSize: 15,
          fontWeight: '500',
          color: palette.text,
          fontFamily: mono ? 'monospace' : undefined,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: palette.card,
        }}
      />
    </View>
  )
}
