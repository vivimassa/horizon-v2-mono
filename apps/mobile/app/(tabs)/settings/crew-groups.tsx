import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, FlatList, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CrewGroupRef } from '@skyhub/api'
import { ChevronDown, Users, Plus, RefreshCw, Sparkles, Pencil } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { ListScreenHeader, SearchInput } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { useHubBack } from '../../../lib/use-hub-back'

export default function CrewGroupsList() {
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')
  const operatorId = useOperatorId()
  const [groups, setGroups] = useState<CrewGroupRef[]>([])
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
      .getCrewGroups(operatorId, true)
      .then(setGroups)
      .catch((err: any) => setError(err.message || 'Failed to load crew groups'))
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
      await api.seedCrewGroups(operatorId)
      fetchData()
    } catch (err: any) {
      Alert.alert('Seed Failed', err.message || 'Could not seed defaults')
    } finally {
      setSeeding(false)
    }
  }, [operatorId, fetchData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return groups
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q))
  }, [groups, search])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={Users}
            title="Crew Groups"
            count={groups.length}
            filteredCount={filtered.length}
            countLabel="group"
            onAdd={() => router.push('/(tabs)/settings/crew-group-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search name, description..." value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading crew groups...</Text>
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
                  <Users size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}
                >
                  No Crew Groups
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Define scheduling groups for crew classification and rostering.
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
                      {seeding ? 'Seeding...' : 'Seed Default Groups'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/(tabs)/settings/crew-group-add' as any)}
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
              <GroupAccordion
                group={item}
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
                  router.push({ pathname: '/(tabs)/settings/crew-group-detail' as any, params: { id: item._id } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const GroupAccordion = memo(function GroupAccordion({
  group,
  palette,
  accent,
  isDark,
  isExpanded,
  onToggle,
  onEdit,
}: {
  group: CrewGroupRef
  palette: Palette
  accent: string
  isDark: boolean
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, opacity: group.isActive ? 1 : 0.4 }}>
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
        <View className="flex-1">
          <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
            {group.name}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {!group.isActive && (
            <View
              className="px-1.5 py-0.5 rounded"
              style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#f87171' : '#991b1b' }}>Inactive</Text>
            </View>
          )}
          <Text style={{ fontSize: 13, fontFamily: 'monospace', color: palette.textTertiary }}>#{group.sortOrder}</Text>
        </View>
      </Pressable>

      {/* Expanded content */}
      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View
            className="rounded-lg p-3"
            style={{
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.cardBorder,
            }}
          >
            {group.description ? (
              <Text style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 8 }}>{group.description}</Text>
            ) : (
              <Text style={{ fontSize: 14, color: palette.textTertiary, fontStyle: 'italic', marginBottom: 8 }}>
                No description
              </Text>
            )}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, color: palette.textTertiary }}>
                  Order:{' '}
                  <Text style={{ fontWeight: '600', fontFamily: 'monospace', color: palette.text }}>
                    {group.sortOrder}
                  </Text>
                </Text>
                {group.isActive ? (
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
