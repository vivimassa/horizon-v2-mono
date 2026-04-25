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
import { useHotacFilterStore } from '@/stores/use-hotac-filter-store'
import { useHotacStore } from '@/stores/use-hotac-store'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { api, type AirportRef, type CrewPositionRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'

interface HotacFilterPanelProps {
  airports: AirportRef[]
  /** Fired when the user clicks Go. Caller commits the period and triggers fetch. */
  onGo: () => void
}

/**
 * 4.1.8.1 Crew Hotel Management filter panel — visually 1:1 with 4.1.6.2
 * Crew Schedule. Adds a HOTAC-specific Station filter at the top so the
 * planner can scope to a single layover airport.
 */
export function HotacFilterPanel({ airports, onGo }: HotacFilterPanelProps) {
  const draftFrom = useHotacFilterStore((s) => s.draftPeriodFrom)
  const draftTo = useHotacFilterStore((s) => s.draftPeriodTo)
  const draft = useHotacFilterStore((s) => s.draftFilters)
  const setDraftFrom = useHotacFilterStore((s) => s.setDraftFrom)
  const setDraftTo = useHotacFilterStore((s) => s.setDraftTo)
  const setDraftFilters = useHotacFilterStore((s) => s.setDraftFilters)
  const activeCount = useHotacFilterStore((s) => s.activeCount())

  const loading = useHotacStore((s) => s.loading)
  const setPeriod = useHotacStore((s) => s.setPeriod)
  const setFilters = useHotacStore((s) => s.setFilters)

  // Reuse the same reference data 4.1.6.2 loads (bases, A/C types, crew groups).
  const context = useCrewScheduleStore((s) => s.context)
  const loadContext = useCrewScheduleStore((s) => s.loadContext)
  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Positions aren't part of crew-schedule context — load directly.
  const [positions, setPositions] = useState<CrewPositionRef[]>([])
  useEffect(() => {
    api
      .getCrewPositions(getOperatorId())
      .then(setPositions)
      .catch((err) => console.warn('[hotac] failed to load positions', err))
  }, [])

  const stationOptions = useMemo<MultiSelectOption[]>(
    () =>
      airports
        .filter((a) => !!a.icaoCode)
        .map((a) => ({
          key: a.icaoCode as string,
          label: a.iataCode ? `${a.iataCode} · ${a.icaoCode}${a.city ? ` · ${a.city}` : ''}` : (a.icaoCode as string),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [airports],
  )

  const baseOptions = useMemo<MultiSelectOption[]>(
    () =>
      context.bases
        .filter((b) => !!b.iataCode)
        .map((b) => ({ key: b.iataCode as string, label: b.iataCode as string })),
    [context.bases],
  )

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

  const acTypeOptions = useMemo<MultiSelectOption[]>(
    () => context.acTypes.map((t) => ({ key: t, label: t })),
    [context.acTypes],
  )

  const crewGroupOptions = useMemo<MultiSelectOption[]>(
    () => context.crewGroups.map((g) => ({ key: g._id, label: g.name })),
    [context.crewGroups],
  )

  const selectedStations = draft.stationIcaos ?? []
  const selectedBases = draft.baseAirports ?? []
  const selectedPositions = draft.positions ?? []
  const selectedAircraft = draft.aircraftTypes ?? []
  const selectedCrewGroups = draft.crewGroupIds ?? []

  // Hide the activeCount badge until mounted to avoid SSR mismatch.
  const renderedCount = mounted ? activeCount : 0

  function handleGo() {
    setPeriod(draftFrom, draftTo)
    setFilters(draft)
    setTimeout(() => {
      onGo()
    }, 0)
  }

  return (
    <FilterPanel
      activeCount={renderedCount}
      footer={<FilterGoButton onClick={handleGo} loading={loading} disabled={!draftFrom || !draftTo} />}
    >
      <FilterSection label="Period">
        <PeriodField from={draftFrom} to={draftTo} onChangeFrom={setDraftFrom} onChangeTo={setDraftTo} />
      </FilterSection>

      <FilterSection label="Station">
        <MultiSelectField
          options={stationOptions}
          value={selectedStations}
          onChange={(keys) => setDraftFilters({ stationIcaos: keys.length === 0 ? null : keys })}
          allLabel="All Stations"
          noneLabel="All Stations"
          searchable
          searchPlaceholder="Search stations…"
          summaryBy="key"
        />
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
          onChange={(keys) => setDraftFilters({ positions: keys.length === 0 ? null : keys })}
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
