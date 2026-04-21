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
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface Props {
  onGo: () => void
}

/**
 * Left filter panel for 4.1.6 Crew Schedule.
 *
 * Draft-only: filter changes live in local state and do NOT touch the
 * canvas until the user clicks Go. Base / Position / A/C Type are all
 * multi-selectable; the server fetch narrows when exactly one value is
 * picked, otherwise all rows are fetched and trimmed client-side in
 * `buildCrewScheduleLayout`.
 */
export function CrewScheduleFilterPanel({ onGo }: Props) {
  const storeFrom = useCrewScheduleStore((s) => s.periodFromIso)
  const storeTo = useCrewScheduleStore((s) => s.periodToIso)
  const storeFilters = useCrewScheduleStore((s) => s.filters)
  const loading = useCrewScheduleStore((s) => s.loading)

  const positions = useCrewScheduleStore((s) => s.positions)
  const context = useCrewScheduleStore((s) => s.context)
  const loadContext = useCrewScheduleStore((s) => s.loadContext)

  const setPeriod = useCrewScheduleStore((s) => s.setPeriod)
  const setFilters = useCrewScheduleStore((s) => s.setFilters)

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const [draftFrom, setDraftFrom] = useState(storeFrom)
  const [draftTo, setDraftTo] = useState(storeTo)
  const [draftBase, setDraftBase] = useState<string[]>(storeFilters.baseIds)
  const [draftPositions, setDraftPositions] = useState<string[]>(storeFilters.positionIds)
  const [draftAcTypes, setDraftAcTypes] = useState<string[]>(storeFilters.acTypeIcaos)

  const baseOptions: MultiSelectOption[] = useMemo(
    () => context.bases.map((b) => ({ key: b._id, label: b.iataCode ?? b.name })),
    [context.bases],
  )
  const positionOptions: MultiSelectOption[] = useMemo(
    () =>
      positions
        .filter((p) => p.isActive)
        .slice()
        .sort((a, b) => {
          // Cockpit before cabin, then by rankOrder (matches admin Crew
          // Positions layout: Flight Deck group first, Captain above FO).
          if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
          return (a.rankOrder ?? 9999) - (b.rankOrder ?? 9999)
        })
        .map((p) => ({ key: p._id, label: `${p.code} · ${p.name}`, color: p.color ?? undefined })),
    [positions],
  )
  const acTypeOptions: MultiSelectOption[] = useMemo(
    () => context.acTypes.map((t) => ({ key: t, label: t })),
    [context.acTypes],
  )

  const activeCount =
    (draftBase.length > 0 ? 1 : 0) + (draftPositions.length > 0 ? 1 : 0) + (draftAcTypes.length > 0 ? 1 : 0)

  function handleGo() {
    setPeriod(draftFrom, draftTo)
    setFilters({
      baseIds: draftBase,
      positionIds: draftPositions,
      acTypeIcaos: draftAcTypes,
    })
    setTimeout(() => onGo(), 0)
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
          value={draftBase}
          onChange={setDraftBase}
          allLabel="All Bases"
          noneLabel="All Bases"
          searchable
          searchPlaceholder="Search bases…"
        />
      </FilterSection>

      <FilterSection label="Position">
        <MultiSelectField
          options={positionOptions}
          value={draftPositions}
          onChange={setDraftPositions}
          allLabel="All Positions"
          noneLabel="All Positions"
          searchable
          searchPlaceholder="Search positions…"
        />
      </FilterSection>

      <FilterSection label="A/C Type">
        <MultiSelectField
          options={acTypeOptions}
          value={draftAcTypes}
          onChange={setDraftAcTypes}
          allLabel="All Types"
          noneLabel="All Types"
        />
      </FilterSection>
    </FilterPanel>
  )
}
