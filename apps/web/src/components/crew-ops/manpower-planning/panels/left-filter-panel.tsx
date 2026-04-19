'use client'

import { useAircraftTypes, useCrewPositions, useCrewGroups } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'
import {
  FilterPanel,
  FilterSection,
  MultiSelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'

export interface ManpowerFilters {
  year: number
  positionIds: string[] // crew positions to include in the view (empty = all)
  fleetIcaos: string[] // aircraft types to include
  groupIds: string[] // crew groups
}

interface Props {
  draft: ManpowerFilters
  onDraftChange: (next: ManpowerFilters) => void
  onGo: () => void
  loading: boolean
}

export function ManpowerLeftFilterPanel({ draft, onDraftChange, onGo, loading }: Props) {
  const operatorId = getOperatorId()
  const positions = useCrewPositions(operatorId).data ?? []
  const aircraftTypes = useAircraftTypes(operatorId).data ?? []
  const groups = useCrewGroups(operatorId).data ?? []

  // Flight Deck (cockpit) before Cabin Crew, then by rankOrder ascending.
  const sortedPositions = [...positions].sort((a, b) => {
    const catRank = (c: string) => (c === 'cockpit' ? 0 : 1)
    const d = catRank(a.category) - catRank(b.category)
    if (d !== 0) return d
    return (a.rankOrder ?? 999) - (b.rankOrder ?? 999)
  })

  const positionOptions: MultiSelectOption[] = sortedPositions.map((p) => ({
    key: p._id,
    label: `${p.code} — ${p.name}`,
  }))
  const fleetOptions: MultiSelectOption[] = aircraftTypes.map((t) => ({
    key: (t.icaoType ?? '').toString(),
    label: (t.icaoType ?? t._id).toString(),
  }))
  const groupOptions: MultiSelectOption[] = groups.map((g) => ({ key: g._id, label: g.name }))

  const activeCount = draft.positionIds.length + draft.fleetIcaos.length + draft.groupIds.length

  const yearOptions: MultiSelectOption[] = Array.from({ length: 5 }, (_, i) => ({
    key: String(new Date().getFullYear() + i - 1),
    label: String(new Date().getFullYear() + i - 1),
  }))

  return (
    <FilterPanel
      title="Filters"
      activeCount={activeCount}
      footer={<FilterGoButton onClick={onGo} loading={loading} label="Go" />}
    >
      <FilterSection label="Year">
        <MultiSelectField
          options={yearOptions}
          value={[String(draft.year)]}
          onChange={(keys) => {
            const n = Number(keys[0])
            if (Number.isFinite(n)) onDraftChange({ ...draft, year: n })
          }}
          allLabel={String(draft.year)}
          placeholder="Select year"
          summaryMax={1}
        />
      </FilterSection>
      <FilterSection label="Positions">
        <MultiSelectField
          options={positionOptions}
          value={draft.positionIds}
          onChange={(keys) => onDraftChange({ ...draft, positionIds: keys })}
          allLabel="All positions"
          noneLabel="All positions"
          placeholder="All positions"
        />
      </FilterSection>
      <FilterSection label="Aircraft Types">
        <MultiSelectField
          options={fleetOptions}
          value={draft.fleetIcaos}
          onChange={(keys) => onDraftChange({ ...draft, fleetIcaos: keys })}
          allLabel="All fleets"
          noneLabel="All fleets"
          placeholder="All fleets"
          summaryBy="key"
        />
      </FilterSection>
      <FilterSection label="Crew Group">
        <MultiSelectField
          options={groupOptions}
          value={draft.groupIds}
          onChange={(keys) => onDraftChange({ ...draft, groupIds: keys })}
          allLabel="All groups"
          noneLabel="All groups"
          placeholder="All groups"
        />
      </FilterSection>
    </FilterPanel>
  )
}
