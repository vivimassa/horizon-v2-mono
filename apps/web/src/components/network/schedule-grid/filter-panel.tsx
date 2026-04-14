'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FilterPanel as KitFilterPanel,
  FilterSection,
  PeriodField,
  MultiSelectField,
  SelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { useScheduleRefStore } from '@/stores/use-schedule-ref-store'
import { useOperatorStore } from '@/stores/use-operator-store'
import { api } from '@skyhub/api'
import type { AirportRef } from '@skyhub/api'

export interface FilterParams {
  dateFrom: string
  dateTo: string
  depStations: string[] | null
  arrStations: string[] | null
  aircraftType: string
  status: string
}

interface FilterPanelProps {
  onApplyFilters: (filters: FilterParams) => void
  loading?: boolean
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
]

/**
 * 1.1.1 Scheduling XL filter panel — migrated to the shared <FilterPanel>
 * kit. External contract preserved: exports `FilterPanel` (the named
 * component) and `FilterParams` so schedule-grid-shell keeps working.
 * Fields: Period, Departure, Arrival, Aircraft Type, Schedule Status.
 * Go button auto-collapses the dock via the kit's FilterGoButton.
 */
export function FilterPanel({ onApplyFilters, loading }: FilterPanelProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // null = "all" (untouched default). Array = explicit subset.
  const [depSelected, setDepSelected] = useState<string[] | null>(null)
  const [arrSelected, setArrSelected] = useState<string[] | null>(null)
  const [aircraftType, setAircraftType] = useState('')
  const [status, setStatus] = useState('')

  /* ── Airports for dep/arr multi-selects ── */
  const [airports, setAirports] = useState<AirportRef[]>([])
  useEffect(() => {
    api.getAirports().then(setAirports)
  }, [])
  const airportOptions: MultiSelectOption[] = useMemo(
    () => airports.filter((a) => a.iataCode).map((a) => ({ key: a.iataCode!, label: `${a.iataCode} — ${a.name}` })),
    [airports],
  )
  const airportKeys = useMemo(() => airportOptions.map((o) => o.key), [airportOptions])

  /* ── Aircraft types ── */
  const refAcTypes = useScheduleRefStore((s) => s.aircraftTypes)
  const loadRefData = useScheduleRefStore((s) => s.loadAll)
  const refLoaded = useScheduleRefStore((s) => s.loaded)
  const operatorLoaded = useOperatorStore((s) => s.loaded)
  useEffect(() => {
    if (operatorLoaded && !refLoaded) loadRefData()
  }, [operatorLoaded, refLoaded, loadRefData])
  const acTypeOptions = useMemo(
    () => [
      { value: '', label: 'All Types' },
      ...refAcTypes.filter((t) => t.isActive).map((t) => ({ value: t.icaoType, label: t.icaoType })),
    ],
    [refAcTypes],
  )

  const periodMissing = !dateFrom || !dateTo

  const handleGo = useCallback(() => {
    if (periodMissing) return
    onApplyFilters({
      dateFrom,
      dateTo,
      depStations: depSelected,
      arrStations: arrSelected,
      aircraftType,
      status,
    })
  }, [periodMissing, dateFrom, dateTo, depSelected, arrSelected, aircraftType, status, onApplyFilters])

  const activeCount =
    [dateFrom, dateTo].filter(Boolean).length +
    (depSelected !== null ? 1 : 0) +
    (arrSelected !== null ? 1 : 0) +
    (aircraftType ? 1 : 0) +
    (status ? 1 : 0)

  // null-means-all adapters: MultiSelectField wants `value: string[]`.
  // When `*Selected === null`, render as "all keys selected" so the
  // checkboxes appear checked; on any toggle we fold a full set back to
  // null to preserve the "untouched/all" semantic for the caller.
  const depValue = depSelected === null ? airportKeys : depSelected
  const arrValue = arrSelected === null ? airportKeys : arrSelected

  return (
    <KitFilterPanel
      activeCount={activeCount}
      footer={
        <FilterGoButton
          onClick={handleGo}
          loading={loading}
          disabled={periodMissing}
          hint={periodMissing ? 'Select the period to continue' : undefined}
        />
      }
    >
      <FilterSection label="Period">
        <PeriodField from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
      </FilterSection>

      <FilterSection label="Departure">
        <MultiSelectField
          options={airportOptions}
          value={depValue}
          onChange={(keys) => setDepSelected(keys.length === airportKeys.length ? null : keys)}
          allLabel="All Departures"
          searchable
          summaryBy="key"
        />
      </FilterSection>

      <FilterSection label="Arrival">
        <MultiSelectField
          options={airportOptions}
          value={arrValue}
          onChange={(keys) => setArrSelected(keys.length === airportKeys.length ? null : keys)}
          allLabel="All Arrivals"
          searchable
          summaryBy="key"
        />
      </FilterSection>

      <FilterSection label="Aircraft Type">
        <SelectField options={acTypeOptions} value={aircraftType} onChange={setAircraftType} placeholder="All Types" />
      </FilterSection>

      <FilterSection label="Schedule Status">
        <SelectField options={STATUS_OPTIONS} value={status} onChange={setStatus} placeholder="All Statuses" />
      </FilterSection>
    </KitFilterPanel>
  )
}
