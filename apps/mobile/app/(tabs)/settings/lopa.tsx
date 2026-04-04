import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, FlatList, SectionList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type CabinClassRef, type LopaConfigRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, Armchair, Plus, Plane, Star,
} from 'lucide-react-native'
import { accentTint, modeColor, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

type ViewMode = 'cabin-classes' | 'lopa-configs'

interface ConfigSection {
  title: string
  data: LopaConfigRef[]
}

export default function LopaScreen() {
  const { palette, isDark, accent } = useAppTheme()
  const router = useRouter()

  const [cabinClasses, setCabinClasses] = useState<CabinClassRef[]>([])
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('cabin-classes')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([api.getCabinClasses(), api.getLopaConfigs()])
      .then(([classes, configs]) => { setCabinClasses(classes); setLopaConfigs(configs) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))

  const toggleGroup = useCallback((title: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title); else next.add(title)
      return next
    })
  }, [])

  // Filtered cabin classes
  const filteredClasses = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = q
      ? cabinClasses.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : cabinClasses
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
  }, [cabinClasses, search])

  // Filtered + grouped configs
  const { sections, filteredConfigCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? lopaConfigs.filter(c => c.aircraftType.toLowerCase().includes(q) || c.configName.toLowerCase().includes(q))
      : lopaConfigs

    const map = new Map<string, LopaConfigRef[]>()
    for (const c of filtered) {
      const arr = map.get(c.aircraftType)
      if (arr) arr.push(c); else map.set(c.aircraftType, [c])
    }

    const sections: ConfigSection[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }))

    return { sections, filteredConfigCount: filtered.length }
  }, [lopaConfigs, search])

  const isCabinMode = viewMode === 'cabin-classes'
  const totalCount = isCabinMode ? cabinClasses.length : lopaConfigs.length
  const filteredCount = isCabinMode ? filteredClasses.length : filteredConfigCount

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    setSearch('')
  }

  const handleNew = () => {
    if (isCabinMode) router.push('/(tabs)/settings/cabin-class-add' as any)
    else router.push('/(tabs)/settings/lopa-config-add' as any)
  }

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
            <Armchair size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>LOPA</Text>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>
              {filteredCount === totalCount ? `${totalCount} ${isCabinMode ? 'classes' : 'configs'}` : `${filteredCount} / ${totalCount}`}
            </Text>
          </View>
          <Pressable
            onPress={handleNew}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, gap: 4 }}
          >
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>New</Text>
          </Pressable>
        </View>

        {/* Segment toggle */}
        <View
          className="flex-row rounded-lg overflow-hidden mb-3"
          style={{ borderWidth: 1, borderColor: palette.cardBorder }}
        >
          <Pressable
            onPress={() => handleViewChange('cabin-classes')}
            className="flex-1 items-center py-2"
            style={isCabinMode ? { backgroundColor: accent } : undefined}
          >
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: isCabinMode ? '#fff' : palette.textSecondary,
            }}>
              Cabin Classes
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleViewChange('lopa-configs')}
            className="flex-1 items-center py-2"
            style={!isCabinMode ? { backgroundColor: accent } : undefined}
          >
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: !isCabinMode ? '#fff' : palette.textSecondary,
            }}>
              Configurations
            </Text>
          </Pressable>
        </View>

        {/* Search */}
        <View className="flex-row items-center rounded-xl" style={{
          backgroundColor: palette.card,
          borderWidth: 1, borderColor: palette.cardBorder,
          paddingHorizontal: 12,
        }}>
          <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput
            className="flex-1 py-2.5 ml-2"
            style={{ fontSize: 15, color: palette.text }}
            placeholder={isCabinMode ? 'Search code or name...' : 'Search aircraft type or config...'}
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
      ) : isCabinMode ? (
        /* ── Cabin Classes FlatList ── */
        filteredClasses.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8">
            <Armchair size={40} color={palette.textTertiary} strokeWidth={1.2} />
            <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
              {cabinClasses.length === 0 ? 'No cabin classes yet.\nTap + to create one.' : 'No results found.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredClasses}
            keyExtractor={item => item._id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <CabinClassRow
                cc={item} palette={palette} accent={accent} isDark={isDark}
                onPress={() => router.push({ pathname: '/(tabs)/settings/cabin-class-detail' as any, params: { id: item._id } })}
              />
            )}
          />
        )
      ) : (
        /* ── LOPA Configs SectionList ── */
        sections.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8">
            <Plane size={40} color={palette.textTertiary} strokeWidth={1.2} />
            <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
              {lopaConfigs.length === 0 ? 'No configurations yet.\nTap + to create one.' : 'No results found.'}
            </Text>
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
            renderSectionHeader={({ section }) => {
              const original = sections.find(s => s.title === section.title)
              const count = original?.data.length ?? 0
              const isCollapsed = collapsed.has(section.title)

              return (
                <Pressable
                  className="flex-row items-center active:opacity-70"
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderBottomWidth: 1, borderBottomColor: palette.border,
                  }}
                  onPress={() => toggleGroup(section.title)}
                >
                  <ChevronRight
                    size={12} color={palette.textTertiary} strokeWidth={2}
                    style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }}
                  />
                  <Plane size={14} color={palette.textTertiary} strokeWidth={1.8} style={{ marginRight: 6 }} />
                  <Text style={{
                    fontSize: 13, fontWeight: '700', color: palette.textSecondary,
                    textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'monospace',
                  }}>
                    {section.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                  <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
                </Pressable>
              )
            }}
            renderItem={({ item }) => (
              <ConfigRow
                config={item} palette={palette} accent={accent} isDark={isDark}
                onPress={() => router.push({ pathname: '/(tabs)/settings/lopa-config-detail' as any, params: { id: item._id } })}
              />
            )}
          />
        )
      )}
    </SafeAreaView>
    </View>
  )
}

// ── Cabin class row ──
const CabinClassRow = memo(function CabinClassRow({
  cc, palette, accent, isDark, onPress,
}: {
  cc: CabinClassRef; palette: Palette; accent: string; isDark: boolean; onPress: () => void
}) {
  const color = modeColor(cc.color || '#9ca3af', isDark)
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}
    >
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, marginRight: 10 }} />
      <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 32 }}>
        {cc.code}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {cc.name}
        </Text>
        {cc.seatLayout && (
          <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }}>
            {cc.seatLayout} layout{cc.seatType ? ` · ${cc.seatType}` : ''}
          </Text>
        )}
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Text style={{ fontSize: 11, fontFamily: 'monospace', color: palette.textTertiary }}>
          #{cc.sortOrder}
        </Text>
        <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </View>
    </Pressable>
  )
})

// ── Config row ──
const ConfigRow = memo(function ConfigRow({
  config, palette, accent, isDark, onPress,
}: {
  config: LopaConfigRef; palette: Palette; accent: string; isDark: boolean; onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center active:opacity-70"
      style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}
    >
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
            {config.configName}
          </Text>
          {config.isDefault && (
            <Star size={12} color="#f59e0b" fill="#f59e0b" strokeWidth={1.5} />
          )}
        </View>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 2 }}>
          {config.totalSeats} seats · {config.cabins.length} cabin{config.cabins.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
