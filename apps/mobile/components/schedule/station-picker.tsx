import { useState, useMemo, memo } from 'react'
import { Text, View, FlatList, TextInput, Pressable, Modal } from 'react-native'
import { Search, X } from 'lucide-react-native'
import { type Palette } from '@skyhub/ui/theme'
import { api, type AirportRef } from '@skyhub/api'

export const StationPicker = memo(function StationPicker({
  visible, onClose, onSelect, palette, accent, isDark,
}: {
  visible: boolean; onClose: () => void; onSelect: (icao: string) => void;
  palette: Palette; accent: string; isDark: boolean
}) {
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [search, setSearch] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Lazy load airports on first open
  if (visible && !loaded) {
    api.getAirports().then(setAirports).catch(() => {}).finally(() => setLoaded(true))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return airports.slice(0, 50)
    return airports.filter(a =>
      a.icaoCode.toLowerCase().includes(q) ||
      (a.iataCode?.toLowerCase().includes(q)) ||
      a.name.toLowerCase().includes(q) ||
      (a.city?.toLowerCase().includes(q))
    ).slice(0, 50)
  }, [airports, search])

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View className="flex-1 mt-20 rounded-t-2xl" style={{ backgroundColor: palette.background }}>
          <View className="flex-row items-center px-4 pt-4 pb-2">
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 }}>Select Station</Text>
            <Pressable onPress={() => { onClose(); setSearch('') }} className="p-2 active:opacity-60">
              <X size={20} color={palette.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          <View className="flex-row items-center mx-4 mb-2 rounded-xl" style={{
            backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 12,
          }}>
            <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
            <TextInput className="flex-1 py-2.5 ml-2" style={{ fontSize: 15, color: palette.text }}
              placeholder="Search ICAO, IATA, name..." placeholderTextColor={palette.textTertiary}
              value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} autoFocus />
          </View>
          <FlatList data={filtered} keyExtractor={a => a._id}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onSelect(item.icaoCode); onClose(); setSearch('') }}
                className="flex-row items-center px-4 py-3 active:opacity-70"
                style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
                <Text style={{ width: 50, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>{item.icaoCode}</Text>
                <Text style={{ fontSize: 14, color: palette.textTertiary, fontFamily: 'monospace', width: 36 }}>{item.iataCode ?? ''}</Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text, flex: 1 }} numberOfLines={1}>{item.name}</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  )
})
