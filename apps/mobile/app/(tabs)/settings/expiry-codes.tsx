import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type ExpiryCodeRef, type ExpiryCodeCategoryRef } from '@skyhub/api'
import { ChevronRight, FileCheck, Plus, RefreshCw } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { ListScreenHeader, SearchInput } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { useHubBack } from '../../../lib/use-hub-back'
import { EXPIRY_FORMULAS } from '@skyhub/logic'

const CREW_CAT_LABELS: Record<string, string> = { both: 'All', cockpit: 'FD', cabin: 'CC' }

interface CategorySection {
  title: string
  color: string
  data: ExpiryCodeRef[]
}

export default function ExpiryCodesList() {
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')
  const operatorId = useOperatorId()
  const [codes, setCodes] = useState<ExpiryCodeRef[]>([])
  const [categories, setCategories] = useState<ExpiryCodeCategoryRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchData = useCallback(() => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    Promise.all([api.getExpiryCodes(operatorId, true), api.getExpiryCodeCategories(operatorId)])
      .then(([c, cats]) => {
        setCodes(c)
        setCategories(cats)
      })
      .catch((err: any) => setError(err.message || 'Failed to load expiry codes'))
      .finally(() => setLoading(false))
  }, [operatorId])

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [fetchData]),
  )

  const toggleGroup = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }, [])

  const catMap = useMemo(() => {
    const m = new Map<string, ExpiryCodeCategoryRef>()
    for (const c of categories) m.set(c._id, c)
    return m
  }, [categories])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? codes.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.crewCategory.toLowerCase().includes(q) ||
            c.formula.toLowerCase().includes(q),
        )
      : codes

    const map = new Map<string, ExpiryCodeRef[]>()
    for (const c of filtered) {
      const arr = map.get(c.categoryId)
      if (arr) arr.push(c)
      else map.set(c.categoryId, [c])
    }

    const sections: CategorySection[] = Array.from(map.entries())
      .sort(([a], [b]) => (catMap.get(a)?.sortOrder ?? 99) - (catMap.get(b)?.sortOrder ?? 99))
      .map(([catId, data]) => {
        const cat = catMap.get(catId)
        data.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
        return { title: cat?.label ?? 'Uncategorized', color: cat?.color ?? accent, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [codes, search, catMap, accent])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={FileCheck}
            title="Expiry Codes"
            count={codes.length}
            filteredCount={filteredCount}
            countLabel="code"
            onAdd={() => router.push('/(tabs)/settings/expiry-code-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search code, name, formula..." value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading expiry codes...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center px-8">
            <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 12 }}>
              {error}
            </Text>
            <Pressable
              onPress={fetchData}
              className="flex-row items-center px-4 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}
            >
              <RefreshCw size={14} color={accent} strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <SectionList
            sections={sections.map((s) => ({ ...s, data: collapsed.has(s.title) ? [] : s.data }))}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center px-8 pt-16">
                <View
                  className="items-center justify-center rounded-full mb-4"
                  style={{ width: 64, height: 64, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
                >
                  <FileCheck size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}
                >
                  No Expiry Codes
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Define qualification validity rules and formulas for crew tracking.
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/settings/expiry-code-add' as any)}
                  className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-70"
                  style={{ backgroundColor: accent, gap: 6 }}
                >
                  <Plus size={16} color="#fff" strokeWidth={2} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add Expiry Code</Text>
                </Pressable>
              </View>
            }
            renderSectionHeader={({ section }) => {
              const s = section as CategorySection
              const original = sections.find((sec) => sec.title === s.title)
              const count = original?.data.length ?? 0
              const isCollapsed = collapsed.has(s.title)
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
                  onPress={() => toggleGroup(s.title)}
                >
                  <ChevronRight
                    size={12}
                    color={palette.textTertiary}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color, marginRight: 8 }} />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: palette.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {s.title}
                  </Text>
                  <Text style={{ fontSize: 15, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                  <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <ExpiryCodeRow
                code={item}
                palette={palette}
                accent={accent}
                isDark={isDark}
                catColor={catMap.get(item.categoryId)?.color ?? accent}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/expiry-code-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const ExpiryCodeRow = memo(function ExpiryCodeRow({
  code,
  palette,
  accent,
  isDark,
  catColor,
  onPress,
}: {
  code: ExpiryCodeRef
  palette: Palette
  accent: string
  isDark: boolean
  catColor: string
  onPress: () => void
}) {
  const formulaDef = EXPIRY_FORMULAS.find((f) => f.id === code.formula)
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        opacity: code.isActive ? 1 : 0.4,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor, marginRight: 10 }} />
      <Text style={{ width: 50, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
        {code.code}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {code.name}
        </Text>
        <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 1 }}>
          {formulaDef?.label ?? code.formula}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <View
          className="px-1.5 py-0.5 rounded"
          style={{
            backgroundColor:
              code.crewCategory === 'cockpit'
                ? isDark
                  ? 'rgba(59,130,246,0.15)'
                  : '#eff6ff'
                : code.crewCategory === 'cabin'
                  ? isDark
                    ? 'rgba(139,92,246,0.15)'
                    : '#f5f3ff'
                  : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : '#f3f4f6',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color:
                code.crewCategory === 'cockpit'
                  ? isDark
                    ? '#93c5fd'
                    : '#1d4ed8'
                  : code.crewCategory === 'cabin'
                    ? isDark
                      ? '#c4b5fd'
                      : '#6d28d9'
                    : palette.textSecondary,
            }}
          >
            {CREW_CAT_LABELS[code.crewCategory] ?? 'All'}
          </Text>
        </View>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
