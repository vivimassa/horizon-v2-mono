import { useState, useCallback, useMemo, useEffect } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, Pressable, Alert } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { api, type ScheduledFlightRef, type ScenarioRef, type AirportRef } from '@skyhub/api'
import { LayoutGrid } from 'lucide-react-native'
import { accentTint } from '@skyhub/ui/theme'
import { FilterPanel, FilterSection, DateRangePicker, DropdownSelect, MultiSelect } from '@skyhub/ui'
import { useAppTheme } from '../../../providers/ThemeProvider'
import { useDevice } from '../../../hooks/useDevice'
import { BreadcrumbHeader } from '../../../components/breadcrumb-header'
import { useOperatorId } from '../../../hooks/useOperatorId'
import { ScheduleToolbar } from '../../../components/schedule/schedule-toolbar'
import { RibbonToolbar } from '../../../components/schedule/ribbon-toolbar'
import { ScheduleGrid } from '../../../components/schedule/schedule-grid'
import { ScheduleTable } from '../../../components/schedule/schedule-table'
import { ScheduleCardList } from '../../../components/schedule/schedule-card-list'
import { Modal, ScrollView } from 'react-native'
import { ContextMenu } from '../../../components/schedule/context-menu'
import { FindReplaceDialog } from '../../../components/schedule/find-replace-dialog'
import { ScenarioPanel } from '../../../components/schedule/scenario-panel'
import { ImportDialog } from '../../../components/schedule/import-dialog'
import { ExportDialog } from '../../../components/schedule/export-dialog'
import { FloatingSaveBar } from '../../../components/schedule/floating-save-bar'
import { useScheduleGridStore } from '../../../stores/useScheduleGridStore'

