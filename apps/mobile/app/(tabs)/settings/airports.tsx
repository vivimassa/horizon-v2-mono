import { useEffect, useState, useMemo, useCallback, memo } from 'react'
import { Text, View, SectionList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, setApiBaseUrl, type AirportRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, PlaneTakeoff,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'

setApiBaseUrl('http://192.168.1.101:3002')

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

  useEffect(() => {
    api.getAirports()
      .then(setAirports)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <ChevronLeft size={22} color={accent} strokeWidth={2} />
          </Pressable>
          <View
            className="items-center justify-center rounded-lg mr-3"
            style={{ width: 32, height: 32, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
          >
            <PlaneTakeoff size={16} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Airports Database</Text>
            <Text style={{ fontSize: 12, color: palette.textSecondary }}>
              {filteredCount === airports.length
                ? `${airports.length} airports`
                : `${filteredCount} / ${airports.length} airports`}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          paddingHorizontal: 12,
        }}>
          <Search size={14} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput
            className="flex-1 py-2.5 ml-2"
            style={{ fontSize: 13, color: palette.text }}
            placeholder="Search IATA, ICAO, name, city\u2026"
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
          <Text style={{ fontSize: 13, color: palette.textTertiary }}>Loading airports\u2026</Text>
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
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {section.title}
                </Text>
                <Text style={{ fontSize: 12, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
              </Pressable>
            )
          }}
          renderItem={({ item }) => (
            <AirportRow airport={item} palette={palette} accent={accent} isDark={isDark} />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const AirportRow = memo(function AirportRow({
  airport,
  palette,
  accent,
  isDark,
}: {
  airport: AirportRef
  palette: Palette
  accent: string
  isDark: boolean
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
      <Text
        style={{
          width: 40,
          fontSize: 13,
          fontWeight: '700',
          fontFamily: 'monospace',
          color: accent,
        }}
      >
        {airport.iataCode ?? '\u2014'}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {airport.name}
        </Text>
        <Text style={{ fontSize: 12, color: palette.textSecondary, marginTop: 1 }}>
          {airport.city}
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: 'monospace', color: palette.textTertiary }}>
        {airport.icaoCode}
      </Text>
    </View>
  )
})
