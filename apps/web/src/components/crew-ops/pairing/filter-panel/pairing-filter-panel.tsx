'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  FilterPanel,
  FilterSection,
  PeriodField,
  MultiSelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { usePairingFilterStore } from '@/stores/use-pairing-filter-store'
import { usePairingStore } from '@/stores/use-pairing-store'
import {
  ALL_DURATIONS,
  ALL_STATUS,
  ALL_WORKFLOW,
  type DurationFilterValue,
  type PairingLegalityStatus,
  type PairingWorkflowStatus,
} from '../types'

const STATUS_OPTIONS: MultiSelectOption[] = [
  { key: 'legal', label: 'Legal', color: '#06C270' },
  { key: 'warning', label: 'Warning', color: '#FF8800' },
  { key: 'violation', label: 'Violation', color: '#FF3B3B' },
]

const WORKFLOW_OPTIONS: MultiSelectOption[] = [
  { key: 'draft', label: 'Draft', color: '#3B82F6' },
  { key: 'committed', label: 'Committed', color: '#06C270' },
]

const DURATION_OPTIONS: MultiSelectOption[] = ALL_DURATIONS.map((d) => ({ key: d, label: d.toUpperCase() }))

// Seed values while ref-data fetches are not yet wired.
const SEED_BASES: MultiSelectOption[] = [
  { key: 'SGN', label: 'SGN — Tan Son Nhat' },
  { key: 'HAN', label: 'HAN — Noi Bai' },
  { key: 'DAD', label: 'DAD — Da Nang' },
]
const SEED_AIRCRAFT: MultiSelectOption[] = [
  { key: 'A320', label: 'A320' },
  { key: 'A321', label: 'A321' },
  { key: 'A330', label: 'A330' },
]

interface PairingFilterPanelProps {
  /** Optional override fired when the user hits Go. Defaults to committing
   *  draft → store and setting loading on the pairing store. */
  onGo?: () => void
}

/**
 * Filter panel for 4.1.5 Crew Pairing. Composes SkyHub's shared `<FilterPanel>`
 * kit with pairing-specific fields: Period, Base, Fleet, Pairing Status,
 * Workflow, Duration. Draft state lives in `use-pairing-filter-store`; the Go
 * button commits it to `use-pairing-store` which owns the applied filters.
 */
export function PairingFilterPanel({ onGo }: PairingFilterPanelProps) {
  const draftFrom = usePairingFilterStore((s) => s.draftPeriodFrom)
  const draftTo = usePairingFilterStore((s) => s.draftPeriodTo)
  const draft = usePairingFilterStore((s) => s.draftFilters)
  const setDraftFrom = usePairingFilterStore((s) => s.setDraftFrom)
  const setDraftTo = usePairingFilterStore((s) => s.setDraftTo)
  const setDraftFilters = usePairingFilterStore((s) => s.setDraftFilters)
  const loading = usePairingStore((s) => s.loading)
  const setPeriod = usePairingStore((s) => s.setPeriod)
  const setFilters = usePairingStore((s) => s.setFilters)
  const commitPeriod = usePairingStore((s) => s.commitPeriod)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const baseKeys = useMemo(() => SEED_BASES.map((o) => o.key), [])
  const aircraftKeys = useMemo(() => SEED_AIRCRAFT.map((o) => o.key), [])

  const selectedBases = draft.baseAirports ?? baseKeys
  const selectedAircraft = draft.aircraftTypes ?? aircraftKeys

  const activeCount = mounted
    ? [draftFrom, draftTo].filter(Boolean).length +
      (draft.baseAirports !== null ? 1 : 0) +
      (draft.aircraftTypes !== null ? 1 : 0) +
      (draft.statusFilter.length < ALL_STATUS.length ? 1 : 0) +
      (draft.workflowFilter.length < ALL_WORKFLOW.length ? 1 : 0) +
      (draft.durations.length > 0 ? 1 : 0)
    : 0

  function handleGo() {
    setPeriod(draftFrom, draftTo)
    setFilters(draft)
    setTimeout(() => {
      if (onGo) onGo()
      commitPeriod()
    }, 0)
  }

  return (
    <FilterPanel
      activeCount={activeCount}
      footer={<FilterGoButton onClick={handleGo} loading={loading} disabled={!draftFrom || !draftTo} />}
    >
      <FilterSection label="Period">
        <PeriodField from={draftFrom} to={draftTo} onChangeFrom={setDraftFrom} onChangeTo={setDraftTo} />
      </FilterSection>

      <FilterSection label="Base">
        <MultiSelectField
          options={SEED_BASES}
          value={selectedBases}
          onChange={(keys) => setDraftFilters({ baseAirports: keys.length === baseKeys.length ? null : keys })}
          allLabel="All Bases"
        />
      </FilterSection>

      <FilterSection label="Fleet">
        <MultiSelectField
          options={SEED_AIRCRAFT}
          value={selectedAircraft}
          onChange={(keys) => setDraftFilters({ aircraftTypes: keys.length === aircraftKeys.length ? null : keys })}
          allLabel="All Fleets"
        />
      </FilterSection>

      <FilterSection label="Pairing Status">
        <MultiSelectField
          options={STATUS_OPTIONS}
          value={draft.statusFilter as string[]}
          onChange={(keys) => setDraftFilters({ statusFilter: keys as PairingLegalityStatus[] })}
          allLabel="All Statuses"
        />
      </FilterSection>

      <FilterSection label="Workflow">
        <MultiSelectField
          options={WORKFLOW_OPTIONS}
          value={draft.workflowFilter as string[]}
          onChange={(keys) => setDraftFilters({ workflowFilter: keys as PairingWorkflowStatus[] })}
          allLabel="All Workflow"
        />
      </FilterSection>

      <FilterSection label="Duration">
        <MultiSelectField
          options={DURATION_OPTIONS}
          value={draft.durations as string[]}
          onChange={(keys) => setDraftFilters({ durations: keys as DurationFilterValue[] })}
          allLabel="Any length"
        />
      </FilterSection>
    </FilterPanel>
  )
}
