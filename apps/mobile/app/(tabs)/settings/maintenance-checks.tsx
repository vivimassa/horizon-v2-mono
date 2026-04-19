import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, SectionList, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type MaintenanceCheckTypeRef, type AircraftTypeRef } from '@skyhub/api'
import { ChevronRight, ClipboardCheck, Plus, RefreshCw } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { ListScreenHeader, SearchInput, Text } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { useHubBack } from '../../../lib/use-hub-back'

const CATEGORY_ORDER: Record<string, number> = {
  line: 0,
  'a-check': 1,
  'c-check': 2,
  structural: 3,
  component: 4,
  'type-specific': 5,
}

const CATEGORY_LABELS: Record<string, string> = {
  line: 'Line Maintenance',
  'a-check': 'A-Checks',
  'c-check': 'C-Checks',
  structural: 'Structural',
  component: 'Component',
  'type-specific': 'Type-Specific',
}

function categorize(ct: MaintenanceCheckTypeRef): string {
  const code = ct.code.toUpperCase()
  if (['TR', 'DY', 'WK'].includes(code)) return 'line'
  if (code.endsWith('A') || code.startsWith('1A') || code.startsWith('2A') || code.startsWith('4A')) return 'a-check'
  if (code.endsWith('C') || code.startsWith('1C') || code.startsWith('2C') || code.startsWith('4C')) return 'c-check'
  if (['6Y', '12Y'].includes(code)) return 'structural'
  if (['LG', 'ENG', 'EWW', 'BSI', 'APU'].includes(code)) return 'component'
  if (ct.applicableAircraftTypeIds.length > 0) return 'type-specific'
  return 'component'
}

interface CheckSection {
  title: string
  data: MaintenanceCheckTypeRef[]
}

export default function MaintenanceChecksList() {
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')
  const operatorId = useOperatorId()
  const [checks, setChecks] = useState<MaintenanceCheckTypeRef[]>([])
  const [acTypes, setAcTypes] = useState<AircraftTypeRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const acTypeMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of acTypes) m.set(t._id, t.icaoType)
    return m
  }, [acTypes])

  const fetchData = useCallback(() => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    Promise.all([api.getMaintenanceCheckTypes(operatorId), api.getAircraftTypes(operatorId)])
      .then(([c, t]) => {
        setChecks(c)
        setAcTypes(t)
      })
      .catch((err: any) => setError(err.message || 'Failed to load maintenance checks'))
      .finally(() => setLoading(false))
  }, [operatorId])

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [fetchData]),
  )

  const toggleGroup = useCallback((title: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev)
      n.has(title) ? n.delete(title) : n.add(title)
      return n
    })
  }, [])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? checks.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q),
        )
      : checks

    const map = new Map<string, MaintenanceCheckTypeRef[]>()
    for (const c of filtered) {
      const cat = categorize(c)
      const arr = map.get(cat)
      if (arr) arr.push(c)
      else map.set(cat, [c])
    }

    const sections: CheckSection[] = Array.from(map.entries())
      .sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99))
      .map(([key, data]) => {
        data.sort((a, b) => a.sortOrder - b.sortOrder)
        return { title: CATEGORY_LABELS[key] || key, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [checks, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={ClipboardCheck}
            title="Maintenance Checks"
            count={checks.length}
            filteredCount={filteredCount}
            countLabel="check"
            onAdd={() => router.push('/(tabs)/settings/maintenance-check-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search code, name..." value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading maintenance checks...</Text>
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
                  <ClipboardCheck size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}
                >
                  No Maintenance Checks
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Define check types, frequency thresholds, and maintenance windows for your fleet.
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/settings/maintenance-check-add' as any)}
                  className="flex-row items-center justify-center px-4 py-2.5 rounded-lg active:opacity-70"
                  style={{ backgroundColor: accent, gap: 6 }}
                >
                  <Plus size={16} color="#fff" strokeWidth={2} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add Check Type</Text>
                </Pressable>
              </View>
            }
            renderSectionHeader={({ section }) => {
              const s = section as CheckSection
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
                  <ClipboardCheck size={14} color={palette.textTertiary} strokeWidth={1.8} style={{ marginRight: 6 }} />
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
              <CheckTypeRow
                check={item}
                palette={palette}
                accent={accent}
                acTypeMap={acTypeMap}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/settings/maintenance-check-detail' as any,
                    params: { id: item._id },
                  })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const CheckTypeRow = memo(function CheckTypeRow({
  check,
  palette,
  accent,
  acTypeMap,
  onPress,
}: {
  check: MaintenanceCheckTypeRef
  palette: Palette
  accent: string
  acTypeMap: Map<string, string>
  onPress: () => void
}) {
  const intervalParts = [
    check.defaultHoursInterval ? `${check.defaultHoursInterval}h` : null,
    check.defaultCyclesInterval ? `${check.defaultCyclesInterval}cyc` : null,
    check.defaultDaysInterval ? `${check.defaultDaysInterval}d` : null,
  ].filter(Boolean)

  const acTypeNames =
    check.applicableAircraftTypeIds.length > 0
      ? check.applicableAircraftTypeIds.map((id) => acTypeMap.get(id) ?? '?').join(', ')
      : null

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        opacity: check.isActive ? 1 : 0.4,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: check.color ?? accent, marginRight: 10 }} />
      <Text style={{ width: 50, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
        {check.code}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {check.name}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textTertiary, marginTop: 1 }} numberOfLines={1}>
          {intervalParts.length > 0 ? intervalParts.join(' / ') : 'No thresholds'}
          {check.requiresGrounding ? ' - Grounding' : ''}
          {acTypeNames ? ` - ${acTypeNames}` : ''}
        </Text>
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
