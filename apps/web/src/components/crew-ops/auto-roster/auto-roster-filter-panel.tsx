'use client'

import { useEffect, useMemo } from 'react'
import {
  FilterPanel,
  FilterSection,
  PeriodField,
  MultiSelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'

interface AutoRosterFilterPanelProps {
  periodFrom: string
  periodTo: string
  onPeriodFrom: (v: string) => void
  onPeriodTo: (v: string) => void
  filterBase: string[]
  filterPosition: string[]
  filterAcType: string[]
  filterCrewGroup: string[]
  onFilterBase: (v: string[]) => void
  onFilterPosition: (v: string[]) => void
  onFilterAcType: (v: string[]) => void
  onFilterCrewGroup: (v: string[]) => void
  onGo: () => void
  loading: boolean
}

/**
 * Filter panel for 4.1.6.1 Automatic Crew Assignment. Visually 1:1 with
 * 4.1.6.2 Crew Schedule Gantt — pulls bases, A/C types, positions from
 * the shared `useCrewScheduleStore.context`.
 */
export function AutoRosterFilterPanel({
  periodFrom,
  periodTo,
  onPeriodFrom,
  onPeriodTo,
  filterBase,
  filterPosition,
  filterAcType,
  filterCrewGroup,
  onFilterBase,
  onFilterPosition,
  onFilterAcType,
  onFilterCrewGroup,
  onGo,
  loading,
}: AutoRosterFilterPanelProps) {
  const context = useCrewScheduleStore((s) => s.context)
  const positions = useCrewScheduleStore((s) => s.positions)
  const loadContext = useCrewScheduleStore((s) => s.loadContext)
  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const baseOptions = useMemo<MultiSelectOption[]>(
    () => context.bases.map((b) => ({ key: b._id, label: b.iataCode ?? b.name })),
    [context.bases],
  )
  const positionOptions = useMemo<MultiSelectOption[]>(
    () =>
      positions
        .filter((p) => p.isActive)
        .slice()
        .sort((a, b) => {
          if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
          return (a.rankOrder ?? 9999) - (b.rankOrder ?? 9999)
        })
        .map((p) => ({ key: p._id, label: `${p.code} · ${p.name}`, color: p.color ?? undefined })),
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

  const canGo = !!periodFrom && !!periodTo && periodFrom <= periodTo
  const activeCount =
    (filterBase.length > 0 ? 1 : 0) +
    (filterAcType.length > 0 ? 1 : 0) +
    (filterPosition.length > 0 ? 1 : 0) +
    (filterCrewGroup.length > 0 ? 1 : 0)

  return (
    <FilterPanel
      activeCount={activeCount}
      footer={<FilterGoButton onClick={onGo} loading={loading} disabled={!canGo} />}
    >
      <FilterSection label="Period">
        <PeriodField from={periodFrom} to={periodTo} onChangeFrom={onPeriodFrom} onChangeTo={onPeriodTo} />
      </FilterSection>

      <FilterSection label="Base">
        <MultiSelectField
          options={baseOptions}
          value={filterBase}
          onChange={onFilterBase}
          allLabel="All Bases"
          noneLabel="All Bases"
          searchable
          searchPlaceholder="Search bases…"
        />
      </FilterSection>

      <FilterSection label="Position">
        <MultiSelectField
          options={positionOptions}
          value={filterPosition}
          onChange={onFilterPosition}
          allLabel="All Positions"
          noneLabel="All Positions"
          searchable
          searchPlaceholder="Search positions…"
        />
      </FilterSection>

      <FilterSection label="A/C Type">
        <MultiSelectField
          options={acTypeOptions}
          value={filterAcType}
          onChange={onFilterAcType}
          allLabel="All Types"
          noneLabel="All Types"
        />
      </FilterSection>

      <FilterSection label="Crew Group">
        <MultiSelectField
          options={crewGroupOptions}
          value={filterCrewGroup}
          onChange={onFilterCrewGroup}
          allLabel="All Groups"
          noneLabel="All Groups"
          searchable
          searchPlaceholder="Search groups…"
        />
      </FilterSection>
    </FilterPanel>
  )
}
