import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type ActivityCodeRef, type ActivityCodeGroupRef } from '@skyhub/api'
import { Search, ChevronLeft, ChevronRight, Tag, Plus, RefreshCw, Sparkles, Lock } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'

interface GroupSection {
  title: string
  groupId: string
  color: string
  data: ActivityCodeRef[]
}

export default function ActivityCodesList() {
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const [codes, setCodes] = useState<ActivityCodeRef[]>([])
  const [groups, setGroups] = useState<ActivityCodeGroupRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchData = useCallback(() => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    Promise.all([api.getActivityCodes(operatorId), api.getActivityCodeGroups(operatorId)])
      .then(([c, g]) => {
        setCodes(c)
        setGroups(g)
      })
      .catch((err: any) => setError(err.message || 'Failed to load activity codes'))
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

  const handleSeed = useCallback(async () => {
    setSeeding(true)
    try {
      await api.seedActivityCodeDefaults(operatorId)
      fetchData()
    } catch (err: any) {
      Alert.alert('Seed Failed', err.message || 'Could not seed defaults')
    } finally {
      setSeeding(false)
    }
  }, [operatorId, fetchData])

  const groupMap = useMemo(() => {
    const m = new Map<string, ActivityCodeGroupRef>()
    for (const g of groups) m.set(g._id, g)
    return m
  }, [groups])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? codes.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q),
        )
      : codes

    const map = new Map<string, ActivityCodeRef[]>()
    for (const c of filtered) {
      const arr = map.get(c.groupId)
      if (arr) arr.push(c)
      else map.set(c.groupId, [c])
    }

    const sections: GroupSection[] = Array.from(map.entries())
      .sort(([a], [b]) => (groupMap.get(a)?.sortOrder ?? 99) - (groupMap.get(b)?.sortOrder ?? 99))
      .map(([gid, data]) => {
        const g = groupMap.get(gid)
        data.sort((a, b) => a.code.localeCompare(b.code))
        return { title: g?.name ?? 'Unknown', groupId: gid, color: g?.color ?? accent, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [codes, search, groupMap, accent])

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
              <Tag size={18} color={accent} strokeWidth={1.8} />
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Activity Codes</Text>
              <Text style={{ fontSize: 15, color: palette.textSecondary }}>
                {filteredCount === codes.length
                  ? `${codes.length} code${codes.length !== 1 ? 's' : ''}`
                  : `${filteredCount} / ${codes.length} codes`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/settings/activity-code-add' as any)}
              className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: accent, gap: 4 }}
            >
              <Plus size={16} color="#fff" strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add</Text>
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
              placeholder="Search code, name..."
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
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading activity codes...</Text>
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
                  <Tag size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}
                >
                  No Activity Codes
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Define duty, standby, training & leave codes for crew rostering.
                </Text>
                <View style={{ gap: 10 }}>
                  <Pressable
                    onPress={handleSeed}
                    disabled={seeding}
                    className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: accent, gap: 6, opacity: seeding ? 0.5 : 1 }}
                  >
                    <Sparkles size={16} color="#fff" strokeWidth={2} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                      {seeding ? 'Seeding...' : 'Load Default Codes'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/(tabs)/settings/activity-code-add' as any)}
                    className="flex-row items-center justify-center px-4 py-2.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}
                  >
                    <Plus size={16} color={accent} strokeWidth={2} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Add Manually</Text>
                  </Pressable>
                </View>
              </View>
            }
            renderSectionHeader={({ section }) => {
              const s = section as GroupSection
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
              <ActivityCodeRow
                code={item}
                palette={palette}
                accent={accent}
                isDark={isDark}
                groupColor={groupMap.get(item.groupId)?.color ?? accent}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/settings/activity-code-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const ActivityCodeRow = memo(function ActivityCodeRow({
  code,
  palette,
  accent,
  isDark,
  groupColor,
  onPress,
}: {
  code: ActivityCodeRef
  palette: Palette
  accent: string
  isDark: boolean
  groupColor: string
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
        opacity: code.isActive ? 1 : 0.4,
      }}
    >
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: code.color ?? groupColor, marginRight: 10 }}
      />
      <Text style={{ width: 50, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>
        {code.code}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {code.name}
        </Text>
        {code.description && (
          <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 1 }} numberOfLines={1}>
            {code.description}
          </Text>
        )}
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {code.isSystem && <Lock size={12} color={palette.textTertiary} strokeWidth={2} />}
        {code.isArchived && (
          <View
            className="px-1.5 py-0.5 rounded"
            style={{ backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7' }}
          >
            <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#fbbf24' : '#92400e' }}>Archived</Text>
          </View>
        )}
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