export default function ScheduleGridScreen() {
  const { palette, isDark, accent } = useAppTheme()
  const { isTablet } = useDevice()
  const operatorId = useOperatorId()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // Data
  const [flights, setFlights] = useState<ScheduledFlightRef[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRef[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editing state
  const [dirtyMap, setDirtyMap] = useState<Map<string, Partial<ScheduledFlightRef>>>(new Map())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Dialogs
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showScenarioPanel, setShowScenarioPanel] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [depStations, setDepStations] = useState<Set<string> | null>(null)
  const [arrStations, setArrStations] = useState<Set<string> | null>(null)
  const [acTypeFilter, setAcTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilter, setShowFilter] = useState(true)
  const [scenarioId, setScenarioId] = useState<string | null>(null)

  // Reference data for filter dropdowns
  const [airports, setAirports] = useState<AirportRef[]>([])
  const [acTypes, setAcTypes] = useState<string[]>([])
  const [sortKey, setSortKey] = useState('sortOrder')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Sync store dirty state back to local state for save operations (tablet)
  useEffect(() => {
    if (!isTablet) return
    const unsub = useScheduleGridStore.subscribe((state) => {
      setDirtyMap(state.dirtyMap)
      setNewIds(state.newRowIds)
      setDeletedIds(state.deletedIds)
    })
    return unsub
  }, [isTablet])

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!operatorId) return
    setLoading(true)
    setError(null)
    try {
      const params: any = { operatorId }
      if (scenarioId) params.scenarioId = scenarioId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (depStations) params.depStation = [...depStations].join(',')
      if (arrStations) params.arrStation = [...arrStations].join(',')
      if (acTypeFilter) params.aircraftTypeIcao = acTypeFilter
      if (statusFilter) params.status = statusFilter
      if (sortKey) {
        params.sortBy = sortKey
        params.sortDir = sortDir
      }

      const f = await api.getScheduledFlights(params)
      setFlights(f)
      // Sync to Zustand store for grid
      const gridStore = useScheduleGridStore.getState()
      gridStore.setRows(f)
      gridStore.setFilterPeriod(dateFrom, dateTo)
      gridStore.clearSeparators()
      for (const flight of f) {
        if ((flight.formatting as any)?.separatorBelow) gridStore.addSeparator(flight._id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule')
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [operatorId, scenarioId, dateFrom, dateTo, depStations, arrStations, acTypeFilter, statusFilter, sortKey, sortDir])

  // Fetch reference data + scenarios on mount — flights load on user Apply
  useFocusEffect(
    useCallback(() => {
      if (!operatorId) return
      Promise.all([api.getScenarios({ operatorId }), api.getAirports(), api.getAircraftTypes()])
        .then(([s, ap, at]) => {
          setScenarios(s)
          setAirports(ap)
          setAcTypes([...new Set(at.filter((t) => t.isActive).map((t) => t.icaoType))].sort())
        })
        .catch(() => {})
    }, [operatorId]),
  )

  // Dirty tracking
  const hasDirty = dirtyMap.size > 0 || newIds.size > 0 || deletedIds.size > 0
  const dirtyCount = dirtyMap.size
  const newCount = newIds.size
  const deleteCount = deletedIds.size

  // Active filter count for badge
  const activeFilterCount = [
    dateFrom,
    dateTo,
    depStations !== null ? 'x' : '',
    arrStations !== null ? 'x' : '',
    acTypeFilter,
    statusFilter,
  ].filter(Boolean).length

  // Reference data for dropdowns
  const airportItems = useMemo(
    () => airports.map((a) => ({ key: a.icaoCode, label: `${a.icaoCode} ${a.name}` })),
    [airports],
  )
  const acTypeOptions = useMemo(
    () => [{ value: '', label: 'All Types' }, ...acTypes.map((t) => ({ value: t, label: t }))],
    [acTypes],
  )
  const statusOptions = useMemo(
    () => [
      { value: '', label: 'All Statuses' },
      { value: 'draft', label: 'Draft', color: '#6b7280' },
      { value: 'active', label: 'Active', color: '#16a34a' },
      { value: 'suspended', label: 'Suspended', color: '#f59e0b' },
      { value: 'cancelled', label: 'Cancelled', color: '#dc2626' },
    ],
    [],
  )

  const handleCellEdit = useCallback((id: string, key: string, value: any) => {
    setDirtyMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(id) ?? {}
      next.set(id, { ...existing, [key]: value })
      return next
    })
  }, [])

  const handleAddFlight = useCallback(() => {
    const id = `new_${Date.now()}`
    const newFlight: ScheduledFlightRef = {
      _id: id,
      operatorId,
      seasonCode: '',
      airlineCode: '',
      flightNumber: '',
      suffix: null,
      depStation: '',
      arrStation: '',
      depAirportId: null,
      arrAirportId: null,
      stdUtc: '',
      staUtc: '',
      stdLocal: null,
      staLocal: null,
      blockMinutes: null,
      departureDayOffset: 1,
      arrivalDayOffset: 1,
      daysOfWeek: '1234567',
      aircraftTypeId: null,
      aircraftTypeIcao: null,
      aircraftReg: null,
      serviceType: 'J',
      status: 'draft',
      previousStatus: null,
      effectiveFrom: dateFrom,
      effectiveUntil: dateTo,
      cockpitCrewRequired: null,
      cabinCrewRequired: null,
      isEtops: false,
      isOverwater: false,
      isActive: true,
      scenarioId: scenarioId,
      rotationId: null,
      rotationSequence: null,
      rotationLabel: null,
      source: 'manual',
      sortOrder: flights.length,
      formatting: {},
      createdAt: null,
      updatedAt: null,
    }
    setFlights((prev) => [...prev, newFlight])
    setNewIds((prev) => new Set(prev).add(id))
    setSelectedId(id)

    // On phone, navigate to detail immediately
    if (!isTablet) {
      router.push({ pathname: '/(tabs)/network/schedule-flight-detail' as any, params: { id, isNew: '1' } })
    }
  }, [operatorId, scenarioId, flights.length, isTablet, router, dateFrom, dateTo])

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return
    if (newIds.has(selectedId)) {
      // Remove unsaved new row
      setFlights((prev) => prev.filter((f) => f._id !== selectedId))
      setNewIds((prev) => {
        const n = new Set(prev)
        n.delete(selectedId)
        return n
      })
      setDirtyMap((prev) => {
        const n = new Map(prev)
        n.delete(selectedId)
        return n
      })
    } else {
      setDeletedIds((prev) => new Set(prev).add(selectedId))
    }
    setSelectedId(null)
  }, [selectedId, newIds])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      // Delete
      const toDelete = [...deletedIds].filter((id) => !newIds.has(id))
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
        .filter((f) => newIds.has(f._id) && !deletedIds.has(f._id))
        .map((f) => {
          const dirty = dirtyMap.get(f._id)
          const merged = { ...f, ...dirty }
          const { _id, ...rest } = merged
          return rest
        })
        .filter((f) => f.flightNumber && f.depStation && f.arrStation)
      if (toCreate.length > 0) await api.createScheduledFlightsBulk(toCreate)

      // Reset state and refresh
      setDirtyMap(new Map())
      setNewIds(new Set())
      setDeletedIds(new Set())
      await fetchData()
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }, [dirtyMap, newIds, deletedIds, flights, fetchData])

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Changes', `Discard ${dirtyCount + newCount + deleteCount} pending changes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setDirtyMap(new Map())
          setNewIds(new Set())
          setDeletedIds(new Set())
          fetchData()
        },
      },
    ])
  }, [dirtyCount, newCount, deleteCount, fetchData])

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey],
  )

  const handleLongPress = useCallback(
    (id: string) => {
      setSelectedId(id)
      if (isTablet) {
        setShowContextMenu(true)
      } else {
        Alert.alert('Flight Options', undefined, [
          {
            text: 'Edit',
            onPress: () => router.push({ pathname: '/(tabs)/network/schedule-flight-detail' as any, params: { id } }),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (newIds.has(id)) {
                setFlights((prev) => prev.filter((f) => f._id !== id))
                setNewIds((prev) => {
                  const n = new Set(prev)
                  n.delete(id)
                  return n
                })
              } else {
                setDeletedIds((prev) => new Set(prev).add(id))
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ])
      }
    },
    [newIds, router, isTablet],
  )

  const handleFindReplace = useCallback((id: string, colKey: string, value: string) => {
    setDirtyMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(id) ?? {}
      next.set(id, { ...existing, [colKey]: value })
      return next
    })
  }, [])

  const handleContextInsertRow = useCallback(() => {
    handleAddFlight()
  }, [handleAddFlight])

  const handleContextSeparateCycle = useCallback(() => {
    if (!selectedId) return
    const store = useScheduleGridStore.getState()
    store.addSeparator(selectedId)
  }, [selectedId])

  const handleContextChangeStatus = useCallback(
    (status: string) => {
      if (!selectedId) return
      setDirtyMap((prev) => {
        const next = new Map(prev)
        const existing = next.get(selectedId) ?? {}
        next.set(selectedId, { ...existing, status: status as ScheduledFlightRef['status'] })
        return next
      })
    },
    [selectedId],
  )

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <BreadcrumbHeader moduleCode="1" />
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={[]}>
        {/* ── Phone layout: header + toolbar + card list ── */}
        {!isTablet && (
          <>
            <View
              className="flex-row items-center px-4 pt-2 pb-2"
              style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
            >
              <View
                className="items-center justify-center rounded-lg mr-3"
                style={{ width: 36, height: 36, backgroundColor: accentTint(accent, isDark ? 0.15 : 0.1) }}
              >
                <LayoutGrid size={18} color={accent} strokeWidth={1.8} />
              </View>
              <View className="flex-1">
                <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Scheduling XL</Text>
                <Text style={{ fontSize: 14, color: palette.textSecondary }}>
                  {flights.length} flight{flights.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <ScheduleToolbar
              onAdd={handleAddFlight}
              onSave={handleSave}
              onFilter={() => setShowFilter(true)}
              onDeleteSelected={handleDeleteSelected}
              hasDirty={hasDirty}
              hasSelected={!!selectedId}
              saving={saving}
              isTablet={false}
              accent={accent}
              palette={palette}
              isDark={isDark}
            />
            {loading ? (
              <View className="flex-1 justify-center items-center">
                <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading schedule...</Text>
              </View>
            ) : (
              <ScheduleCardList
                flights={flights}
                dirtyMap={dirtyMap}
                newIds={newIds}
                deletedIds={deletedIds}
                onPress={(id) =>
                  router.push({ pathname: '/(tabs)/network/schedule-flight-detail' as any, params: { id } })
                }
                palette={palette}
                accent={accent}
                isDark={isDark}
              />
            )}
          </>
        )}

        {/* ── Tablet layout: filter panel (left) + main content (right) ── */}
        {isTablet && (
          <View className="flex-1 flex-row" style={{ gap: 0, paddingBottom: Math.max(40, insets.bottom + 20) }}>
            {/* Left filter panel — always visible */}
            <FilterPanel
              onApply={fetchData}
              applyDisabled={!dateFrom || !dateTo}
              loading={loading}
              activeCount={activeFilterCount}
              bottomInset={insets.bottom}
              accent={accent}
              palette={palette}
              isDark={isDark}
            >
              <FilterSection label="Period" palette={palette}>
                <DateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onChangeFrom={setDateFrom}
                  onChangeTo={setDateTo}
                  accent={accent}
                  palette={palette}
                  isDark={isDark}
                />
              </FilterSection>
              <FilterSection label="Departure" palette={palette}>
                <MultiSelect
                  items={airportItems}
                  value={depStations}
                  onChange={setDepStations}
                  allLabel="All Departures"
                  accent={accent}
                  palette={palette}
                  isDark={isDark}
                />
              </FilterSection>
              <FilterSection label="Arrival" palette={palette}>
                <MultiSelect
                  items={airportItems}
                  value={arrStations}
                  onChange={setArrStations}
                  allLabel="All Arrivals"
                  accent={accent}
                  palette={palette}
                  isDark={isDark}
                />
              </FilterSection>
              <FilterSection label="Aircraft Type" palette={palette}>
                <DropdownSelect
                  options={acTypeOptions}
                  value={acTypeFilter || null}
                  onChange={setAcTypeFilter}
                  placeholder="All Types"
                  accent={accent}
                  palette={palette}
                  isDark={isDark}
                />
              </FilterSection>
              <FilterSection label="Status" palette={palette}>
                <DropdownSelect
                  options={statusOptions}
                  value={statusFilter || null}
                  onChange={setStatusFilter}
                  placeholder="All Statuses"
                  accent={accent}
                  palette={palette}
                  isDark={isDark}
                />
              </FilterSection>
            </FilterPanel>

            {/* Right: main content area */}
            <View className="flex-1" style={{ padding: hasLoaded && !loading ? 0 : 8, paddingBottom: 8 }}>
              {/* Before first load: empty panel with system logo */}
              {!hasLoaded && !loading && (
                <View
                  className="flex-1 justify-center items-center rounded-2xl"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <View style={{ opacity: 0.08, marginBottom: 20 }}>
                    <LayoutGrid size={80} color={palette.text} strokeWidth={0.8} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: palette.textTertiary }}>
                    Set filters and press Go to load schedule
                  </Text>
                </View>
              )}

              {/* Loading state */}
              {loading && (
                <View className="flex-1 justify-center items-center">
                  <Text style={{ fontSize: 15, color: palette.textTertiary }}>Loading schedule...</Text>
                </View>
              )}

              {/* After loaded: ribbon + grid */}
              {hasLoaded && !loading && (
                <>
                  {/* Ribbon toolbar */}
                  <RibbonToolbar
                    onAddFlight={handleAddFlight}
                    onInsertFlight={handleAddFlight}
                    onDeleteFlight={handleDeleteSelected}
                    onSave={handleSave}
                    onImport={() => setShowImport(true)}
                    onExport={() => setShowExport(true)}
                    onScenario={() => setShowScenarioPanel(true)}
                    onMessage={undefined}
                    onFind={() => setShowFindReplace(true)}
                    onReplace={() => setShowFindReplace(true)}
                    onSaveAs={undefined}
                    hasDirty={hasDirty}
                    hasSelection={!!selectedId}
                    saving={saving}
                    palette={palette}
                    accent={accent}
                    isDark={isDark}
                  />

                  {/* Grid */}
                  <View style={{ flex: 1, position: 'relative' }}>
                    <ScheduleGrid
                      flights={flights}
                      onLongPress={handleLongPress}
                      palette={palette}
                      accent={accent}
                      isDark={isDark}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />

                    {/* Find/Replace — overlays top-right of grid */}
                    <FindReplaceDialog
                      visible={showFindReplace}
                      onClose={() => setShowFindReplace(false)}
                      flights={flights}
                      dirtyMap={dirtyMap}
                      onReplace={handleFindReplace}
                      palette={palette}
                      accent={accent}
                      isDark={isDark}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Floating save bar */}
        {hasDirty && (
          <FloatingSaveBar
            dirtyCount={dirtyCount}
            newCount={newCount}
            deleteCount={deleteCount}
            saving={saving}
            onSave={handleSave}
            onDiscard={handleDiscard}
            palette={palette}
            accent={accent}
            isDark={isDark}
          />
        )}

        {/* Filter sheet — phone only (uses Modal with new components) */}
        {!isTablet && showFilter && (
          <PhoneFilterModal
            visible={showFilter}
            onClose={() => setShowFilter(false)}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChangeFrom={setDateFrom}
            onChangeTo={setDateTo}
            acTypeFilter={acTypeFilter}
            onChangeAcType={setAcTypeFilter}
            statusFilter={statusFilter}
            onChangeStatus={setStatusFilter}
            acTypeOptions={acTypeOptions}
            statusOptions={statusOptions}
            onApply={() => {
              fetchData()
              setShowFilter(false)
            }}
            applyDisabled={!dateFrom || !dateTo}
            accent={accent}
            palette={palette}
            isDark={isDark}
          />
        )}

        {/* Context menu — tablet only */}
        <ContextMenu
          visible={showContextMenu}
          onClose={() => setShowContextMenu(false)}
          onCopy={() => useScheduleGridStore.getState().copyCell()}
          onCut={() => useScheduleGridStore.getState().cutCell()}
          onPaste={() => useScheduleGridStore.getState().pasteCell()}
          onInsertRow={handleContextInsertRow}
          onSeparateCycle={handleContextSeparateCycle}
          onChangeStatus={handleContextChangeStatus}
          onDeleteRow={handleDeleteSelected}
          palette={palette}
          isDark={isDark}
        />

        {/* Scenario panel */}
        <ScenarioPanel
          visible={showScenarioPanel}
          onClose={() => setShowScenarioPanel(false)}
          scenarios={scenarios}
          activeScenarioId={scenarioId}
          onSelect={(id) => setScenarioId(id)}
          onRefresh={fetchData}
          operatorId={operatorId}
          palette={palette}
          accent={accent}
          isDark={isDark}
        />

        {/* Import/Export */}
        <ImportDialog
          visible={showImport}
          onClose={() => setShowImport(false)}
          onImportComplete={fetchData}
          operatorId={operatorId}
          scenarioId={scenarioId}
          palette={palette}
          accent={accent}
          isDark={isDark}
          apiBaseUrl="http://localhost:3002"
        />
        <ExportDialog
          visible={showExport}
          onClose={() => setShowExport(false)}
          operatorId={operatorId}
          scenarioId={scenarioId}
          palette={palette}
          accent={accent}
          isDark={isDark}
        />
      </SafeAreaView>
    </View>
  )
}

