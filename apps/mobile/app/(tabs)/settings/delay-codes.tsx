import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type DelayCodeRef } from '@skyhub/api'
import { Search, ChevronLeft, ChevronRight, Timer, Plus } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

const CATEGORY_COLORS: Record<string, string> = {
  'Airline Internal': '#6b7280',
  'Passenger & Baggage': '#3b82f6',
  'Cargo & Mail': '#10b981',
  'Aircraft Handling': '#f59e0b',
  Technical: '#ef4444',
  'Damage & EDP': '#e11d48',
  'Operations & Crew': '#8b5cf6',
  Weather: '#0ea5e9',
  'ATC & Airport': '#6366f1',
  'Reactionary & Misc': '#a855f7',
}
const CATEGORY_ORDER: Record<string, number> = {
  'Airline Internal': 0,
  'Passenger & Baggage': 1,
  'Cargo & Mail': 2,
  'Aircraft Handling': 3,
  Technical: 4,
  'Damage & EDP': 5,
  'Operations & Crew': 6,
  Weather: 7,
  'ATC & Airport': 8,
  'Reactionary & Misc': 9,
}

type ViewMode = 'legacy' | 'ahm732'
interface CodeSection {
  title: string
  color: string
  data: DelayCodeRef[]
}

export default function DelayCodesList() {
  const { palette, isDark, accent } = useAppTheme()
  const [codes, setCodes] = useState<DelayCodeRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('legacy')
  const router = useRouter()

  const fetchCodes = useCallback(() => {
    setLoading(true)
    api
      .getDelayCodes()
      .then(setCodes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchCodes()
    }, [fetchCodes]),
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
      ? codes.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.alphaCode?.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q),
        )
      : codes

    const map = new Map<string, DelayCodeRef[]>()
    for (const c of filtered) {
      const key = c.category || 'Unknown'
      const arr = map.get(key)
      if (arr) arr.push(c)
      else map.set(key, [c])
    }

    const sections: CodeSection[] = Array.from(map.entries())
      .sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99))
      .map(([title, data]) => {
        data.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        return { title, color: CATEGORY_COLORS[title] || '#6b7280', data }
      })

    return { sections, filteredCount: filtered.length }
  }, [codes, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="6" />
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
        <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
          <View className="flex-row items-center mb-3">
            <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
              <ChevronLeft size={24} color={accent} strokeWidth={2} />
            </Pressable>
            <View
              className="items-center justify-center rounded-lg mr-3"
              style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
            >
              <Timer size={18} color={accent} strokeWidth={1.8} />
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Delay Codes</Text>
              <Text style={{ fontSize: 13, color: palette.textSecondary }}>
                {filteredCount === codes.length ? `${codes.length} codes` : `${filteredCount} / ${codes.length} codes`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/settings/delay-code-add' as any)}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: accent, gap: 4 }}
            >
              <Plus size={16} color="#fff" strokeWidth={2} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>New</Text>
            </Pressable>
          </View>

          {/* AHM mode toggle */}
          <View
            className="flex-row rounded-lg overflow-hidden mb-3"
            style={{ borderWidth: 1, borderColor: palette.cardBorder }}
          >
            <Pressable
              onPress={() => setViewMode('legacy')}
              className="flex-1 items-center py-4"
              style={viewMode === 'legacy' ? { backgroundColor: accent } : undefined}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: viewMode === 'legacy' ? '#fff' : palette.textSecondary,
                }}
              >
                AHM 730/731
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('ahm732')}
              className="flex-1 items-center py-4"
              style={viewMode === 'ahm732' ? { backgroundColor: accent } : undefined}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: viewMode === 'ahm732' ? '#fff' : palette.textSecondary,
                }}
              >
                AHM 732
              </Text>
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
              placeholder="Search code, name, category..."
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
            <Timer size={40} color={palette.textTertiary} strokeWidth={1.2} />
            <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
              {codes.length === 0 ? 'No delay codes yet.\nTap + to create one.' : 'No results found.'}
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
              const catColor = (section as CodeSection).color
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
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor, marginRight: 6 }} />
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
              <CodeRow
                code={item}
                viewMode={viewMode}
                palette={palette}
                accent={accent}
                isDark={isDark}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/delay-code-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const CodeRow = memo(function CodeRow({
  code,
  viewMode,
  palette,
  accent,
  isDark,
  onPress,
}: {
  code: DelayCodeRef
  viewMode: ViewMode
  palette: Palette
  accent: string
  isDark: boolean
  onPress: () => void
}) {
  const catColor = CATEGORY_COLORS[code.category] || '#6b7280'
  const ahm732 =
    code.ahm732Process || code.ahm732Reason || code.ahm732Stakeholder
      ? `${code.ahm732Process || '—'}-${code.ahm732Reason || '—'}-${code.ahm732Stakeholder || '—'}`
      : null

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}
    >
      {viewMode === 'legacy' ? (
        <>
          <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 36 }}>
            {code.code}
          </Text>
          {code.alphaCode && (
            <View className="px-1.5 py-0.5 rounded mr-2" style={{ backgroundColor: `${catColor}20` }}>
              <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: 'monospace', color: catColor }}>
                {code.alphaCode}
              </Text>
            </View>
          )}
        </>
      ) : (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            fontFamily: 'monospace',
            color: ahm732 ? accent : palette.textTertiary,
            width: 60,
            marginRight: 10,
          }}
        >
          {ahm732 || '---'}
        </Text>
      )}
      <View style={{ flex: 1, marginLeft: viewMode === 'legacy' && !code.alphaCode ? 8 : 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {code.name}
        </Text>
        {code.description && (
          <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 3 }} numberOfLines={1}>
            {code.description}
          </Text>
        )}
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
