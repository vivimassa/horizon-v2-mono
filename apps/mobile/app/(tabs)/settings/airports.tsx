import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, SectionList, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import { ListScreenHeader, SearchInput, Text, Divider, EmptyState, domainIcons } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { SafeAreaView } from 'react-native-safe-area-context'

const PlaneTakeoff = domainIcons.takeoff
const ChevronRight = domainIcons.chevronRight

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
    api
      .getAirports()
      .then(setAirports)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchAirports()
    }, [fetchAirports]),
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
    const filtered = q
      ? airports.filter(
          (a) =>
            a.icaoCode.toLowerCase().includes(q) ||
            a.iataCode?.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.city?.toLowerCase().includes(q),
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
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12 }}>
          <ListScreenHeader
            icon={PlaneTakeoff}
            title="Airports"
            count={airports.length}
            filteredCount={filteredCount}
            countLabel="airport"
            onBack={() => router.back()}
            onAdd={() => router.push('/(tabs)/settings/airport-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search IATA, ICAO, name, city…" value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text variant="body" muted>
              Loading airports…
            </Text>
          </View>
        ) : sections.length === 0 ? (
          <EmptyState
            icon={PlaneTakeoff}
            title="No airports match your search"
            subtitle="Try a different code or city."
          />
        ) : (
          <SectionList
            sections={sections.map((s) => ({
              ...s,
              data: collapsed.has(s.title) ? [] : s.data,
            }))}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            stickySectionHeadersEnabled={false}
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
                    size={14}
                    color={palette.textTertiary}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <Text variant="sectionHeading" muted style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {section.title}
                  </Text>
                  <Text variant="secondary" muted style={{ marginLeft: 6 }}>
                    ({count})
                  </Text>
                  <View className="flex-1 ml-3">
                    <Divider />
                  </View>
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <AirportRow
                airport={item}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/airport-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const AirportRow = memo(function AirportRow({ airport, onPress }: { airport: AirportRef; onPress: () => void }) {
  const { palette, accent } = useAppTheme()
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
      <Text variant="body" color={accent} style={{ width: 44, fontWeight: '700', fontFamily: 'monospace' }}>
        {airport.iataCode ?? '—'}
      </Text>
      <View className="flex-1 ml-2">
        <Text variant="body" style={{ fontWeight: '500' }} numberOfLines={1}>
          {airport.name}
        </Text>
        <Text variant="secondary" muted style={{ marginTop: 1 }}>
          {airport.city}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Text variant="secondary" muted style={{ fontFamily: 'monospace' }}>
          {airport.icaoCode}
        </Text>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
