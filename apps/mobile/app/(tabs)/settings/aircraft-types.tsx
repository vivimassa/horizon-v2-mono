import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AircraftTypeRef } from '@skyhub/api'
import { Search, ChevronLeft, ChevronRight, Plane, Plus } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

const CATEGORY_ORDER: Record<string, number> = {
  narrow_body: 0,
  wide_body: 1,
  regional: 2,
  turboprop: 3,
}
const CATEGORY_LABELS: Record<string, string> = {
  narrow_body: 'Narrow Body',
  wide_body: 'Wide Body',
  regional: 'Regional',
  turboprop: 'Turboprop',
}

interface TypeSection {
  title: string
  data: AircraftTypeRef[]
}

export default function AircraftTypesList() {
  const { palette, isDark, accent } = useAppTheme()
  const [types, setTypes] = useState<AircraftTypeRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchTypes = useCallback(() => {
    setLoading(true)
    api
      .getAircraftTypes()
      .then(setTypes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchTypes()
    }, [fetchTypes]),
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
      ? types.filter(
          (t) =>
            t.icaoType.toLowerCase().includes(q) ||
            t.iataType?.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.family?.toLowerCase().includes(q) ||
            t.manufacturer?.toLowerCase().includes(q),
        )
      : types

    const map = new Map<string, AircraftTypeRef[]>()
    for (const t of filtered) {
      const key = t.category || 'unknown'
      const arr = map.get(key)
      if (arr) arr.push(t)
      else map.set(key, [t])
    }

    const sections: TypeSection[] = Array.from(map.entries())
      .sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99))
      .map(([key, data]) => {
        data.sort((a, b) => a.icaoType.localeCompare(b.icaoType))
        return { title: CATEGORY_LABELS[key] || key, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [types, search])

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
              <Plane size={18} color={accent} strokeWidth={1.8} />
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Aircraft Types</Text>
              <Text style={{ fontSize: 13, color: palette.textSecondary }}>
                {filteredCount === types.length ? `${types.length} types` : `${filteredCount} / ${types.length} types`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/settings/aircraft-type-add' as any)}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: accent, gap: 4 }}
            >
              <Plus size={16} color="#fff" strokeWidth={2} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>New</Text>
            </Pressable>
          </View>

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
              placeholder="Search ICAO, name, manufacturer..."
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
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading...</Text>
          </View>
        ) : sections.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8">
            <Plane size={40} color={palette.textTertiary} strokeWidth={1.2} />
            <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
              {types.length === 0 ? 'No aircraft types yet.\nTap + to create one.' : 'No results found.'}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections.map((s) => ({ ...s, data: collapsed.has(s.title) ? [] : s.data }))}
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
                    size={12}
                    color={palette.textTertiary}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <Plane size={14} color={palette.textTertiary} strokeWidth={1.8} style={{ marginRight: 6 }} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: palette.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {section.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                  <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <TypeRow
                type={item}
                palette={palette}
                accent={accent}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/aircraft-type-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const TypeRow = memo(function TypeRow({
  type,
  palette,
  accent,
  onPress,
}: {
  type: AircraftTypeRef
  palette: Palette
  accent: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}
    >
      <Text style={{ width: 48, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
        {type.icaoType}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {type.name}
        </Text>
        {type.manufacturer && (
          <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }}>{type.manufacturer}</Text>
        )}
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
