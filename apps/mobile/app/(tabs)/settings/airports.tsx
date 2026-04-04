import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, PlaneTakeoff, Plus,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

interface CountrySection {
  title: string
  data: AirportRef[]
}

export default function AirportsList() {
  const { palette, isDark, accent } = useAppTheme()
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchAirports = useCallback(() => {
    setLoading(true)
    api.getAirports()
      .then(setAirports)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Fetch airports on mount and when screen regains focus (after detail/add)
  useFocusEffect(useCallback(() => { fetchAirports() }, [fetchAirports]))

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
    const filtered = q
      ? airports.filter(a =>
          a.icaoCode.toLowerCase().includes(q) ||
          (a.iataCode?.toLowerCase().includes(q)) ||
          a.name.toLowerCase().includes(q) ||
          (a.city?.toLowerCase().includes(q))
        )
      : airports

    const map = new Map<string, AirportRef[]>()
    for (const a of filtered) {
      const key = a.countryName ?? a.country ?? 'Unknown'
      const arr = map.get(key)
      if (arr) arr.push(a)
      else map.set(key, [a])
    }

    const sections: CountrySection[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => {
        data.sort((a, b) => (a.iataCode ?? '').localeCompare(b.iataCode ?? ''))
        return { title, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [airports, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
    <BreadcrumbHeader moduleCode="6" />
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
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
            <PlaneTakeoff size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Airports</Text>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>
              {filteredCount === airports.length
                ? `${airports.length} airports`
                : `${filteredCount} / ${airports.length} airports`}
            </Text>
          </View>
          {/* + New button */}
          <Pressable
            onPress={() => router.push('/(tabs)/settings/airport-add' as any)}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, gap: 4 }}
          >
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>New</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          paddingHorizontal: 12,
        }}>
          <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput
            className="flex-1 py-2.5 ml-2"
            style={{ fontSize: 15, color: palette.text }}
            placeholder="Search IATA, ICAO, name, city…"
            placeholderTextColor={palette.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading airports…</Text>
        </View>
      ) : (
        <SectionList
          sections={sections.map(s => ({
            ...s,
            data: collapsed.has(s.title) ? [] : s.data,
          }))}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const original = sections.find(s => s.title === section.title)
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
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {section.title}
                </Text>
                <Text style={{ fontSize: 15, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
              </Pressable>
            )
          }}
          renderItem={({ item }) => (
            <AirportRow airport={item} palette={palette} accent={accent} isDark={isDark}
              onPress={() => router.push({ pathname: '/(tabs)/settings/airport-detail' as any, params: { id: item._id } })} />
          )}
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const AirportRow = memo(function AirportRow({
  airport, palette, accent, isDark, onPress,
}: {
  airport: AirportRef; palette: Palette; accent: string; isDark: boolean; onPress: () => void
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
      }}
    >
      <Text
        style={{
          width: 44, fontSize: 15, fontWeight: '700',
          fontFamily: 'monospace', color: accent,
        }}
      >
        {airport.iataCode ?? '—'}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {airport.name}
        </Text>
        <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 1 }}>
          {airport.city}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontFamily: 'monospace', color: palette.textTertiary }}>
          {airport.icaoCode}
        </Text>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
