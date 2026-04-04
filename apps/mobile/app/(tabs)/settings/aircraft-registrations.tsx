import { useState, useMemo, useCallback, memo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, SectionList, TextInput, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type AircraftRegistrationRef, type AircraftTypeRef, type LopaConfigRef } from '@skyhub/api'
import {
  Search, ChevronLeft, ChevronRight, PlaneTakeoff, Plus, Plane,
} from 'lucide-react-native'
import { accentTint, type Palette } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981', maintenance: '#f59e0b', stored: '#6b7280', retired: '#ef4444',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Active', maintenance: 'Maintenance', stored: 'Stored', retired: 'Retired',
}

interface RegSection { title: string; data: AircraftRegistrationRef[] }

export default function AircraftRegistrationsList() {
  const { palette, isDark, accent } = useAppTheme()
  const [regs, setRegs] = useState<AircraftRegistrationRef[]>([])
  const [types, setTypes] = useState<AircraftTypeRef[]>([])
  const [lopaConfigs, setLopaConfigs] = useState<LopaConfigRef[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([api.getAircraftRegistrations(), api.getAircraftTypes(), api.getLopaConfigs()])
      .then(([r, t, l]) => { setRegs(r); setTypes(t); setLopaConfigs(l) })
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

  const typeLookup = useMemo(() => {
    const map = new Map<string, AircraftTypeRef>()
    for (const t of types) map.set(t._id, t)
    return map
  }, [types])

  const lopaLookup = useMemo(() => {
    const map = new Map<string, LopaConfigRef>()
    for (const l of lopaConfigs) map.set(l._id, l)
    return map
  }, [lopaConfigs])

  const { sections, filteredCount } = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? regs.filter(r => {
          const t = typeLookup.get(r.aircraftTypeId)
          return r.registration.toLowerCase().includes(q) ||
            (r.serialNumber?.toLowerCase().includes(q)) ||
            (r.variant?.toLowerCase().includes(q)) ||
            r.status.toLowerCase().includes(q) ||
            (r.homeBaseIcao?.toLowerCase().includes(q)) ||
            (t?.icaoType.toLowerCase().includes(q)) ||
            (t?.name.toLowerCase().includes(q))
        })
      : regs

    const map = new Map<string, AircraftRegistrationRef[]>()
    for (const r of filtered) {
      const t = typeLookup.get(r.aircraftTypeId)
      const key = t?.icaoType || 'Unknown'
      const arr = map.get(key)
      if (arr) arr.push(r); else map.set(key, [r])
    }

    const sections: RegSection[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => {
        data.sort((a, b) => a.registration.localeCompare(b.registration))
        return { title, data }
      })

    return { sections, filteredCount: filtered.length }
  }, [regs, search, typeLookup])

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
            <PlaneTakeoff size={18} color={accent} strokeWidth={1.8} />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Aircraft Registrations</Text>
            <Text style={{ fontSize: 13, color: palette.textSecondary }}>
              {filteredCount === regs.length ? `${regs.length} aircraft` : `${filteredCount} / ${regs.length} aircraft`}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/settings/aircraft-registration-add' as any)}
            className="flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, gap: 4 }}>
            <Plus size={16} color="#fff" strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>New</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center rounded-xl" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder, paddingHorizontal: 12 }}>
          <Search size={16} color={palette.textTertiary} strokeWidth={1.8} />
          <TextInput className="flex-1 py-2.5 ml-2" style={{ fontSize: 15, color: palette.text }}
            placeholder="Search registration, MSN, type..." placeholderTextColor={palette.textTertiary}
            value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading...</Text>
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <PlaneTakeoff size={40} color={palette.textTertiary} strokeWidth={1.2} />
          <Text style={{ fontSize: 15, color: palette.textSecondary, marginTop: 12, textAlign: 'center' }}>
            {regs.length === 0 ? 'No aircraft registered yet.\nTap + to add one.' : 'No results found.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections.map(s => ({ ...s, data: collapsed.has(s.title) ? [] : s.data }))}
          keyExtractor={item => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const original = sections.find(s => s.title === section.title)
            const count = original?.data.length ?? 0
            const isCollapsed = collapsed.has(section.title)
            return (
              <Pressable className="flex-row items-center active:opacity-70"
                style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottomWidth: 1, borderBottomColor: palette.border }}
                onPress={() => toggleGroup(section.title)}>
                <ChevronRight size={12} color={palette.textTertiary} strokeWidth={2}
                  style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }], marginRight: 8 }} />
                <Plane size={14} color={palette.textTertiary} strokeWidth={1.8} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'monospace' }}>
                  {section.title}
                </Text>
                <Text style={{ fontSize: 13, color: palette.textTertiary, marginLeft: 6 }}>({count})</Text>
                <View className="flex-1 ml-3" style={{ height: 1, backgroundColor: palette.border }} />
              </Pressable>
            )
          }}
          renderItem={({ item }) => (
            <RegRow reg={item} typeLookup={typeLookup} lopaLookup={lopaLookup} palette={palette} accent={accent}
              onPress={() => router.push({ pathname: '/(tabs)/settings/aircraft-registration-detail' as any, params: { id: item._id } })} />
          )}
        />
      )}
    </SafeAreaView>
    </View>
  )
}

const RegRow = memo(function RegRow({ reg, typeLookup, lopaLookup, palette, accent, onPress }: {
  reg: AircraftRegistrationRef; typeLookup: Map<string, AircraftTypeRef>; lopaLookup: Map<string, LopaConfigRef>; palette: Palette; accent: string; onPress: () => void
}) {
  const statusColor = STATUS_COLORS[reg.status] || '#6b7280'
  const lopa = reg.lopaConfigId ? lopaLookup.get(reg.lopaConfigId) : null
  const seatInfo = lopa ? `${lopa.totalSeats} seats · ${lopa.configName}` : null
  return (
    <Pressable onPress={onPress} className="flex-row items-center active:opacity-70"
      style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginRight: 10 }} />
      <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', color: accent, width: 80 }}>
        {reg.registration}
      </Text>
      <View className="flex-1 ml-2">
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }} numberOfLines={1}>
          {reg.variant || reg.serialNumber || '---'}
        </Text>
        <Text style={{ fontSize: 13, color: palette.textSecondary, marginTop: 1 }} numberOfLines={1}>
          {seatInfo || 'No LOPA assigned'}
        </Text>
      </View>
      <View className="px-2 py-0.5 rounded-full mr-2" style={{ backgroundColor: `${statusColor}20` }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor }}>{STATUS_LABELS[reg.status] || reg.status}</Text>
      </View>
      <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
    </Pressable>
  )
})
