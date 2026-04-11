import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Text, View, FlatList, TextInput, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import { Search, ChevronLeft, MapPin, Plus, RefreshCw } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'

const MAX_RESULTS = 50

export default function CrewBaseAddScreen() {
  const { palette, isDark, accent } = useAppTheme()
  const router = useRouter()

  const [airports, setAirports] = useState<AirportRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingId, setSettingId] = useState<string | null>(null)

  const fetchAirports = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .getAirports()
      .then(setAirports)
      .catch((err: any) => setError(err.message || 'Failed to load airports'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchAirports()
  }, [fetchAirports])

  const available = useMemo(() => {
    const nonBases = airports.filter((a) => !a.isCrewBase)
    const q = search.toLowerCase().trim()
    if (!q) return nonBases.slice(0, MAX_RESULTS)

    return nonBases
      .filter(
        (a) =>
          a.icaoCode.toLowerCase().includes(q) ||
          a.iataCode?.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q) ||
          a.countryName?.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS)
  }, [airports, search])

  const totalAvailable = useMemo(() => airports.filter((a) => !a.isCrewBase).length, [airports])

  const handleSetAsBase = useCallback(
    async (airport: AirportRef) => {
      setSettingId(airport._id)
      try {
        await api.updateAirport(airport._id, { isCrewBase: true })
        router.back()
      } catch (err: any) {
        let msg = err.message || 'Failed to set as crew base'
        try {
          const match = msg.match(/API (\d+): (.+)/)
          if (match) {
            const parsed = JSON.parse(match[2])
            msg = parsed.error || msg
          }
        } catch {
          /* use raw */
        }
        Alert.alert('Error', msg)
        setSettingId(null)
      }
    },
    [router],
  )

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
          <View
            className="items-center justify-center rounded-lg mr-3"
            style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
          >
            <Plus size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Add Crew Base</Text>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>
              Select an airport to designate as crew base
            </Text>
          </View>
        </View>

        {/* Search */}
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
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading airports...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 12 }}>
            {error}
          </Text>
          <Pressable
            onPress={fetchAirports}
            className="flex-row items-center px-4 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}
          >
            <RefreshCw size={14} color={accent} strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={available}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <AirportPickerRow
              airport={item}
              palette={palette}
              accent={accent}
              isDark={isDark}
              loading={settingId === item._id}
              disabled={settingId !== null}
              onPress={() => handleSetAsBase(item)}
            />
          )}
          ListEmptyComponent={
            <View className="py-10 items-center px-8">
              <MapPin size={24} color={palette.textTertiary} strokeWidth={1.5} />
              <Text style={{ fontSize: 15, color: palette.textTertiary, textAlign: 'center', marginTop: 8 }}>
                {search ? 'No matching airports found' : 'All airports are already crew bases'}
              </Text>
            </View>
          }
          ListFooterComponent={
            available.length >= MAX_RESULTS ? (
              <View className="py-3 items-center">
                <Text style={{ fontSize: 13, color: palette.textTertiary }}>
                  Showing first {MAX_RESULTS} of {totalAvailable} airports. Use search to find specific ones.
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

const AirportPickerRow = memo(function AirportPickerRow({
  airport,
  palette,
  accent,
  isDark,
  loading,
  disabled,
  onPress,
}: {
  airport: AirportRef
  palette: Palette
  accent: string
  isDark: boolean
  loading: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <View
      className="flex-row items-center"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      {/* Codes */}
      <View style={{ width: 80 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
          {airport.iataCode ?? '\u2014'}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'monospace', color: palette.textTertiary }}>{airport.icaoCode}</Text>
      </View>

      {/* Name & location */}
      <View className="flex-1 mx-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {airport.name}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }} numberOfLines={1}>
          {[airport.city, airport.countryName ?? airport.country].filter(Boolean).join(', ')}
        </Text>
      </View>

      {/* Set as Base button */}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="items-center justify-center px-3 rounded-lg active:opacity-70"
        style={{
          minHeight: 44,
          backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08),
          opacity: disabled && !loading ? 0.4 : 1,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>{loading ? 'Setting...' : 'Set as Base'}</Text>
      </Pressable>
    </View>
  )
})
