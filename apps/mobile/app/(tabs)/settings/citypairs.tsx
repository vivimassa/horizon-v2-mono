import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CityPairRef } from '@skyhub/api'
import { Search, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

const ROUTE_TYPE_ORDER: Record<string, number> = {
  domestic: 0,
  regional: 1,
  international: 2,
  'long-haul': 3,
  'ultra-long-haul': 4,
  unknown: 5,
}

const ROUTE_TYPE_LABELS: Record<string, string> = {
  domestic: 'Domestic',
  regional: 'Regional',
  international: 'International',
  'long-haul': 'Long-Haul',
  'ultra-long-haul': 'Ultra Long-Haul',
  unknown: 'Unclassified',
}

interface RouteSection {
  title: string
  data: CityPairRef[]
}

export default function CityPairsList() {
  const { palette, isDark, accent } = useAppTheme()
  const [cityPairs, setCityPairs] = useState<CityPairRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchCityPairs = useCallback(() => {
    setLoading(true)
    api
      .getCityPairs()
      .then(setCityPairs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchCityPairs()
    }, [fetchCityPairs]),
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
      ? cityPairs.filter(
          (cp) =>
            cp.station1Icao.toLowerCase().includes(q) ||
            cp.station1Iata?.toLowerCase().includes(q) ||
            cp.station1City?.toLowerCase().includes(q) ||
            cp.station2Icao.toLowerCase().includes(q) ||
            cp.station2Iata?.toLowerCase().includes(q) ||
            cp.station2City?.toLowerCase().includes(q) ||
            cp.routeType.toLowerCase().includes(q),
        )
      : cityPairs

    const map = new Map<string, CityPairRef[]>()
    for (const cp of filtered) {
      const key = cp.routeType
      const arr = map.get(key)
      if (arr) arr.push(cp)
      else map.set(key, [cp])
    }

    const sections: RouteSection[] = Array.from(map.entries())
      .sort(([a], [b]) => (ROUTE_TYPE_ORDER[a] ?? 99) - (ROUTE_TYPE_ORDER[b] ?? 99))
      .map(([title, data]) => ({ title, data }))

    return { sections, filteredCount: filtered.length }
  }, [cityPairs, search])

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
              <ArrowLeftRight size={18} color={accent} strokeWidth={1.8} />
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Citypairs</Text>
              <Text style={{ fontSize: 13, color: palette.textSecondary }}>
                {filteredCount === cityPairs.length
                  ? `${cityPairs.length} citypairs`
                  : `${filteredCount} / ${cityPairs.length} citypairs`}
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
              style={{ fontSize: 14, color: palette.text }}
              placeholder="Search IATA, ICAO, city, route type…"
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
            <Text style={{ fontSize: 14, color: palette.textTertiary }}>Loading citypairs…</Text>
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
                    size={13}
                    color={palette.textTertiary}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: palette.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {ROUTE_TYPE_LABELS[section.title] ?? section.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                  <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <CityPairRow
                cp={item}
                palette={palette}
                accent={accent}
                isDark={isDark}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/citypair-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const CityPairRow = memo(function CityPairRow({
  cp,
  palette,
  accent,
  isDark,
  onPress,
}: {
  cp: CityPairRef
  palette: Palette
  accent: string
  isDark: boolean
  onPress: () => void
}) {
  const label1 = cp.station1Iata || cp.station1Icao
  const label2 = cp.station2Iata || cp.station2Icao
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
      <View className="flex-row items-center" style={{ width: 120, gap: 4, marginRight: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: accent }}>{label1}</Text>
        <Text style={{ fontSize: 13, color: palette.textTertiary }}>↔</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: accent }}>{label2}</Text>
      </View>
      <View className="flex-1">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {cp.station1City ?? cp.station1Name} – {cp.station2City ?? cp.station2Name}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
          {cp.station1Icao} – {cp.station2Icao}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {cp.distanceNm != null && (
          <Text style={{ fontSize: 13, color: palette.textTertiary }}>{cp.distanceNm.toLocaleString()} nm</Text>
        )}
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
