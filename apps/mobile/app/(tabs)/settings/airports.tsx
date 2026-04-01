import { useEffect, useState, useMemo } from 'react'
import { Text, View, FlatList, TextInput, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { api, setApiBaseUrl, type AirportRef } from '@skyhub/api'
import { useAppTheme } from '../../../providers/ThemeProvider'

setApiBaseUrl('http://192.168.1.101:3002')

export default function AirportsList() {
  const { palette, isDark } = useAppTheme()
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    api.getAirports()
      .then(setAirports)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return airports
    const q = search.toLowerCase()
    return airports.filter(a =>
      a.icaoCode.toLowerCase().includes(q) ||
      (a.iataCode?.toLowerCase().includes(q)) ||
      a.name.toLowerCase().includes(q) ||
      (a.city?.toLowerCase().includes(q))
    )
  }, [airports, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      {/* Header */}
      <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <Text className="text-[15px] font-medium" style={{ color: '#1e40af' }}>{'\u2190'} Back</Text>
          </Pressable>
          <Text className="text-xl font-semibold" style={{ color: palette.text }}>Airports</Text>
          <Text className="text-sm ml-2" style={{ color: palette.textTertiary }}>{filtered.length}</Text>
        </View>

        <TextInput
          className="rounded-lg px-3.5 py-2.5 text-sm"
          style={{
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            color: palette.text,
          }}
          placeholder="Search ICAO, IATA, name, city\u2026"
          placeholderTextColor={palette.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-sm" style={{ color: palette.textTertiary }}>Loading airports\u2026</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View className="flex-row items-center py-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
              <View className="w-14">
                <Text className="text-[13px] font-bold" style={{ color: '#1e40af' }}>
                  {item.iataCode ?? '\u2014'}
                </Text>
                <Text className="text-[10px]" style={{ color: palette.textTertiary }}>{item.icaoCode}</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[13px] font-medium" style={{ color: palette.text }} numberOfLines={1}>{item.name}</Text>
                <Text className="text-[11px]" style={{ color: palette.textSecondary }}>
                  {[item.city, item.country].filter(Boolean).join(', ')}
                </Text>
              </View>
              {item.countryFlag && (
                <Text className="text-lg ml-2">{item.countryFlag}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  )
}
