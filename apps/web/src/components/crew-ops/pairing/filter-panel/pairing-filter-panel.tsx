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
  const positions = usePairingStore((s) => s.positions)
  const positionOptions = useMemo<MultiSelectOption[]>(
    () =>
      [...positions]
        .filter((p) => p.isActive)
        .sort((a, b) => a.rankOrder - b.rankOrder)
        .map((p) => ({ key: p.code, label: `${p.code} — ${p.name}`, color: p.color ?? undefined })),
    [positions],
  )
  const positionKeys = useMemo(() => positionOptions.map((o) => o.key), [positionOptions])

  const selectedBases = draft.baseAirports ?? baseKeys
  const selectedAircraft = draft.aircraftTypes ?? aircraftKeys
  const selectedPositions = draft.positionFilter ?? positionKeys

  const activeCount = mounted
    ? [draftFrom, draftTo].filter(Boolean).length +
      (draft.baseAirports !== null ? 1 : 0) +
      (draft.aircraftTypes !== null ? 1 : 0) +
      (draft.positionFilter !== null && draft.positionFilter.length > 0 ? 1 : 0)
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

      <FilterSection label="Position">
        <MultiSelectField
          options={positionOptions}
          value={selectedPositions}
          onChange={(keys) =>
            setDraftFilters({
              positionFilter: keys.length === positionKeys.length || keys.length === 0 ? null : keys,
            })
          }
          allLabel="All Positions"
        />
      </FilterSection>
    </FilterPanel>
  )
}
