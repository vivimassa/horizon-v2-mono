import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, FlatList, TextInput, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type DutyPatternRef } from '@skyhub/api'
import { Search, ChevronLeft, ChevronDown, Timer, Plus, RefreshCw, Sparkles, Pencil } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'

const ON_COLOR = '#06C270'
const OFF_COLOR = '#FF5C5C'

export default function DutyPatternsList() {
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const [patterns, setPatterns] = useState<DutyPatternRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchData = useCallback(() => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    api
      .getDutyPatterns(operatorId)
      .then((list) => {
        setPatterns(list)
        setExpanded(new Set(list.map((p) => p._id)))
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [operatorId])

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [fetchData]),
  )

  const handleSeed = useCallback(async () => {
    setSeeding(true)
    try {
      await api.seedDutyPatterns(operatorId)
      fetchData()
    } catch (err: any) {
      Alert.alert('Seed Failed', err.message || 'Could not seed defaults')
    } finally {
      setSeeding(false)
    }
  }, [operatorId, fetchData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return patterns
    return patterns.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.offCode.toLowerCase().includes(q),
    )
  }, [patterns, search])

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
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Off/Duty Patterns</Text>
              <Text style={{ fontSize: 15, color: palette.textSecondary }}>
                {filtered.length === patterns.length
                  ? `${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}`
                  : `${filtered.length} / ${patterns.length} patterns`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/settings/duty-pattern-add' as any)}
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
              placeholder="Search code, description..."
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
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading duty patterns...</Text>
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
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center px-8 pt-16">
                <View
                  className="items-center justify-center rounded-full mb-4"
                  style={{ width: 64, height: 64, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}
                >
                  <Timer size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}
                >
                  No Duty Patterns
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Define ON/OFF rotation patterns for crew rostering.
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
                      {seeding ? 'Seeding...' : 'Load Default Patterns'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/(tabs)/settings/duty-pattern-add' as any)}
                    className="flex-row items-center justify-center px-4 py-2.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}
                  >
                    <Plus size={16} color={accent} strokeWidth={2} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Add Manually</Text>
                  </Pressable>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <PatternAccordion
                pattern={item}
                palette={palette}
                accent={accent}
                isDark={isDark}
                isExpanded={expanded.has(item._id)}
                onToggle={() =>
                  setExpanded((prev) => {
                    const n = new Set(prev)
                    n.has(item._id) ? n.delete(item._id) : n.add(item._id)
                    return n
                  })
                }
                onEdit={() =>
                  router.push({ pathname: '/(tabs)/settings/duty-pattern-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const PatternAccordion = memo(function PatternAccordion({
  pattern,
  palette,
  accent,
  isDark,
  isExpanded,
  onToggle,
  onEdit,
}: {
  pattern: DutyPatternRef
  palette: Palette
  accent: string
  isDark: boolean
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const onDays = pattern.sequence.filter((_, i) => i % 2 === 0).reduce((s, n) => s + n, 0)
  const offDays = pattern.cycleDays - onDays
  const ratio = pattern.cycleDays > 0 ? Math.round((onDays / pattern.cycleDays) * 100) : 0

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, opacity: pattern.isActive ? 1 : 0.4 }}>
      {/* Header */}
      <Pressable
        onPress={onToggle}
        className="flex-row items-center active:opacity-70"
        style={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        <ChevronDown
          size={14}
          color={palette.textTertiary}
          strokeWidth={2}
          style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }], marginRight: 8 }}
        />
        <Text style={{ fontSize: 18, fontWeight: '700', fontFamily: 'monospace', color: accent, marginRight: 10 }}>
          {pattern.code}
        </Text>
        {/* Segment bar */}
        <View className="flex-row flex-1 rounded overflow-hidden" style={{ height: 8 }}>
          {pattern.sequence.map((days, i) => (
            <View
              key={i}
              style={{
                flex: days,
                backgroundColor: i % 2 === 0 ? ON_COLOR : OFF_COLOR,
                opacity: i % 2 === 0 ? 0.7 : 0.35,
              }}
            />
          ))}
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: palette.textSecondary, marginLeft: 10 }}>
          {pattern.cycleDays}d
        </Text>
      </Pressable>

      {/* Expanded */}
      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View
            className="rounded-lg p-3"
            style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder }}
          >
            {/* Description */}
            {pattern.description && (
              <Text style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 8 }}>{pattern.description}</Text>
            )}

            {/* Sequence visual */}
            <View className="flex-row flex-wrap mb-3" style={{ gap: 4 }}>
              {pattern.sequence.map((days, i) => (
                <View
                  key={i}
                  className="flex-row items-center px-2 py-1 rounded"
                  style={{
                    backgroundColor: i % 2 === 0 ? `${ON_COLOR}20` : `${OFF_COLOR}20`,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: i % 2 === 0 ? ON_COLOR : OFF_COLOR }}>
                    {days} {i % 2 === 0 ? 'ON' : 'OFF'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Stats row */}
            <View className="flex-row items-center" style={{ gap: 12, marginBottom: 8 }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ON_COLOR }} />
                <Text style={{ fontSize: 13, color: palette.textSecondary }}>{onDays} on</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: OFF_COLOR }} />
                <Text style={{ fontSize: 13, color: palette.textSecondary }}>{offDays} off</Text>
              </View>
              <Text style={{ fontSize: 13, color: palette.textTertiary }}>{ratio}% on-duty</Text>
              <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary }}>
                Off: {pattern.offCode}
              </Text>
            </View>

            {/* Edit button */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                {pattern.isActive ? (
                  <View
                    className="px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#4ade80' : '#166534' }}>
                      Active
                    </Text>
                  </View>
                ) : (
                  <View
                    className="px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>
                      Inactive
                    </Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={onEdit}
                className="flex-row items-center px-3 py-1.5 rounded-lg active:opacity-70"
                style={{ backgroundColor: accentTint(accent, isDark ? 0.1 : 0.05), gap: 5 }}
              >
                <Pencil size={13} color={accent} strokeWidth={1.8} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Edit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  )
})
