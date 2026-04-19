import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, SectionList, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AirportRef } from '@skyhub/api'
import { ChevronRight, MapPin, Plus, Building2, RefreshCw } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { ListScreenHeader, SearchInput, Text, domainIcons } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useHubBack } from '../../../lib/use-hub-back'

const LocationIcon = domainIcons.location

interface CountrySection {
  title: string
  data: AirportRef[]
}

export default function CrewBasesList() {
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')
  const [bases, setBases] = useState<AirportRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchBases = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .getAirports({ crewBase: true })
      .then(setBases)
      .catch((err: any) => setError(err.message || 'Failed to load crew bases'))
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchBases()
    }, [fetchBases]),
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
      ? bases.filter(
          (a) =>
            a.icaoCode.toLowerCase().includes(q) ||
            a.iataCode?.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.city?.toLowerCase().includes(q) ||
            a.countryName?.toLowerCase().includes(q),
        )
      : bases

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
  }, [bases, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={LocationIcon}
            title="Crew Bases"
            count={bases.length}
            filteredCount={filteredCount}
            countLabel="base"
            onAdd={() => router.push('/(tabs)/settings/crew-base-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput
              placeholder="Search IATA, ICAO, name, city, country..."
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading crew bases...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-8">
            <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 12 }}>
              {error}
            </Text>
            <Pressable
              onPress={fetchBases}
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
                  <MapPin size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}
                >
                  No Crew Bases Configured
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Designate airports as crew bases to manage reporting times and facilities.
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/settings/crew-base-add' as any)}
                  className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-70"
                  style={{ backgroundColor: accent, gap: 6 }}
                >
                  <Plus size={16} color="#fff" strokeWidth={2} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add First Base</Text>
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
              <CrewBaseRow
                base={item}
                palette={palette}
                accent={accent}
                isDark={isDark}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/crew-base-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const CrewBaseRow = memo(function CrewBaseRow({
  base,
  palette,
  accent,
  isDark,
  onPress,
}: {
  base: AirportRef
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
      }}
    >
      <Text
        style={{
          width: 44,
          fontSize: 15,
          fontWeight: '700',
          fontFamily: 'monospace',
          color: accent,
        }}
      >
        {base.iataCode ?? '\u2014'}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {base.name}
        </Text>
        <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 1 }}>{base.city}</Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {base.hasCrewFacilities && <Building2 size={14} color={isDark ? '#4ade80' : '#16a34a'} strokeWidth={1.8} />}
        <Text style={{ fontSize: 15, fontFamily: 'monospace', color: palette.textTertiary }}>{base.icaoCode}</Text>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
