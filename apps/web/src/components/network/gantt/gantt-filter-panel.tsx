'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  FilterPanel,
  FilterSection,
  PeriodField,
  RollingPeriodField,
  MultiSelectField,
  SegmentedField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { useGanttStore } from '@/stores/use-gantt-store'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useOperatorStore } from '@/stores/use-operator-store'

const SCHEDULE_STATUS_OPTIONS: MultiSelectOption[] = [
  { key: 'draft', label: 'Draft', color: '#3B82F6' },
  { key: 'active', label: 'Active', color: '#06C270' },
  { key: 'suspended', label: 'Suspended', color: '#FF8800' },
  { key: 'cancelled', label: 'Cancelled', color: '#FF3B3B' },
]
const SCHEDULE_STATUS_KEYS = SCHEDULE_STATUS_OPTIONS.map((o) => o.key)

const FLEET_SORT_OPTIONS = [
  { key: 'type', label: 'Type' },
  { key: 'registration', label: 'Reg' },
  { key: 'utilization', label: 'Util' },
] as const

const COLOR_MODE_OPTIONS = [
  { key: 'status', label: 'Status' },
  { key: 'ac_type', label: 'AC Type' },
] as const

type FleetSort = (typeof FLEET_SORT_OPTIONS)[number]['key']
type ColorMode = (typeof COLOR_MODE_OPTIONS)[number]['key']

interface GanttFilterPanelProps {
  forceCollapsed?: boolean
  onGo?: () => void
  mode?: 'network' | 'ops'
}

/**
 * Filter panel for 1.1.2 Gantt Chart and (via MovementControlShell) 2.1.1
 * Movement Control. Previously a 457-line custom panel; now composes the
 * shared `<FilterPanel>` kit. Fields: Period, Aircraft Type, Schedule
 * Status, Fleet Sort Order, Color Mode. Go button is wired through
 * FilterGoButton which auto-collapses the dock.
 */
export function GanttFilterPanel({
  forceCollapsed: _forceCollapsed = false,
  onGo,
  mode = 'network',
}: GanttFilterPanelProps) {
  /* ── Store bindings ── */
  const storePeriodFrom = useGanttStore((s) => s.periodFrom)
  const storePeriodTo = useGanttStore((s) => s.periodTo)
  const loading = useGanttStore((s) => s.loading)
  const aircraft = useGanttStore((s) => s.aircraft)
  const colorMode = useGanttStore((s) => s.colorMode)
  const fleetSortOrder = useGanttStore((s) => s.fleetSortOrder)
  const rollingPeriodDays = useGanttStore((s) => s.rollingPeriodDays)
  const setRollingPeriod = useGanttStore((s) => s.setRollingPeriod)
  const setPeriod = useGanttStore((s) => s.setPeriod)
  const commitPeriod = useGanttStore((s) => s.commitPeriod)
  const setColorMode = useGanttStore((s) => s.setColorMode)
  const setFleetSortOrder = useGanttStore((s) => s.setFleetSortOrder)
  const setAcTypeFilter = useGanttStore((s) => s.setAcTypeFilter)
  const setStatusFilter = useGanttStore((s) => s.setStatusFilter)

  const isOps = mode === 'ops'
  const rollingActive = isOps && rollingPeriodDays !== null

  /* ── AC types from ref store — loaded independently of flights ── */
  const refAcTypes = useScheduleRefStore((s) => s.aircraftTypes)
  const loadRefData = useScheduleRefStore((s) => s.loadAll)
  const refLoaded = useScheduleRefStore((s) => s.loaded)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  useEffect(() => {
    if (operatorLoaded && !refLoaded) loadRefData()
  }, [operatorLoaded, refLoaded, loadRefData])

  const acTypeOptions: MultiSelectOption[] = useMemo(
    () => refAcTypes.filter((t) => t.isActive).map((t) => ({ key: t.icaoType, label: t.icaoType })),
    [refAcTypes],
  )
  const acTypeKeys = useMemo(() => acTypeOptions.map((o) => o.key), [acTypeOptions])

  // Silence unused-lint on the aircraft selector; keeps the subscription
  // warm so counts elsewhere in the app stay fresh during filter changes.
  void aircraft

  /* ── Draft state (period + multi-selects) — pushed to store on Go ── */
  const [draftFrom, setDraftFrom] = useState(storePeriodFrom)
  const [draftTo, setDraftTo] = useState(storePeriodTo)

  // When rolling period is active, the store drives the dates — mirror them.
  useEffect(() => {
    if (rollingActive) {
      setDraftFrom(storePeriodFrom)
      setDraftTo(storePeriodTo)
    }
  }, [rollingActive, storePeriodFrom, storePeriodTo])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(SCHEDULE_STATUS_KEYS)
  const [selectedTypes, setSelectedTypes] = useState<string[] | null>(null) // null = all

  const selectedTypeKeys = selectedTypes ?? acTypeKeys

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const activeCount = mounted
    ? [draftFrom, draftTo].filter(Boolean).length +
      (selectedTypes !== null ? 1 : 0) +
      (selectedStatuses.length < SCHEDULE_STATUS_KEYS.length ? 1 : 0)
    : 0

  function handleGo() {
    // Sync drafts to store, then commit.
    setPeriod(draftFrom, draftTo)
    setAcTypeFilter(selectedTypes && selectedTypes.length < acTypeKeys.length ? selectedTypes : null)
    const allStatuses = selectedStatuses.length === SCHEDULE_STATUS_KEYS.length
    setStatusFilter(allStatuses ? null : selectedStatuses)
    // Defer commit so the store updates above land first.
    setTimeout(() => {
      ;(onGo ?? commitPeriod)()
    }, 0)
  }

  return (
    <FilterPanel
      activeCount={activeCount}
      footer={<FilterGoButton onClick={handleGo} loading={loading} disabled={!draftFrom || !draftTo} />}
    >
      <FilterSection label="Period">
        <div
          style={{
            opacity: rollingActive ? 0.4 : 1,
            pointerEvents: rollingActive ? 'none' : 'auto',
          }}
        >
          <PeriodField from={draftFrom} to={draftTo} onChangeFrom={setDraftFrom} onChangeTo={setDraftTo} />
        </div>
      </FilterSection>

      {isOps && (
        <FilterSection label="Rolling Period">
          <RollingPeriodField value={rollingPeriodDays} onChange={setRollingPeriod} />
        </FilterSection>
      )}

      <FilterSection label="Aircraft Type">
        <MultiSelectField
          options={acTypeOptions}
          value={selectedTypeKeys}
          onChange={(keys) => {
            // null-means-all semantics: full selection collapses to null.
            setSelectedTypes(keys.length === acTypeKeys.length ? null : keys)
          }}
          allLabel="All Types"
        />
      </FilterSection>

      <FilterSection label="Schedule Status">
        <MultiSelectField
          options={SCHEDULE_STATUS_OPTIONS}
          value={selectedStatuses}
          onChange={setSelectedStatuses}
          allLabel="All Statuses"
        />
      </FilterSection>

      <FilterSection label="Fleet Sort Order">
        <SegmentedField<FleetSort>
          options={FLEET_SORT_OPTIONS as unknown as { key: FleetSort; label: string }[]}
          value={fleetSortOrder as FleetSort}
          onChange={setFleetSortOrder}
        />
      </FilterSection>

      <FilterSection label="Color Mode">
        <SegmentedField<ColorMode>
          options={COLOR_MODE_OPTIONS as unknown as { key: ColorMode; label: string }[]}
          value={colorMode as ColorMode}
          onChange={setColorMode}
        />
      </FilterSection>
    </FilterPanel>
  )
}
