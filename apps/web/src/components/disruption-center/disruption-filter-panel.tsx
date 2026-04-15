'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { api, type AirportRef } from '@skyhub/api'
import { FilterPanel } from '@/components/filter-panel/panel'
import {
  FilterSection,
  PeriodField,
  RollingPeriodField,
  SelectField,
  MultiSelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel/fields'
import { useDisruptionStore } from '@/stores/use-disruption-store'
import { CATEGORY_LABEL } from './severity-utils'

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([key, label]) => ({ key, label }))
const SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
]

interface Props {
  onGo: () => void
  loading?: boolean
}

/**
 * Filter panel for Disruption Management — built on the canonical
 * FilterPanel kit used by every ops workspace. Collapses to a rail,
 * surfaces an active-filter count, and the Go button folds both the
 * panel and the bottom dock on submit.
 */
export function DisruptionFilterPanel({ onGo, loading = false }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const filters = useDisruptionStore((s) => s.filters)
  const setFilter = useDisruptionStore((s) => s.setFilter)

  // Match MultiSelectField trigger styling so raw text inputs feel native.
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  // Airport list from master-data — used for the Station dropdown.
  const [airports, setAirports] = useState<AirportRef[]>([])
  useEffect(() => {
    api
      .getAirports()
      .then(setAirports)
      .catch(() => setAirports([]))
  }, [])
  const stationOptions = useMemo<MultiSelectOption[]>(
    () =>
      airports
        .filter((a) => a.iataCode)
        .map((a) => ({ key: a.iataCode as string, label: `${a.iataCode} — ${a.name}` })),
    [airports],
  )

  const categoriesSelected = useMemo(() => (filters.category ? [filters.category] : []), [filters.category])
  const stationSelected = useMemo(() => (filters.station ? [filters.station] : []), [filters.station])

  const rollingActive = filters.rollingPeriodDays !== null
  const activeCount =
    (rollingActive ? 1 : (filters.from ? 1 : 0) + (filters.to ? 1 : 0)) +
    (filters.category ? 1 : 0) +
    (filters.severity ? 1 : 0) +
    (filters.station ? 1 : 0) +
    (filters.flightNumber ? 1 : 0)

  return (
    <FilterPanel
      activeCount={activeCount}
      footer={<FilterGoButton onClick={onGo} loading={loading} label="Scan" loadingLabel="Scanning…" />}
    >
      <FilterSection label="Period">
        <div
          style={{
            opacity: rollingActive ? 0.4 : 1,
            pointerEvents: rollingActive ? 'none' : 'auto',
          }}
        >
          <PeriodField
            from={filters.from ?? ''}
            to={filters.to ?? ''}
            onChangeFrom={(v) => setFilter('from', v || null)}
            onChangeTo={(v) => setFilter('to', v || null)}
          />
        </div>
      </FilterSection>

      <FilterSection label="Rolling Period">
        <RollingPeriodField value={filters.rollingPeriodDays} onChange={(v) => setFilter('rollingPeriodDays', v)} />
      </FilterSection>

      <FilterSection label="Severity">
        <SelectField
          options={SEVERITY_OPTIONS}
          value={filters.severity ?? ''}
          onChange={(v) => setFilter('severity', v || null)}
          placeholder="All severities"
        />
      </FilterSection>

      <FilterSection label="Category">
        <MultiSelectField
          options={CATEGORY_OPTIONS}
          value={categoriesSelected}
          onChange={(keys) => setFilter('category', keys[0] ?? null)}
          allLabel="All categories"
          noneLabel="All categories"
          searchable
          searchPlaceholder="Search categories…"
        />
      </FilterSection>

      <FilterSection label="Station">
        <MultiSelectField
          options={stationOptions}
          value={stationSelected}
          onChange={(keys) => {
            // Single-select semantics — server currently accepts one station.
            const prev = filters.station
            const next = keys.find((k) => k !== prev) ?? null
            setFilter('station', next)
          }}
          allLabel="All stations"
          noneLabel="All stations"
          searchable
          searchPlaceholder="Search stations…"
          summaryBy="key"
        />
      </FilterSection>

      <FilterSection label="Flight number">
        <input
          type="text"
          value={filters.flightNumber ?? ''}
          onChange={(e) => setFilter('flightNumber', e.target.value.toUpperCase() || null)}
          placeholder="Search by flight number"
          className="w-full h-9 px-3 rounded-xl text-[13px] font-medium outline-none text-hz-text placeholder:text-hz-text-tertiary"
          style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
        />
      </FilterSection>
    </FilterPanel>
  )
}
