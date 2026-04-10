import { useState, useCallback, useMemo } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, Pressable, Alert, ScrollView, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type ScheduledFlightRef, type ScenarioRef } from '@skyhub/api'
import { ChevronDown, LayoutGrid } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { ScheduleToolbar } from '../../../components/schedule/schedule-toolbar'
import { ScheduleTable } from '../../../components/schedule/schedule-table'
import { ScheduleCardList } from '../../../components/schedule/schedule-card-list'
import { ScheduleFilterSheet, type ScheduleFilters } from '../../../components/schedule/schedule-filter-sheet'

export default function ScheduleGridScreen() {
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()
  const router = useRouter()

  // Data
  const [flights, setFlights] = useState<ScheduledFlightRef[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editing state
  const [dirtyMap, setDirtyMap] = useState<Map<string, Partial<ScheduledFlightRef>>>(new Map())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Filters & sorting
  const [filters, setFilters] = useState<ScheduleFilters>({ dateFrom: '', dateTo: '', dep: '', arr: '', acType: '', status: '' })
  const [showFilter, setShowFilter] = useState(false)
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('sortOrder')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    try {
      const params: any = { operatorId }
      if (scenarioId) params.scenarioId = scenarioId
      if (filters.dateFrom) params.dateFrom = filters.dateFrom
      if (filters.dateTo) params.dateTo = filters.dateTo
      if (filters.dep) params.depStation = filters.dep
      if (filters.arr) params.arrStation = filters.arr
      if (filters.acType) params.aircraftTypeIcao = filters.acType
      if (filters.status) params.status = filters.status
      if (sortKey) { params.sortBy = sortKey; params.sortDir = sortDir }

      const [f, s] = await Promise.all([
        api.getScheduledFlights(params),
        api.getScenarios({ operatorId }),
      ])
      setFlights(f)
      setScenarios(s)
    } catch (err: any) { setError(err.message || 'Failed to load schedule') }
    finally { setLoading(false) }
  }, [operatorId, scenarioId, filters, sortKey, sortDir])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))

  // Dirty tracking
  const hasDirty = dirtyMap.size > 0 || newIds.size > 0 || deletedIds.size > 0
  const dirtyCount = dirtyMap.size
  const newCount = newIds.size
  const deleteCount = deletedIds.size

  const handleCellEdit = useCallback((id: string, key: string, value: any) => {
    setDirtyMap(prev => {
      const next = new Map(prev)
      const existing = next.get(id) ?? {}
      next.set(id, { ...existing, [key]: value })
      return next
    })
  }, [])

  const handleAddFlight = useCallback(() => {
    const id = `new_${Date.now()}`
    const newFlight: ScheduledFlightRef = {
      _id: id, operatorId, seasonCode: '', airlineCode: '', flightNumber: '',
      suffix: null, depStation: '', arrStation: '', depAirportId: null, arrAirportId: null,
      stdUtc: '', staUtc: '', stdLocal: null, staLocal: null, blockMinutes: null,
      departureDayOffset: 1, arrivalDayOffset: 1, daysOfWeek: '1234567',
      aircraftTypeId: null, aircraftTypeIcao: null, aircraftReg: null,
      serviceType: 'J', status: 'draft', previousStatus: null,
      effectiveFrom: '', effectiveUntil: '', cockpitCrewRequired: null, cabinCrewRequired: null,
      isEtops: false, isOverwater: false, isActive: true,
      scenarioId: scenarioId, rotationId: null, rotationSequence: null, rotationLabel: null,
      source: 'manual', sortOrder: flights.length, formatting: {},
      createdAt: null, updatedAt: null,
    }
    setFlights(prev => [...prev, newFlight])
    setNewIds(prev => new Set(prev).add(id))
    setSelectedId(id)

    // On phone, navigate to detail immediately
    if (!isTablet) {
      router.push({ pathname: '/(tabs)/network/schedule-flight-detail' as any, params: { id, isNew: '1' } })
    }
  }, [operatorId, scenarioId, flights.length, isTablet, router])

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return
    if (newIds.has(selectedId)) {
      // Remove unsaved new row
      setFlights(prev => prev.filter(f => f._id !== selectedId))
      setNewIds(prev => { const n = new Set(prev); n.delete(selectedId); return n })
      setDirtyMap(prev => { const n = new Map(prev); n.delete(selectedId); return n })
    } else {
      setDeletedIds(prev => new Set(prev).add(selectedId))
    }
    setSelectedId(null)
  }, [selectedId, newIds])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      // Delete
      const toDelete = [...deletedIds].filter(id => !newIds.has(id))
      if (toDelete.length > 0) await api.deleteScheduledFlightsBulk(toDelete)

      // Update dirty (excluding new and deleted)
      const updates: { id: string; changes: Partial<ScheduledFlightRef> }[] = []
      for (const [id, changes] of dirtyMap) {
        if (newIds.has(id) || deletedIds.has(id)) continue
        updates.push({ id, changes })
      }
      if (updates.length > 0) await api.updateScheduledFlightsBulk(updates)

      // Create new (excluding deleted)
      const toCreate = flights
        .filter(f => newIds.has(f._id) && !deletedIds.has(f._id))
        .map(f => {
          const dirty = dirtyMap.get(f._id)
          const merged = { ...f, ...dirty }
          const { _id, ...rest } = merged
          return rest
        })
        .filter(f => f.flightNumber && f.depStation && f.arrStation)
      if (toCreate.length > 0) await api.createScheduledFlightsBulk(toCreate)

      // Reset state and refresh
      setDirtyMap(new Map())
      setNewIds(new Set())
      setDeletedIds(new Set())
      await fetchData()
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally { setSaving(false) }
  }, [dirtyMap, newIds, deletedIds, flights, fetchData])

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Changes', `Discard ${dirtyCount + newCount + deleteCount} pending changes?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => {
        setDirtyMap(new Map())
        setNewIds(new Set())
        setDeletedIds(new Set())
        fetchData()
      }},
    ])
  }, [dirtyCount, newCount, deleteCount, fetchData])

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const handleApplyFilters = useCallback((f: ScheduleFilters) => {
    setFilters(f)
  }, [])

  const handleLongPress = useCallback((id: string) => {
    setSelectedId(id)
    Alert.alert('Flight Options', undefined, [
      { text: 'Edit', onPress: () => router.push({ pathname: '/(tabs)/network/schedule-flight-detail' as any, params: { id } }) },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (newIds.has(id)) {
          setFlights(prev => prev.filter(f => f._id !== id))
          setNewIds(prev => { const n = new Set(prev); n.delete(id); return n })
        } else {
          setDeletedIds(prev => new Set(prev).add(id))
        }
      }},
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [newIds, router])

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
    <BreadcrumbHeader moduleCode="1" />
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-2" style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <View className="items-center justify-center rounded-lg mr-3"
          style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}>
          <LayoutGrid size={18} color={accent} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Scheduling XL</Text>
          <Text style={{ fontSize: 14, color: palette.textSecondary }}>
            {flights.length} flight{flights.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {/* Scenario selector */}
        {scenarios.length > 0 && (
          <Pressable className="flex-row items-center px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: accentTint(accent, isDark ? 0.1 : 0.05), gap: 4 }}
            onPress={() => {
              Alert.alert('Scenario', 'Select scenario', [
                { text: 'Production', onPress: () => setScenarioId(null) },
                ...scenarios.map(s => ({ text: s.name, onPress: () => setScenarioId(s._id) })),
              ])
            }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: accent }}>
              {scenarioId ? scenarios.find(s => s._id === scenarioId)?.name ?? 'Scenario' : 'Production'}
            </Text>
            <ChevronDown size={14} color={accent} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {/* Toolbar */}
      <ScheduleToolbar
        onAdd={handleAddFlight} onSave={handleSave} onFilter={() => setShowFilter(true)}
        onDeleteSelected={handleDeleteSelected}
        hasDirty={hasDirty} hasSelected={!!selectedId} saving={saving}
        isTablet={isTablet} accent={accent} palette={palette} isDark={isDark} />

      {/* Content */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading schedule...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text style={{ fontSize: 15, color: palette.textSecondary, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : isTablet ? (
        <View className="flex-1 flex-row">
          {/* Left filter panel — tablet only */}
          {showFilter && (
            <View style={{ width: 240, borderRightWidth: 1, borderRightColor: palette.border }}>
              <FilterSidebar filters={filters} onApply={(f) => { setFilters(f) }}
                palette={palette} accent={accent} isDark={isDark} />
            </View>
          )}
          <ScheduleTable
            flights={flights} dirtyMap={dirtyMap} newIds={newIds} deletedIds={deletedIds}
            selectedId={selectedId} onSelect={setSelectedId} onCellEdit={handleCellEdit}
            onLongPress={handleLongPress}
            palette={palette} accent={accent} isDark={isDark}
            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        </View>
      ) : (
        <ScheduleCardList
          flights={flights} dirtyMap={dirtyMap} newIds={newIds} deletedIds={deletedIds}
          onPress={(id) => router.push({ pathname: '/(tabs)/network/schedule-flight-detail' as any, params: { id } })}
          palette={palette} accent={accent} isDark={isDark} />
      )}

      {/* Floating save bar */}
      {hasDirty && (
        <View className="absolute bottom-6 left-4 right-4 flex-row items-center rounded-xl px-4 py-3"
          style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.cardBorder,
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
          <View className="flex-1">
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
              {dirtyCount > 0 ? `${dirtyCount} modified` : ''}
              {dirtyCount > 0 && (newCount > 0 || deleteCount > 0) ? ' · ' : ''}
              {newCount > 0 ? `${newCount} new` : ''}
              {newCount > 0 && deleteCount > 0 ? ' · ' : ''}
              {deleteCount > 0 ? `${deleteCount} deleted` : ''}
            </Text>
          </View>
          <Pressable onPress={handleDiscard} className="px-3 py-2 rounded-lg mr-2 active:opacity-70"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#f87171' : '#dc2626' }}>Discard</Text>
          </Pressable>
          <Pressable onPress={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg active:opacity-70"
            style={{ backgroundColor: accent, opacity: saving ? 0.5 : 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>
      )}

      {/* Filter sheet — phone only (tablet uses sidebar) */}
      {!isTablet && (
        <ScheduleFilterSheet visible={showFilter} onClose={() => setShowFilter(false)}
          filters={filters} onApply={handleApplyFilters}
          palette={palette} accent={accent} isDark={isDark} isTablet={false} />
      )}
    </SafeAreaView>
    </View>
  )
}

/** Persistent filter sidebar for tablet */
function FilterSidebar({ filters, onApply, palette, accent, isDark }: {
  filters: ScheduleFilters; onApply: (f: ScheduleFilters) => void;
  palette: any; accent: string; isDark: boolean
}) {
  const [draft, setDraft] = useState<ScheduleFilters>(filters)

  const STATUSES = ['', 'draft', 'active', 'suspended', 'cancelled']
  const STATUS_LABELS: Record<string, string> = { '': 'All', draft: 'Draft', active: 'Active', suspended: 'Suspended', cancelled: 'Cancelled' }

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 4 }}>Filters</Text>

      <SidebarField label="From" value={draft.dateFrom} placeholder="YYYY-MM-DD"
        onChange={(v) => setDraft(p => ({ ...p, dateFrom: v }))} palette={palette} />
      <SidebarField label="To" value={draft.dateTo} placeholder="YYYY-MM-DD"
        onChange={(v) => setDraft(p => ({ ...p, dateTo: v }))} palette={palette} />
      <SidebarField label="DEP" value={draft.dep} placeholder="ICAO"
        onChange={(v) => setDraft(p => ({ ...p, dep: v.toUpperCase() }))} palette={palette} mono />
      <SidebarField label="ARR" value={draft.arr} placeholder="ICAO"
        onChange={(v) => setDraft(p => ({ ...p, arr: v.toUpperCase() }))} palette={palette} mono />
      <SidebarField label="AC Type" value={draft.acType} placeholder="e.g. A320"
        onChange={(v) => setDraft(p => ({ ...p, acType: v.toUpperCase() }))} palette={palette} mono />

      <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 }}>Status</Text>
      <View style={{ gap: 4 }}>
        {STATUSES.map(s => {
          const active = draft.status === s
          return (
            <Pressable key={s} onPress={() => setDraft(p => ({ ...p, status: s }))}
              className="px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: active ? accentTint(accent, isDark ? 0.15 : 0.08) : 'transparent' }}>
              <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? accent : palette.text }}>
                {STATUS_LABELS[s]}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Pressable onPress={() => onApply(draft)}
        className="items-center py-2.5 rounded-lg mt-2 active:opacity-70"
        style={{ backgroundColor: accent }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Apply</Text>
      </Pressable>
      <Pressable onPress={() => {
        const empty: ScheduleFilters = { dateFrom: '', dateTo: '', dep: '', arr: '', acType: '', status: '' }
        setDraft(empty); onApply(empty)
      }} className="items-center py-2 rounded-lg active:opacity-70">
        <Text style={{ fontSize: 13, fontWeight: '500', color: palette.textSecondary }}>Clear</Text>
      </Pressable>
    </ScrollView>
  )
}

function SidebarField({ label, value, placeholder, onChange, palette, mono }: {
  label: string; value: string; placeholder: string; onChange: (v: string) => void; palette: any; mono?: boolean
}) {
  return (
    <View>
      <Text style={{ fontSize: 11, color: palette.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={palette.textTertiary} autoCapitalize={mono ? 'characters' : 'none'}
        style={{ fontSize: 14, fontWeight: '500', color: palette.text, fontFamily: mono ? 'monospace' : undefined,
          borderWidth: 1, borderColor: palette.cardBorder, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: palette.card }} />
    </View>
  )
}
