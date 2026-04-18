'use client'

import { useMemo } from 'react'
import {
  FilterPanel,
  FilterSection,
  PeriodField,
  MultiSelectField,
  SelectField,
  SegmentedField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { useFrequencyAnalysisStore, countActiveFilters, leftPanelDirty } from '@/stores/use-frequency-analysis-store'
import { uniqueAircraftTypes, uniqueServiceTypes, uniqueStationOptions, uniqueRouteOptions } from './compute-frequency'

interface FrequencyAnalysisFilterPanelProps {
  onGo: (dateFrom: string, dateTo: string) => void
  loading?: boolean
}

export function FrequencyAnalysisFilterPanel({ onGo, loading }: FrequencyAnalysisFilterPanelProps) {
  const filters = useFrequencyAnalysisStore((s) => s.filters)
  const committed = useFrequencyAnalysisStore((s) => s.committed)
  const hasLoaded = useFrequencyAnalysisStore((s) => s.hasLoaded)
  const rawRows = useFrequencyAnalysisStore((s) => s.rawRows)
  const acTypeColors = useFrequencyAnalysisStore((s) => s.acTypeColors)

  const setDateRange = useFrequencyAnalysisStore((s) => s.setDateRange)
  const setSelectedTypes = useFrequencyAnalysisStore((s) => s.setSelectedTypes)
  const setSelectedStation = useFrequencyAnalysisStore((s) => s.setSelectedStation)
  const setSelectedRoute = useFrequencyAnalysisStore((s) => s.setSelectedRoute)
  const setSelectedRouteType = useFrequencyAnalysisStore((s) => s.setSelectedRouteType)
  const setSelectedServiceType = useFrequencyAnalysisStore((s) => s.setSelectedServiceType)
  const setSortBy = useFrequencyAnalysisStore((s) => s.setSortBy)

  const typeOptions: MultiSelectOption[] = useMemo(() => {
    return uniqueAircraftTypes(rawRows).map((code) => ({
      key: code,
      label: code,
      color: acTypeColors.get(code),
    }))
  }, [rawRows, acTypeColors])

  const stationOptions = useMemo(() => {
    return [{ value: '', label: 'All stations' }].concat(
      uniqueStationOptions(rawRows).map((s) => ({ value: s, label: s })),
    )
  }, [rawRows])

  const routeOptions = useMemo(() => {
    return [{ value: '', label: 'All routes' }].concat(uniqueRouteOptions(rawRows).map((r) => ({ value: r, label: r })))
  }, [rawRows])

  const serviceOptions = useMemo(() => {
    return [{ value: '', label: 'All services' }].concat(
      uniqueServiceTypes(rawRows).map((s) => ({ value: s, label: s })),
    )
  }, [rawRows])

  const activeCount = countActiveFilters(filters)
  const selectedTypesArr = useMemo(() => [...filters.selectedTypes], [filters.selectedTypes])
  const dirty = hasLoaded && leftPanelDirty(filters, committed)

  return (
    <FilterPanel
      title="Filters"
      activeCount={activeCount}
      footer={
        <FilterGoButton
          loading={loading}
          onClick={() => onGo(filters.dateFrom, filters.dateTo)}
          label={hasLoaded ? (dirty ? 'Apply & Reload' : 'Run Analysis') : 'Run Analysis'}
          loadingLabel="Loading…"
          hint={dirty ? 'Filters changed — click to apply.' : undefined}
        />
      }
    >
      <FilterSection label="Period">
        <PeriodField
          from={filters.dateFrom}
          to={filters.dateTo}
          onChangeFrom={(v) => setDateRange(v, filters.dateTo)}
          onChangeTo={(v) => setDateRange(filters.dateFrom, v)}
        />
      </FilterSection>

      <FilterSection label="Aircraft Type">
        <MultiSelectField
          options={typeOptions}
          value={selectedTypesArr}
          onChange={(keys) => setSelectedTypes(new Set(keys))}
          allLabel="All types"
          noneLabel="All types"
          placeholder="Select types…"
          searchable
          summaryBy="key"
          summaryMax={4}
        />
      </FilterSection>

      <FilterSection label="Station">
        <SelectField
          options={stationOptions}
          value={filters.selectedStation}
          onChange={setSelectedStation}
          placeholder="All stations"
        />
      </FilterSection>

      <FilterSection label="Route">
        <SelectField
          options={routeOptions}
          value={filters.selectedRoute}
          onChange={setSelectedRoute}
          placeholder="All routes"
        />
      </FilterSection>

      <FilterSection label="Flight Type">
        <SegmentedField
          options={[
            { key: 'all', label: 'All' },
            { key: 'domestic', label: 'DOM' },
            { key: 'international', label: 'INT' },
          ]}
          value={filters.selectedRouteType}
          onChange={setSelectedRouteType}
        />
      </FilterSection>

      <FilterSection label="Service">
        <SelectField
          options={serviceOptions}
          value={filters.selectedServiceType}
          onChange={setSelectedServiceType}
          placeholder="All services"
        />
      </FilterSection>

      <FilterSection label="Sort Detail By">
        <SegmentedField
          options={[
            { key: 'freq', label: 'Freq' },
            { key: 'flight', label: 'Flight' },
            { key: 'block', label: 'Block' },
          ]}
          value={filters.sortBy}
          onChange={setSortBy}
        />
      </FilterSection>
    </FilterPanel>
  )
}
