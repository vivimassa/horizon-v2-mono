import { useState, useMemo, useCallback, memo } from 'react'
import { Text, View, Pressable, FlatList, TextInput, Modal } from 'react-native'
import { ChevronDown, Search, X } from 'lucide-react-native'
import { accentTint, type Palette } from '../theme/colors'

interface MultiSelectItem {
  key: string
  label: string
}

interface MultiSelectProps {
  items: MultiSelectItem[]
  value: Set<string> | null // null = all selected
  onChange: (v: Set<string> | null) => void
  allLabel: string
  placeholder?: string
  accent: string
  palette: Palette
  isDark: boolean
}

export const MultiSelect = memo(function MultiSelect({
  items,
  value,
  onChange,
  allLabel,
  placeholder,
  accent,
  palette,
  isDark,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const isAll = value === null
  const selectedCount = isAll ? items.length : value.size

  const displayLabel = isAll
    ? allLabel
    : selectedCount === 0
      ? (placeholder ?? allLabel)
      : selectedCount <= 3
        ? [...value].join(', ')
        : `${selectedCount} selected`

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return items
    return items.filter((i) => i.key.toLowerCase().includes(q) || i.label.toLowerCase().includes(q))
  }, [items, search])

  const toggle = useCallback(
    (key: string) => {
      if (isAll) {
        // Switching from "all" to "all except this one"
        const next = new Set(items.map((i) => i.key))
        next.delete(key)
        onChange(next.size === 0 ? null : next)
      } else {
        const next = new Set(value)
        if (next.has(key)) {
          next.delete(key)
          // If none selected, revert to "all"
          onChange(next.size === 0 ? null : next)
        } else {
          next.add(key)
          // If all selected, revert to null
          onChange(next.size === items.length ? null : next)
        }
      }
    },
    [isAll, value, items, onChange],
  )

  const isChecked = useCallback(
    (key: string): boolean => {
      return isAll || value.has(key)
    },
    [isAll, value],
  )

  return (
    <>
      {/* Trigger */}
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center rounded-lg"
        style={{
          height: 40,
          paddingHorizontal: 12,
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: !isAll ? accentTint(accent, 0.3) : palette.cardBorder,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: !isAll ? '600' : '400',
            color: !isAll ? palette.text : palette.textTertiary,
          }}
          numberOfLines={1}
        >
          {displayLabel}
        </Text>
        <ChevronDown size={14} color={palette.textTertiary} strokeWidth={2} />
      </Pressable>

      {/* Modal */}
      <Modal visible={open} transparent animationType="fade">
        <Pressable
          className="flex-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => {
            setOpen(false)
            setSearch('')
          }}
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              onPress={() => {}}
              className="rounded-2xl overflow-hidden"
              style={{
                width: 300,
                maxHeight: 440,
                backgroundColor: isDark ? 'rgba(25,25,33,0.97)' : 'rgba(255,255,255,0.98)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              {/* Search */}
              <View
                className="flex-row items-center px-3 py-2"
                style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
              >
                <Search size={14} color={palette.textTertiary} strokeWidth={1.8} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search..."
                  placeholderTextColor={palette.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  className="flex-1 ml-2"
                  style={{ fontSize: 14, color: palette.text, height: 36 }}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')} className="p-1 active:opacity-60">
                    <X size={14} color={palette.textTertiary} strokeWidth={2} />
                  </Pressable>
                )}
              </View>

              {/* List */}
              <FlatList
                data={filtered}
                keyExtractor={(i) => i.key}
                style={{ maxHeight: 340 }}
                ListEmptyComponent={
                  <View className="items-center py-6">
                    <Text style={{ fontSize: 14, color: palette.textTertiary }}>No matches</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const checked = isChecked(item.key)
                  return (
                    <Pressable
                      onPress={() => toggle(item.key)}
                      className="flex-row items-center active:opacity-70"
                      style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 8, gap: 10 }}
                    >
                      {/* Checkbox */}
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: checked ? accent : palette.textTertiary,
                          backgroundColor: checked ? accent : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {checked && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{'\u2713'}</Text>}
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text, flex: 1 }}>
                        {item.label}
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary }}>
                        {item.key}
                      </Text>
                    </Pressable>
                  )
                }}
              />

              {/* Footer: select all / clear all */}
              <View
                className="flex-row items-center justify-between px-4 py-3"
                style={{ borderTopWidth: 1, borderTopColor: palette.border }}
              >
                <Pressable onPress={() => onChange(null)} className="active:opacity-60">
                  <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Select All</Text>
                </Pressable>
                <Pressable onPress={() => onChange(new Set())} className="active:opacity-60">
                  <Text style={{ fontSize: 13, fontWeight: '500', color: palette.textSecondary }}>Clear All</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  )
})
