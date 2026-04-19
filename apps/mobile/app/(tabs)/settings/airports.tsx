import { useState, useMemo, useCallback, memo } from 'react'
import { View, SectionList, Pressable, Text as RNText } from 'react-native'
import { useRouter } from 'expo-router'
import { useAirports, type AirportRef } from '@skyhub/api'
import { ListScreenHeader, SearchInput, Text, Divider, EmptyState, domainIcons } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useHubBack } from '../../../lib/use-hub-back'

const PlaneTakeoff = domainIcons.takeoff
const ChevronRight = domainIcons.chevronRight

interface CountrySection {
  title: string
  data: AirportRef[]
}

export default function AirportsList() {
  const { palette, isDark, accent } = useAppTheme()
  const { data: airports = [], isLoading: loading } = useAirports()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')

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
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={PlaneTakeoff}
            title="Airports"
            count={airports.length}
            filteredCount={filteredCount}
            countLabel="airport"
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
                    color={palette.textSecondary}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <RNText
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      color: palette.text,
                    }}
                  >
                    {section.title}
                  </RNText>
                  <RNText style={{ marginLeft: 6, fontSize: 12, fontWeight: '500', color: palette.textSecondary }}>
                    ({count})
                  </RNText>
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
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      {/* Using raw RN Text with palette colours — the shared `Text variant="body" muted`
         combo was rendering at ~35% opacity on dark mode which was unreadable. */}
      <RNText style={{ width: 48, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
        {airport.iataCode ?? '—'}
      </RNText>
      <View className="flex-1 ml-2">
        <RNText style={{ fontSize: 15, fontWeight: '600', color: palette.text }} numberOfLines={1}>
          {airport.name}
        </RNText>
        <RNText style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {airport.city}
        </RNText>
      </View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <RNText style={{ fontSize: 13, fontWeight: '500', fontFamily: 'monospace', color: palette.textSecondary }}>
          {airport.icaoCode}
        </RNText>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
