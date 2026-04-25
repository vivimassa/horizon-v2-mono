import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, SectionList, Pressable, Switch, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CrewHotelRef } from '@skyhub/api'
import { ChevronRight, BedDouble, Plus, RefreshCw } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { ListScreenHeader, SearchInput, Text } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useHubBack } from '../../../lib/use-hub-back'

interface AirportSection {
  title: string
  data: CrewHotelRef[]
}

export default function CrewHotelsList() {
  const { palette, isDark, accent } = useAppTheme()
  useHubBack('settings')
  const [hotels, setHotels] = useState<CrewHotelRef[]>([])
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchHotels = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .getCrewHotels()
      .then(setHotels)
      .catch((err: any) => setError(err.message || 'Failed to load crew hotels'))
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchHotels()
    }, [fetchHotels]),
  )

  const toggleGroup = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }, [])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    let filtered = hotels
    if (activeOnly) filtered = filtered.filter((h) => h.isActive)
    if (q) {
      filtered = filtered.filter(
        (h) =>
          h.hotelName.toLowerCase().includes(q) ||
          h.airportIcao.toLowerCase().includes(q) ||
          (h.addressLine1?.toLowerCase().includes(q) ?? false),
      )
    }

    const map = new Map<string, CrewHotelRef[]>()
    for (const h of filtered) {
      const arr = map.get(h.airportIcao)
      if (arr) arr.push(h)
      else map.set(h.airportIcao, [h])
    }

    const sections: AirportSection[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => {
        data.sort((a, b) => a.priority - b.priority || a.hotelName.localeCompare(b.hotelName))
        return { title, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [hotels, search, activeOnly])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={BedDouble}
            title="Crew Hotels"
            count={hotels.length}
            filteredCount={filteredCount}
            countLabel="hotel"
            onAdd={() => router.push('/(tabs)/settings/crew-hotel-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput
              placeholder="Search by hotel name, airport, address..."
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>Active only</Text>
            <Switch
              value={activeOnly}
              onValueChange={setActiveOnly}
              ios_backgroundColor={isDark ? 'rgba(120,120,128,0.32)' : 'rgba(120,120,128,0.16)'}
              trackColor={{ false: isDark ? '#3f3f46' : '#e5e7eb', true: '#34C759' }}
              thumbColor={Platform.OS === 'android' ? (activeOnly ? '#fff' : '#f4f3f4') : undefined}
            />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading crew hotels...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-8">
            <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 12 }}>
              {error}
            </Text>
            <Pressable
              onPress={fetchHotels}
              className="flex-row items-center px-4 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}
            >
              <RefreshCw size={14} color={accent} strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <SectionList
            sections={sections.map((s) => ({
              ...s,
              data: collapsed.has(s.title) ? [] : s.data,
            }))}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center px-8 pt-16">
                <View
                  className="items-center justify-center rounded-full mb-4"
                  style={{ width: 64, height: 64, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
                >
                  <BedDouble size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: palette.text,
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  No Crew Hotels Configured
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Add layover hotels per airport — contracts, rates, shuttle bus.
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/settings/crew-hotel-add' as any)}
                  className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-70"
                  style={{ backgroundColor: accent, gap: 6 }}
                >
                  <Plus size={16} color="#fff" strokeWidth={2} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add First Hotel</Text>
                </Pressable>
              </View>
            }
            renderSectionHeader={({ section }) => {
              const original = sections.find((s) => s.title === section.title)
              const count = original?.data.length ?? 0
              const isCollapsed = collapsed.has(section.title)

              return (
                <Pressable
                  className="flex-row items-center active:opacity-70"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  }}
                  onPress={() => toggleGroup(section.title)}
                >
                  <ChevronRight
                    size={12}
                    color={palette.textTertiary}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: palette.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      fontFamily: 'monospace',
                    }}
                  >
                    {section.title}
                  </Text>
                  <Text style={{ fontSize: 15, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                  <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <CrewHotelRow
                hotel={item}
                palette={palette}
                accent={accent}
                isDark={isDark}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/crew-hotel-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const CrewHotelRow = memo(function CrewHotelRow({
  hotel,
  palette,
  accent,
  isDark,
  onPress,
}: {
  hotel: CrewHotelRef
  palette: Palette
  accent: string
  isDark: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        opacity: hotel.isActive ? 1 : 0.55,
      }}
    >
      <View
        className="items-center justify-center rounded-md"
        style={{
          width: 32,
          height: 32,
          marginRight: 12,
          backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08),
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>{hotel.priority}</Text>
      </View>
      <View className="flex-1">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {hotel.hotelName}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }} numberOfLines={1}>
          {hotel.addressLine1 ?? '—'}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {!hotel.isActive && (
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.08)' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>OFF</Text>
          </View>
        )}
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