/** Phone filter modal — uses the same DateRangePicker and DropdownSelect */
function PhoneFilterModal({
  visible,
  onClose,
  dateFrom,
  dateTo,
  onChangeFrom,
  onChangeTo,
  acTypeFilter,
  onChangeAcType,
  statusFilter,
  onChangeStatus,
  acTypeOptions,
  statusOptions,
  onApply,
  applyDisabled,
  accent,
  palette,
  isDark,
}: {
  visible: boolean
  onClose: () => void
  dateFrom: string
  dateTo: string
  onChangeFrom: (v: string) => void
  onChangeTo: (v: string) => void
  acTypeFilter: string
  onChangeAcType: (v: string) => void
  statusFilter: string
  onChangeStatus: (v: string) => void
  acTypeOptions: { value: string; label: string }[]
  statusOptions: { value: string; label: string; color?: string }[]
  onApply: () => void
  applyDisabled: boolean
  accent: string
  palette: any
  isDark: boolean
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View
          style={{
            flex: 1,
            marginTop: 80,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: palette.background,
          }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-4 pt-4 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Filter Schedule</Text>
            <Pressable onPress={onClose} className="p-2 active:opacity-60">
              <Text style={{ fontSize: 15, color: palette.textSecondary }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <FilterSection label="Period" palette={palette}>
              <DateRangePicker
                from={dateFrom}
                to={dateTo}
                onChangeFrom={onChangeFrom}
                onChangeTo={onChangeTo}
                accent={accent}
                palette={palette}
                isDark={isDark}
              />
            </FilterSection>
            <FilterSection label="Aircraft Type" palette={palette}>
              <DropdownSelect
                options={acTypeOptions}
                value={acTypeFilter || null}
                onChange={onChangeAcType}
                placeholder="All Types"
                accent={accent}
                palette={palette}
                isDark={isDark}
              />
            </FilterSection>
            <FilterSection label="Status" palette={palette}>
              <DropdownSelect
                options={statusOptions}
                value={statusFilter || null}
                onChange={onChangeStatus}
                placeholder="All Statuses"
                accent={accent}
                palette={palette}
                isDark={isDark}
              />
            </FilterSection>
          </ScrollView>

          {/* Footer */}
          <View style={{ padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: palette.border }}>
            {applyDisabled && (
              <Text
                style={{ fontSize: 13, color: isDark ? '#f87171' : '#dc2626', marginBottom: 8, textAlign: 'center' }}
              >
                Select the period to continue
              </Text>
            )}
            <Pressable
              onPress={onApply}
              disabled={applyDisabled}
              className="items-center justify-center rounded-xl active:opacity-70"
              style={{ height: 48, backgroundColor: accent, opacity: applyDisabled ? 0.5 : 1 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Go</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
