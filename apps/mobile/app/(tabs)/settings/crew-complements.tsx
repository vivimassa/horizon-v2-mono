import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, SectionList, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CrewComplementRef, type AircraftTypeRef, type CrewPositionRef } from '@skyhub/api'
import { ChevronRight, ChevronDown, Users, Plus, RefreshCw, Sparkles, Lock, Pencil } from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { ListScreenHeader, SearchInput, Text, domainIcons } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { useHubBack } from '../../../lib/use-hub-back'
import { COMPLEMENT_TEMPLATES } from '@skyhub/logic'

const CrewIcon = domainIcons.crew

const TEMPLATE_COLORS: Record<string, string> = { standard: '#22c55e', aug1: '#f59e0b', aug2: '#ef4444' }

interface TypeSection {
  title: string
  icao: string
  data: CrewComplementRef[]
}

export default function CrewComplementsList() {
  const { palette, isDark, accent } = useAppTheme()
  // Swipe-back lands on hub home with Master Database pre-opened.
  useHubBack('settings')
  const operatorId = useOperatorId()
  const [complements, setComplements] = useState<CrewComplementRef[]>([])
  const [acTypes, setAcTypes] = useState<AircraftTypeRef[]>([])
  const [positions, setPositions] = useState<CrewPositionRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchData = useCallback(() => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    Promise.all([api.getCrewComplements(operatorId), api.getAircraftTypes(), api.getCrewPositions(operatorId)])
      .then(([c, t, p]) => {
        setComplements(c)
        setAcTypes(t.filter((a) => a.isActive))
        setPositions(
          p.sort((a, b) => {
            if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
            return a.rankOrder - b.rankOrder
          }),
        )
      })
      .catch((err: any) => setError(err.message || 'Failed to load'))
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

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const handleSeedAll = useCallback(async () => {
    setSeeding(true)
    try {
      await api.seedCrewComplementDefaults(operatorId)
      fetchData()
    } catch (err: any) {
      Alert.alert('Seed Failed', err.message || 'Could not seed defaults')
    } finally {
      setSeeding(false)
    }
  }, [operatorId, fetchData])

  const typeMap = useMemo(() => {
    const m = new Map<string, AircraftTypeRef>()
    for (const t of acTypes) m.set(t.icaoType, t)
    return m
  }, [acTypes])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? complements.filter(
          (c) => c.aircraftTypeIcao.toLowerCase().includes(q) || c.templateKey.toLowerCase().includes(q),
        )
      : complements

    const map = new Map<string, CrewComplementRef[]>()
    for (const c of filtered) {
      const arr = map.get(c.aircraftTypeIcao)
      if (arr) arr.push(c)
      else map.set(c.aircraftTypeIcao, [c])
    }

    const sections: TypeSection[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([icao, data]) => {
        data.sort((a, b) => {
          const order = ['standard', 'aug1', 'aug2']
          const ai = order.indexOf(a.templateKey),
            bi = order.indexOf(b.templateKey)
          return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99) || a.templateKey.localeCompare(b.templateKey)
        })
        return { title: `${icao}`, icao, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [complements, search, typeMap])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top']}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 12, paddingTop: 4 }}>
          <ListScreenHeader
            icon={CrewIcon}
            title="Crew Complements"
            count={complements.length}
            filteredCount={filteredCount}
            countLabel="template"
            onAdd={() => router.push('/(tabs)/settings/crew-complement-add' as any)}
          />
          <View style={{ paddingHorizontal: 16 }}>
            <SearchInput placeholder="Search aircraft type, template..." value={search} onChangeText={setSearch} />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading crew complements...</Text>
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
                  <Users size={28} color={accent} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: palette.text, textAlign: 'center', marginBottom: 8 }}
                >
                  No Crew Complements
                </Text>
                <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                  Define crew requirements per aircraft type and template.
                </Text>
                <View style={{ gap: 10 }}>
                  <Pressable
                    onPress={handleSeedAll}
                    disabled={seeding}
                    className="flex-row items-center px-4 py-2.5 rounded-lg active:opacity-70"
                    style={{ backgroundColor: accent, gap: 6, opacity: seeding ? 0.5 : 1 }}
                  >
                    <Sparkles size={16} color="#fff" strokeWidth={2} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                      {seeding ? 'Seeding...' : 'Seed All Defaults'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/(tabs)/settings/crew-complement-add' as any)}
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
              const s = section as TypeSection
              const original = sections.find((sec) => sec.icao === s.icao)
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
                  <Text
                    style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent, marginRight: 6 }}
                  >
                    {s.icao}
                  </Text>
                  <Text
                    style={{ fontSize: 15, fontWeight: '600', color: palette.textSecondary, flex: 1 }}
                    numberOfLines={1}
                  >
                    {typeMap.get(s.icao)?.name ?? ''}
                  </Text>
                  <Text style={{ fontSize: 14, color: palette.textTertiary }}>({count})</Text>
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <ComplementAccordion
                comp={item}
                positions={positions}
                isExpanded={expanded.has(item._id)}
                onToggle={() => toggleExpand(item._id)}
                onEdit={() =>
                  router.push({ pathname: '/(tabs)/settings/crew-complement-detail' as any, params: { id: item._id } })
                }
                palette={palette}
                accent={accent}
                isDark={isDark}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

