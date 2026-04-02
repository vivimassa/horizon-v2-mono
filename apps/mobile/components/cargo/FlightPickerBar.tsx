import { View, Text, Pressable, TextInput, Modal, FlatList } from 'react-native'
import { Search, Plane, PanelBottomClose } from 'lucide-react-native'
import type { Palette } from '@skyhub/ui/theme'
import type { CargoFlight } from '../../types/cargo'
import { STATUS_CONFIG } from '../../data/mock-cargo'

interface FlightPickerBarProps {
  selectedFlight: CargoFlight | undefined
  showPicker: boolean
  setShowPicker: (v: boolean) => void
  search: string
  setSearch: (v: string) => void
  filteredFlights: CargoFlight[]
  onPickFlight: (id: string) => void
  selectedId: string
  palette: Palette
  accent: string
  isDark: boolean
  onCollapse?: () => void
}

export function FlightPickerBar({
  selectedFlight,
  showPicker,
  setShowPicker,
  search,
  setSearch,
  filteredFlights,
  onPickFlight,
  selectedId,
  palette,
  accent,
  isDark,
  onCollapse,
}: FlightPickerBarProps) {
  return (
    <>
      <View className="flex-row items-center gap-2 mb-4">
        <Pressable
          onPress={() => setShowPicker(true)}
          className="flex-1 flex-row items-center rounded-xl px-4 py-3"
          style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
        >
          <Text className="flex-1" style={{ fontSize: 14, fontWeight: '600', color: selectedFlight ? palette.text : palette.textTertiary }}>
            {selectedFlight ? selectedFlight.id : 'Select flight...'}
          </Text>
          <Search size={16} color={palette.textTertiary} strokeWidth={2} />
        </Pressable>
        {onCollapse && (
          <Pressable
            onPress={onCollapse}
            className="rounded-xl items-center justify-center"
            style={{
              width: 44,
              height: 44,
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
            }}
          >
            <PanelBottomClose size={18} color={palette.textSecondary} strokeWidth={1.8} />
          </Pressable>
        )}
      </View>

      <Modal visible={showPicker} transparent animationType="fade">
        <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowPicker(false)}>
          <View className="flex-1" />
          <Pressable onPress={() => {}}>
            <View className="rounded-t-2xl" style={{ backgroundColor: isDark ? '#1e1e24' : '#ffffff', maxHeight: 400, paddingBottom: 40 }}>
              <View className="px-4 pt-4 pb-2">
                <View className="flex-row items-center rounded-lg px-3 py-2.5" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
                  <Search size={14} color={palette.textTertiary} strokeWidth={2} />
                  <TextInput
                    placeholder="Search flights..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor={palette.textTertiary}
                    autoFocus={false}
                    style={{ flex: 1, marginLeft: 8, fontSize: 14, color: palette.text }}
                  />
                </View>
              </View>
              <FlatList
                data={filteredFlights}
                keyExtractor={(f) => f.id}
                renderItem={({ item: f }) => {
                  const sc = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.scheduled
                  const sBg = isDark ? sc.darkBg : sc.bg
                  const sText = isDark ? sc.darkText : sc.text
                  return (
                    <Pressable
                      onPress={() => onPickFlight(f.id)}
                      className="flex-row items-center px-4 py-3"
                      style={{
                        backgroundColor: f.id === selectedId ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      }}
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{f.id}</Text>
                          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: sBg }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: sText }}>{sc.label}</Text>
                          </View>
                        </View>
                        <View className="flex-row items-center mt-1">
                          <Text style={{ fontSize: 12, color: palette.textSecondary }}>{f.dep}</Text>
                          <Plane size={10} color={palette.textTertiary} style={{ marginHorizontal: 4, transform: [{ rotate: '45deg' }] }} />
                          <Text style={{ fontSize: 12, color: palette.textSecondary }}>{f.arr}</Text>
                          <Text style={{ fontSize: 12, color: palette.textTertiary, marginLeft: 'auto' }}>{f.aircraftType}</Text>
                        </View>
                      </View>
                    </Pressable>
                  )
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
