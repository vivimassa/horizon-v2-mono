import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type MppLeadTimeGroupRef, type MppLeadTimeItemRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronDown, Timer, Plus, RefreshCw, Sparkles, Pencil, Trash2,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'

const CREW_TYPE_LABELS: Record<string, string> = { cockpit: 'Cockpit', cabin: 'Cabin', other: 'Other' }

interface GroupSection {
  title: string
  data: MppLeadTimeGroupRef[]
}

export default function MppLeadTimesList() {
  const { palette, isDark, accent } = useAppTheme()
  const operatorId = useOperatorId()
  const [groups, setGroups] = useState<MppLeadTimeGroupRef[]>([])
  const [items, setItems] = useState<MppLeadTimeItemRef[]>([])
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
    Promise.all([api.getMppLeadTimeGroups(operatorId), api.getMppLeadTimeItems(operatorId)])
      .then(([g, i]) => {
        setGroups(g)
        setItems(i)
        setExpanded(new Set(g.map(gr => gr._id)))
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [operatorId])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))

  const handleSeed = useCallback(async () => {
    setSeeding(true)
    try {
      await api.seedMppLeadTimeDefaults(operatorId)
      fetchData()
    } catch (err: any) {
      Alert.alert('Seed Failed', err.message || 'Could not seed defaults')
    } finally { setSeeding(false) }
  }, [operatorId, fetchData])

  const handleDeleteItem = useCallback(async (item: MppLeadTimeItemRef) => {
    Alert.alert('Delete Item', `Delete "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteMppLeadTimeItem(item._id); fetchData() }
        catch (err: any) { Alert.alert('Error', err.message || 'Failed') }
      }},
    ])
  }, [fetchData])

  const itemsByGroup = useMemo(() => {
    const m = new Map<string, MppLeadTimeItemRef[]>()
    for (const i of items) {
      const arr = m.get(i.groupId)
      if (arr) arr.push(i)
      else m.set(i.groupId, [i])
    }
    return m
  }, [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return groups
    return groups.filter(g =>
      g.label.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q) ||
      (g.description?.toLowerCase().includes(q)) ||
      (itemsByGroup.get(g._id) ?? []).some(i => i.label.toLowerCase().includes(q))
    )
  }, [groups, search, itemsByGroup])

  // Group by crewType
  const sections = useMemo(() => {
    const map = new Map<string, MppLeadTimeGroupRef[]>()
    for (const g of filtered) {
      const arr = map.get(g.crewType)
      if (arr) arr.push(g)
      else map.set(g.crewType, [g])
    }
    const order = ['cockpit', 'cabin', 'other']
    return Array.from(map.entries())
      .sort(([a], [b]) => (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99))
      .map(([ct, data]) => ({ title: CREW_TYPE_LABELS[ct] ?? ct, data })) as GroupSection[]
  }, [filtered])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
    <BreadcrumbHeader moduleCode="6" />
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
      <View className="px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="flex-row items-center mb-3">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-60">
            <ChevronLeft size={24} color={accent} strokeWidth={2} />
          </Pressable>
          <View className="items-center justify-center rounded-lg mr-3"
            style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}>
            <Timer size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>MPP Lead Times</Text>
            <Text style={{ fontSize: 15, color: palette.textSecondary }}>
              {groups.length} group{groups.length !== 1 ? 's' : ''} · {items.length} item{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/settings/mpp-lead-time-add' as any)}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, gap: 4 }}>
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Add</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 12,
        }}>
          <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput className="flex-1 py-2.5 ml-2" style={{ fontSize: 15, color: palette.text }}
            placeholder="Search groups, items..." placeholderTextColor={palette.textTertiary}
            value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading MPP lead times...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
          <Pressable onPress={fetchData} className="flex-row items-center px-4 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08), gap: 6 }}>
            <RefreshCw size={14} color={accent} strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: accent }}>Retry</Text>
          </Pressable>
        </View>
      ) : groups.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <View className="items-center justify-center rounded-full mb-4"
            style={{ width: 64, height: 64, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.08) }}>
            <Timer size={28} color={accent} strokeWidth={1.5} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}>
            No MPP Lead Times
          </Text>
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
            Define training & recruitment lead times for manpower planning.
          </Text>
          <View style={{ gap: 10 }}>
            <Pressable onPress={handleSeed} disabled={seeding}
              className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-70"
              style={{ backgroundColor: accent, gap: 6, opacity: seeding ? 0.5 : 1 }}>
              <Sparkles size={16} color="#fff" strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                {seeding ? 'Seeding...' : 'Load Defaults'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottomWidth: 1, borderBottomColor: palette.border }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item: group }) => (
            <GroupAccordion group={group} items={itemsByGroup.get(group._id) ?? []}
              palette={palette} accent={accent} isDark={isDark}
              isExpanded={expanded.has(group._id)}
              onToggle={() => setExpanded(prev => { const n = new Set(prev); n.has(group._id) ? n.delete(group._id) : n.add(group._id); return n })}
              onEdit={() => router.push({ pathname: '/(tabs)/settings/mpp-lead-time-detail' as any, params: { id: group._id } })}
              onDeleteItem={handleDeleteItem} />
          )}
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const GroupAccordion = memo(function GroupAccordion({
  group, items, palette, accent, isDark, isExpanded, onToggle, onEdit, onDeleteItem,
}: {
  group: MppLeadTimeGroupRef; items: MppLeadTimeItemRef[];
  palette: Palette; accent: string; isDark: boolean;
  isExpanded: boolean; onToggle: () => void; onEdit: () => void;
  onDeleteItem: (item: MppLeadTimeItemRef) => void
}) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
      {/* Header */}
      <Pressable onPress={onToggle} className="flex-row items-center active:opacity-70"
        style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <ChevronDown size={14} color={palette.textTertiary} strokeWidth={2}
          style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }], marginRight: 8 }} />
        <View className="px-2 py-0.5 rounded mr-3" style={{ backgroundColor: `${group.color}20` }}>
          <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: group.color }}>{group.code}</Text>
        </View>
        <View className="flex-1">
          <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>{group.label}</Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: accent }}>{items.length}</Text>
      </Pressable>

      {/* Expanded: items list */}
      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {group.description && (
            <Text style={{ fontSize: 13, color: palette.textSecondary, marginBottom: 8 }}>{group.description}</Text>
          )}

          {items.length > 0 ? (
            <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: palette.cardBorder, backgroundColor: palette.card }}>
              {items.map((item, i) => (
                <View key={item._id} className="flex-row items-center px-3 py-2.5" style={{
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: palette.cardBorder,
                }}>
                  <View className="flex-1 mr-2">
                    <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }} numberOfLines={1}>{item.label}</Text>
                    {item.consumedBy && (
                      <Text style={{ fontSize: 12, color: palette.textTertiary, marginTop: 1 }} numberOfLines={1}>{item.consumedBy}</Text>
                    )}
                  </View>
                  <View className="px-2 py-0.5 rounded" style={{ backgroundColor: accentTint(group.color, isDark ? 0.15 : 0.08) }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'monospace', color: group.color }}>
                      {item.valueMonths}m
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: palette.textTertiary, fontStyle: 'italic' }}>No items in this group</Text>
          )}

          {/* Edit group button */}
          <View className="mt-2">
            <Pressable onPress={onEdit} className="flex-row items-center justify-center py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: accentTint(accent, isDark ? 0.1 : 0.05), gap: 5 }}>
              <Pencil size={13} color={accent} strokeWidth={1.8} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Edit Group & Items</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
})
