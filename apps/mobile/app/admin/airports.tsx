import { useEffect, useState, useMemo } from 'react'
import { Text, View, FlatList, TextInput, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { api, setApiBaseUrl, type AirportRef } from '@skyhub/api'

setApiBaseUrl('http://192.168.1.101:3002')

export default function AirportsList() {
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
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="pt-14 px-4 pb-3 border-b border-gray-100">
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <Text className="text-blue-600 text-[15px] font-medium">← Back</Text>
          </Pressable>
          <Text className="text-xl font-semibold">Airports</Text>
          <Text className="text-sm text-gray-400 ml-2">{filtered.length}</Text>
        </View>

        <TextInput
          className="bg-gray-50 rounded-lg px-3.5 py-2.5 text-sm border border-gray-200"
          placeholder="Search ICAO, IATA, name, city…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-sm text-gray-400">Loading airports…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View className="flex-row items-center py-3 border-b border-gray-100">
              <View className="w-14">
                <Text className="text-[13px] font-bold text-blue-700">
                  {item.iataCode ?? '—'}
                </Text>
                <Text className="text-[10px] text-gray-400">{item.icaoCode}</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[13px] font-medium" numberOfLines={1}>{item.name}</Text>
                <Text className="text-[11px] text-gray-500">
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
