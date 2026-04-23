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
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface PairingFilterPanelProps {
  /** Optional override fired when the user hits Go. Defaults to committing
   *  draft → store and setting loading on the pairing store. */
  onGo?: () => void
}

/**
 * Filter panel for 4.1.5 Crew Pairing. Visually 1:1 with 4.1.6.2 Crew Schedule
 * Gantt — pulls real reference data (bases, A/C types) from
 * `useCrewScheduleStore.context`. Draft state lives in `usePairingFilterStore`;
 * the Go button commits it into `usePairingStore`.
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

  // Shared reference data (bases, acTypes) — same source as 4.1.6.2.
  const context = useCrewScheduleStore((s) => s.context)
  const loadContext = useCrewScheduleStore((s) => s.loadContext)
  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Positions — pairing store owns these; pairing filter keys are `code`.
  const positions = usePairingStore((s) => s.positions)
  const positionOptions = useMemo<MultiSelectOption[]>(
    () =>
      [...positions]
        .filter((p) => p.isActive)
        .sort((a, b) => {
          if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
          return (a.rankOrder ?? 9999) - (b.rankOrder ?? 9999)
        })
        .map((p) => ({ key: p.code, label: `${p.code} · ${p.name}`, color: p.color ?? undefined })),
    [positions],
  )

  // Bases — key is IATA code (matches pairing consumer `p.baseAirport`).
  // Label is code-only to match 4.1.6.1 / 4.1.6.2.
  const baseOptions = useMemo<MultiSelectOption[]>(
    () =>
      context.bases
        .filter((b) => !!b.iataCode)
        .map((b) => ({ key: b.iataCode as string, label: b.iataCode as string })),
    [context.bases],
  )

  // A/C types — key is ICAO (matches `api.getPairingFlightPool({ aircraftTypes })`).
  const acTypeOptions = useMemo<MultiSelectOption[]>(
    () => context.acTypes.map((t) => ({ key: t, label: t })),
    [context.acTypes],
  )

  const crewGroupOptions = useMemo<MultiSelectOption[]>(
    () => context.crewGroups.map((g) => ({ key: g._id, label: g.name })),
    [context.crewGroups],
  )

  const selectedBases = draft.baseAirports ?? []
  const selectedAircraft = draft.aircraftTypes ?? []
  const selectedPositions = draft.positionFilter ?? []
  const selectedCrewGroups = draft.crewGroupIds ?? []

  const activeCount = mounted
    ? (draftFrom ? 1 : 0) +
      (draftTo ? 1 : 0) +
      (selectedBases.length > 0 ? 1 : 0) +
      (selectedAircraft.length > 0 ? 1 : 0) +
      (selectedPositions.length > 0 ? 1 : 0) +
      (selectedCrewGroups.length > 0 ? 1 : 0)
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
          options={baseOptions}
          value={selectedBases}
          onChange={(keys) => setDraftFilters({ baseAirports: keys.length === 0 ? null : keys })}
          allLabel="All Bases"
          noneLabel="All Bases"
          searchable
          searchPlaceholder="Search bases…"
        />
      </FilterSection>

      <FilterSection label="Position">
        <MultiSelectField
          options={positionOptions}
          value={selectedPositions}
          onChange={(keys) => setDraftFilters({ positionFilter: keys.length === 0 ? null : keys })}
          allLabel="All Positions"
          noneLabel="All Positions"
          searchable
          searchPlaceholder="Search positions…"
        />
      </FilterSection>

      <FilterSection label="A/C Type">
        <MultiSelectField
          options={acTypeOptions}
          value={selectedAircraft}
          onChange={(keys) => setDraftFilters({ aircraftTypes: keys.length === 0 ? null : keys })}
          allLabel="All Types"
          noneLabel="All Types"
        />
      </FilterSection>

      <FilterSection label="Crew Group">
        <MultiSelectField
          options={crewGroupOptions}
          value={selectedCrewGroups}
          onChange={(keys) => setDraftFilters({ crewGroupIds: keys.length === 0 ? null : keys })}
          allLabel="All Groups"
          noneLabel="All Groups"
          searchable
          searchPlaceholder="Search groups…"
        />
      </FilterSection>
    </FilterPanel>
  )
}
