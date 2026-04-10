import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CrewPositionRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, UserRound, Plus, RefreshCw, Sparkles,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CATEGORY_LABELS: Record<string, string> = {
  cockpit: 'Flight Deck',
  cabin: 'Cabin Crew',
}
const CATEGORY_ORDER: Record<string, number> = { cockpit: 0, cabin: 1 }

interface CategorySection {
  title: string
  category: string
  data: CrewPositionRef[]
}

export default function CrewPositionsList() {
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const [positions, setPositions] = useState<CrewPositionRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchPositions = useCallback(() => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    api.getCrewPositions(operatorId, true)
      .then(setPositions)
      .catch((err: any) => setError(err.message || 'Failed to load crew positions'))
      .finally(() => setLoading(false))
  }, [operatorId])

  useFocusEffect(useCallback(() => { fetchPositions() }, [fetchPositions]))

  const toggleGroup = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }, [])

  const handleSeed = useCallback(async () => {
    setSeeding(true)
    try {
      await api.seedCrewPositions(operatorId)
      fetchPositions()
    } catch (err: any) {
      Alert.alert('Seed Failed', err.message || 'Could not seed default positions')
    } finally { setSeeding(false) }
  }, [operatorId, fetchPositions])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? positions.filter(p =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        )
      : positions

    const map = new Map<string, CrewPositionRef[]>()
    for (const p of filtered) {
      const arr = map.get(p.category)
      if (arr) arr.push(p)
      else map.set(p.category, [p])
    }

    const sections: CategorySection[] = Array.from(map.entries())
      .sort(([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99))
      .map(([category, data]) => {
        data.sort((a, b) => a.rankOrder - b.rankOrder)
        return { title: CATEGORY_LABELS[category] ?? category, category, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [positions, search])

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
            <UserRound size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Crew Positions</Text>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>
              {filteredCount === positions.length
                ? `${positions.length} position${positions.length !== 1 ? 's' : ''}`
                : `${filteredCount} / ${positions.length} positions`}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/settings/crew-position-add' as any)}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, gap: 4 }}
          >
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card,
          borderWidth: 1,
          borderColor: palette.cardBorder,
          paddingHorizontal: 12,
        }}>
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
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading crew positions...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
          <Pressable onPress={fetchPositions} className="flex-row items-center px-4 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}>
            <RefreshCw size={14} color={accent} strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Retry</Text>
          </Pressable>
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
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center px-8 pt-16">
              <View
                className="items-center justify-center rounded-full mb-4"
                style={{ width: 64, height: 64, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
              >
                <UserRound size={28} color={accent} strokeWidth={1.5} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}>
                No Crew Positions
              </Text>
              <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                Define cockpit and cabin crew roles for your operation.
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
                    {seeding ? 'Seeding...' : 'Seed Default Positions'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(tabs)/settings/crew-position-add' as any)}
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
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {section.title}
                </Text>
                <Text style={{ fontSize: 15, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
              </Pressable>
            )
          }}
          renderItem={({ item }) => (
            <PositionRow position={item} palette={palette} accent={accent} isDark={isDark}
              onPress={() => router.push({ pathname: '/(tabs)/settings/crew-position-detail' as any, params: { id: item._id } })} />
          )}
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const PositionRow = memo(function PositionRow({
  position, palette, accent, isDark, onPress,
}: {
  position: CrewPositionRef; palette: Palette; accent: string; isDark: boolean; onPress: () => void
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
        opacity: position.isActive ? 1 : 0.4,
      }}
    >
      {/* Color dot */}
      {position.color && (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: position.color, marginRight: 10 }} />
      )}
      {/* Code */}
      <Text
        style={{
          width: 40, fontSize: 15, fontWeight: '700',
          fontFamily: 'monospace', color: accent,
        }}
      >
        {position.code}
      </Text>
      {/* Name + rank */}
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {position.name}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {/* PIC badge */}
        {position.isPic && (
          <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#fbbf24' : '#92400e' }}>PIC</Text>
          </View>
        )}
        {/* Rank */}
        <Text style={{ fontSize: 13, color: palette.textTertiary, fontFamily: 'monospace' }}>
          #{position.rankOrder}
        </Text>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})