const PROTECTED = new Set(['standard', 'aug1', 'aug2'])

const ComplementAccordion = memo(function ComplementAccordion({
  comp,
  positions,
  isExpanded,
  onToggle,
  onEdit,
  palette,
  accent,
  isDark,
}: {
  comp: CrewComplementRef
  positions: CrewPositionRef[]
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  palette: Palette
  accent: string
  isDark: boolean
}) {
  const tplDef = COMPLEMENT_TEMPLATES.find((t) => t.key === comp.templateKey)
  const badgeColor = TEMPLATE_COLORS[comp.templateKey] ?? accent
  const total = Object.values(comp.counts).reduce((s, n) => s + n, 0)
  const isProtectedTpl = PROTECTED.has(comp.templateKey)

  const cockpit = positions.filter((p) => p.category === 'cockpit')
  const cabin = positions.filter((p) => p.category === 'cabin')

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border, opacity: comp.isActive ? 1 : 0.4 }}>
      {/* Accordion header row */}
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
        <View
          className="items-center rounded mr-3"
          style={{ backgroundColor: `${badgeColor}20`, width: 72, paddingVertical: 3 }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: badgeColor }} numberOfLines={1}>
            {tplDef?.badge ?? comp.templateKey.toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
            {tplDef?.label ?? comp.templateKey}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {isProtectedTpl && <Lock size={12} color={palette.textTertiary} strokeWidth={2} />}
          <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent }}>{total}</Text>
        </View>
      </Pressable>

      {/* Expanded: position counts */}
      {isExpanded && (
        <View style={{ paddingBottom: 12 }}>
          {cockpit.length <= 4 && cabin.length <= 4 ? (
            /* Compact: all positions in a single row */
            <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <View
                className="flex-row rounded-lg overflow-hidden"
                style={{
                  borderWidth: 1,
                  borderColor: palette.cardBorder,
                  backgroundColor: palette.card,
                }}
              >
                {positions.map((p, i) => (
                  <View
                    key={p._id}
                    className="items-center flex-1 py-2.5"
                    style={{
                      borderLeftWidth: i > 0 ? 1 : 0,
                      borderLeftColor: palette.cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        fontFamily: 'monospace',
                        color: p.color ?? accent,
                        marginBottom: 2,
                      }}
                    >
                      {p.code}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', fontFamily: 'monospace', color: accent }}>
                      {comp.counts[p.code] ?? 0}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            /* Split: separate rows when either category exceeds 4 */
            <>
              {cockpit.length > 0 && (
                <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: '#3b82f6',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                    }}
                  >
                    Flight Deck
                  </Text>
                  <View
                    className="flex-row rounded-lg overflow-hidden"
                    style={{
                      borderWidth: 1,
                      borderColor: palette.cardBorder,
                      backgroundColor: palette.card,
                    }}
                  >
                    {cockpit.map((p, i) => (
                      <View
                        key={p._id}
                        className="items-center flex-1 py-2.5"
                        style={{
                          borderLeftWidth: i > 0 ? 1 : 0,
                          borderLeftColor: palette.cardBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            fontFamily: 'monospace',
                            color: p.color ?? '#3b82f6',
                            marginBottom: 2,
                          }}
                        >
                          {p.code}
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', fontFamily: 'monospace', color: accent }}>
                          {comp.counts[p.code] ?? 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {cabin.length > 0 && (
                <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: '#f59e0b',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                    }}
                  >
                    Cabin Crew
                  </Text>
                  <View
                    className="flex-row rounded-lg overflow-hidden"
                    style={{
                      borderWidth: 1,
                      borderColor: palette.cardBorder,
                      backgroundColor: palette.card,
                    }}
                  >
                    {cabin.map((p, i) => (
                      <View
                        key={p._id}
                        className="items-center flex-1 py-2.5"
                        style={{
                          borderLeftWidth: i > 0 ? 1 : 0,
                          borderLeftColor: palette.cardBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            fontFamily: 'monospace',
                            color: p.color ?? '#f59e0b',
                            marginBottom: 2,
                          }}
                        >
                          {p.code}
                        </Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', fontFamily: 'monospace', color: accent }}>
                          {comp.counts[p.code] ?? 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Edit button */}
          <View style={{ marginHorizontal: 16, marginTop: 4 }}>
            <Pressable
              onPress={onEdit}
              className="flex-row items-center justify-center py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: accentTint(accent, isDark ? 0.1 : 0.05), gap: 5 }}
            >
              <Pencil size={13} color={accent} strokeWidth={1.8} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>Edit Counts</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
})
