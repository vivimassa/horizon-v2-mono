import { useState, useEffect, useMemo, useCallback } from 'react'
import { Text, View, FlatList, TextInput, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import { Search, ChevronLeft, BedDouble, Plus } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'

const MAX_RESULTS = 50

export default function CrewHotelAddScreen() {
  const { palette, isDark, accent } = useAppTheme()
  const router = useRouter()

  const [step, setStep] = useState<'airport' | 'details'>('airport')
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [airport, setAirport] = useState<AirportRef | null>(null)
  const [search, setSearch] = useState('')
  const [hotelName, setHotelName] = useState('')
  const [priority, setPriority] = useState('1')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api
      .getAirports()
      .then(setAirports)
      .catch((err: any) => Alert.alert('Error', err.message || 'Failed to load airports'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return airports.slice(0, MAX_RESULTS)
    return airports
      .filter(
        (a) =>
          a.icaoCode.toLowerCase().includes(q) ||
          a.iataCode?.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS)
  }, [airports, search])

  const handleCreate = useCallback(async () => {
    if (!airport || !hotelName.trim()) {
      Alert.alert('Missing fields', 'Pick an airport and enter a hotel name.')
      return
    }
    setCreating(true)
    try {
      await api.createCrewHotel({
        airportIcao: airport.icaoCode.toUpperCase(),
        hotelName: hotelName.trim(),
        priority: Number(priority) || 1,
        isActive: true,
      })
      router.back()
    } catch (err: any) {
      let msg = err.message || 'Create failed'
      const match = msg.match(/API \d+:\s*(.*)$/)?.[1]
      if (match) {
        try {
          const body = JSON.parse(match)
          if (body?.error) msg = body.error
        } catch {
          msg = match
        }
      }
      Alert.alert('Create Failed', msg)
    } finally {
      setCreating(false)
    }
  }, [airport, hotelName, priority, router])

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center mb-3">
          <Pressable
            onPress={() => (step === 'details' ? setStep('airport') : router.back())}
            className="mr-3 active:opacity-60"
          >
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
          <View
            className="items-center justify-center rounded-lg mr-3"
            style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
          >
            <BedDouble size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Crew Hotel</Text>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>
              {step === 'airport' ? 'Step 1 of 2 · Pick airport' : `Step 2 of 2 · ${airport?.icaoCode} details`}
            </Text>
          </View>
        </View>

        {step === 'airport' && (
          <View
            className="flex-row items-center rounded-xl"
            style={{
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              paddingHorizontal: 12,
            }}
          >
            <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
            <TextInput
              className="flex-1 py-2.5 ml-2"
              style={{ fontSize: 15, color: palette.text }}
              placeholder="Search airports by IATA, ICAO, name, city..."
              placeholderTextColor={palette.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>
        )}
      </View>

      {step === 'airport' ? (
        loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading airports...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setAirport(item)
                  setStep('details')
                }}
                className="flex-row items-center active:opacity-70"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.border,
                }}
              >
                <View style={{ width: 80 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
                    {item.iataCode ?? '—'}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', color: palette.textTertiary }}>
                    {item.icaoCode}
                  </Text>
                </View>
                <View className="flex-1 mx-2">
                  <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }} numberOfLines={1}>
                    {[item.city, item.countryName ?? item.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="py-10 items-center px-8">
                <Text style={{ fontSize: 15, color: palette.textTertiary, textAlign: 'center' }}>
                  {search ? 'No matching airports' : 'No airports'}
                </Text>
              </View>
            }
          />
        )
      ) : (
        <View className="px-4 pt-6" style={{ gap: 16 }}>
          <View
            className="rounded-xl"
            style={{
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              className="items-center justify-center rounded-md"
              style={{ width: 44, height: 44, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
                {airport?.iataCode ?? '—'}
              </Text>
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{airport?.name}</Text>
              <Text style={{ fontSize: 13, color: palette.textSecondary }}>
                {[airport?.city, airport?.countryName].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>

          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: palette.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Hotel Name *
            </Text>
            <TextInput
              value={hotelName}
              onChangeText={setHotelName}
              placeholder="e.g. PREMIER INN OP CREW"
              placeholderTextColor={palette.textTertiary}
              autoCapitalize="characters"
              style={{
                height: 44,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: palette.cardBorder,
                backgroundColor: palette.card,
                paddingHorizontal: 12,
                fontSize: 14,
                color: palette.text,
              }}
            />
          </View>

          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: palette.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Priority
            </Text>
            <TextInput
              value={priority}
              onChangeText={setPriority}
              keyboardType="number-pad"
              style={{
                height: 44,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: palette.cardBorder,
                backgroundColor: palette.card,
                paddingHorizontal: 12,
                fontSize: 14,
                color: palette.text,
              }}
            />
            <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 4 }}>
              1 = first choice for layover pick
            </Text>
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={creating}
            className="flex-row items-center justify-center rounded-lg active:opacity-80"
            style={{
              height: 44,
              backgroundColor: accent,
              opacity: creating ? 0.6 : 1,
              gap: 6,
              marginTop: 8,
            }}
          >
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
              {creating ? 'Creating…' : 'Create Hotel'}
            </Text>
          </Pressable>

          <Text style={{ fontSize: 12, color: palette.textTertiary, lineHeight: 18, marginTop: 4 }}>
            After creation, edit the hotel to fill address, coordinates, contracts, and shuttle schedules.
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}
