'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, type CrewPositionRef, type AirportRef, type AircraftTypeRef } from '@skyhub/api'
import { SingleDatePicker } from '@/components/ui/single-date-picker'
import {
  FilterPanel,
  FilterSection,
  MultiSelectField,
  SelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { getOperatorId } from '@/stores/use-operator-store'
import { useCrewCheckInStore } from '@/stores/use-crew-checkin-store'
import { ToggleSwitch } from '@/components/ui/toggle-switch'

interface CrewCheckInFilterPanelProps {
  onGo: () => void
}

const DUTY_TYPE_OPTIONS = [
  { value: 'all', label: 'All Duties' },
  { value: 'flights', label: 'Flights' },
  { value: 'ground', label: 'Ground' },
  { value: 'standby', label: 'Standby' },
]

/** 4.1.7.1 left-rail filter. Single date + multi-station + duty-type + position + display toggles. */
export function CrewCheckInFilterPanel({ onGo }: CrewCheckInFilterPanelProps) {
  const draftStations = useCrewCheckInStore((s) => s.draftStations)
  const draftDate = useCrewCheckInStore((s) => s.draftDate)
  const draftFilters = useCrewCheckInStore((s) => s.draftFilters)
  const setDraftStations = useCrewCheckInStore((s) => s.setDraftStations)
  const setDraftDate = useCrewCheckInStore((s) => s.setDraftDate)
  const setDraftFilters = useCrewCheckInStore((s) => s.setDraftFilters)
  const loading = useCrewCheckInStore((s) => s.loading)

  const [airports, setAirports] = useState<AirportRef[]>([])
  const [positions, setPositions] = useState<CrewPositionRef[]>([])
  const [aircraftTypes, setAircraftTypes] = useState<AircraftTypeRef[]>([])

  useEffect(() => {
    void api
      .getAirports({ crewBase: true })
      .then(setAirports)
      .catch((err) => console.warn('[crew-checkin] failed to load airports', err))
    void api
      .getCrewPositions(getOperatorId())
      .then(setPositions)
      .catch((err) => console.warn('[crew-checkin] failed to load positions', err))
    void api
      .getAircraftTypes(getOperatorId())
      .then(setAircraftTypes)
      .catch((err) => console.warn('[crew-checkin] failed to load aircraft types', err))
  }, [])

  // IATA-only labels, sorted alphabetically.
  const stationOptions = useMemo<MultiSelectOption[]>(
    () =>
      airports
        .filter((a) => !!a.iataCode)
        .map((a) => ({ key: a.iataCode as string, label: a.iataCode as string }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [airports],
  )

  const aircraftTypeOptions = useMemo<MultiSelectOption[]>(
    () =>
      aircraftTypes
        .filter((a) => !!a.icaoType)
        .map((a) => ({ key: a.icaoType, label: a.icaoType }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [aircraftTypes],
  )

  // Cockpit first, then cabin, secondary by rank order — matches 4.1.5.1.
  const positionOptions = useMemo<MultiSelectOption[]>(
    () =>
      positions
        .slice()
        .sort((a, b) => {
          if (a.category !== b.category) return a.category === 'cockpit' ? -1 : 1
          return (a.rankOrder ?? 99) - (b.rankOrder ?? 99)
        })
        .map((p) => ({ key: p._id, label: p.code })),
    [positions],
  )

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const isToday = draftDate === today

  const activeCount =
    (draftFilters.dutyType !== 'all' ? 1 : 0) +
    (draftFilters.positions.length > 0 ? 1 : 0) +
    (draftFilters.aircraftTypes.length > 0 ? 1 : 0) +
    (draftFilters.hideDeparted ? 1 : 0) +
    (draftFilters.hideAllCheckedIn ? 1 : 0) +
    (!isToday ? 1 : 0)

  return (
    <FilterPanel title="Filters" activeCount={activeCount} footer={<FilterGoButton onClick={onGo} loading={loading} />}>
      <FilterSection label="Date">
        <div className="space-y-1.5">
          <SingleDatePicker value={draftDate} onChange={(iso) => setDraftDate(iso || today)} />
          {!isToday && (
            <button
              type="button"
              onClick={() => setDraftDate(today)}
              className="w-full h-7 rounded-md text-[13px] font-semibold transition-colors"
              style={{
                border: '1px solid var(--module-accent, #1e40af)',
                color: 'var(--module-accent, #1e40af)',
                background: 'transparent',
              }}
            >
              Reset to Today
            </button>
          )}
        </div>
      </FilterSection>

      <FilterSection label="Base">
        <MultiSelectField
          value={draftStations}
          onChange={(v) => setDraftStations(v)}
          options={stationOptions}
          placeholder="All Bases"
          noneLabel="All Bases"
          searchable
        />
      </FilterSection>

      <FilterSection label="Position">
        <MultiSelectField
          value={draftFilters.positions}
          onChange={(v) => setDraftFilters({ positions: v })}
          options={positionOptions}
          placeholder="All positions"
          searchable
        />
      </FilterSection>

      <FilterSection label="A/C Type">
        <MultiSelectField
          value={draftFilters.aircraftTypes}
          onChange={(v) => setDraftFilters({ aircraftTypes: v })}
          options={aircraftTypeOptions}
          placeholder="All Fleets"
          noneLabel="All Fleets"
          searchable
        />
      </FilterSection>

      <FilterSection label="Duty Type">
        <SelectField
          value={draftFilters.dutyType}
          onChange={(v) => setDraftFilters({ dutyType: v as 'all' | 'flights' | 'ground' | 'standby' })}
          options={DUTY_TYPE_OPTIONS}
        />
      </FilterSection>

      <FilterSection label="Display">
        <div className="space-y-2.5">
          <ToggleRow
            label="Hide already-departed flights"
            checked={draftFilters.hideDeparted}
            onChange={(v) => setDraftFilters({ hideDeparted: v })}
          />
          <ToggleRow
            label="Hide flights with all crew checked-in"
            checked={draftFilters.hideAllCheckedIn}
            onChange={(v) => setDraftFilters({ hideAllCheckedIn: v })}
          />
        </div>
      </FilterSection>
    </FilterPanel>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer text-[13px]">
      <span className="text-hz-text-secondary flex-1">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} size="sm" />
    </label>
  )
}
