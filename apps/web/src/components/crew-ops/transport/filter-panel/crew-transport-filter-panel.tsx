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
import { useCrewTransportFilterStore } from '@/stores/use-crew-transport-filter-store'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { useCrewScheduleStore } from '@/stores/use-crew-schedule-store'
import { api, type AirportRef, type CrewPositionRef, type CrewTransportVendorRef } from '@skyhub/api'
import { getOperatorId } from '@/stores/use-operator-store'

interface CrewTransportFilterPanelProps {
  airports: AirportRef[]
  vendors: CrewTransportVendorRef[]
  onGo: () => void
}

/**
 * Filter panel for 4.1.8.2 Crew Transport. Mirrors the HOTAC filter panel
 * exactly + two new fields: Transport Type segment ([all|ground|flight])
 * and Vendor multi-select.
 */
export function CrewTransportFilterPanel({ airports, vendors, onGo }: CrewTransportFilterPanelProps) {
  const draftFrom = useCrewTransportFilterStore((s) => s.draftPeriodFrom)
  const draftTo = useCrewTransportFilterStore((s) => s.draftPeriodTo)
  const draft = useCrewTransportFilterStore((s) => s.draftFilters)
  const setDraftFrom = useCrewTransportFilterStore((s) => s.setDraftFrom)
  const setDraftTo = useCrewTransportFilterStore((s) => s.setDraftTo)
  const setDraftFilters = useCrewTransportFilterStore((s) => s.setDraftFilters)
  const activeCount = useCrewTransportFilterStore((s) => s.activeCount())

  const loading = useCrewTransportStore((s) => s.loading)
  const setPeriod = useCrewTransportStore((s) => s.setPeriod)
  const setFilters = useCrewTransportStore((s) => s.setFilters)

  const context = useCrewScheduleStore((s) => s.context)
  const loadContext = useCrewScheduleStore((s) => s.loadContext)
  useEffect(() => {
    void loadContext()
  }, [loadContext])

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [positions, setPositions] = useState<CrewPositionRef[]>([])
  useEffect(() => {
    api
      .getCrewPositions(getOperatorId())
      .then(setPositions)
      .catch((err) => console.warn('[crew-transport] failed to load positions', err))
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

  const vendorOptions = useMemo<MultiSelectOption[]>(
    () =>
      vendors
        .filter((v) => v.isActive)
        .map((v) => ({
          key: v._id,
          label: `${v.vendorName} · ${v.baseAirportIcao}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [vendors],
  )

  const selectedStations = draft.stationIcaos ?? []
  const selectedBases = draft.baseAirports ?? []
  const selectedPositions = draft.positions ?? []
  const selectedAircraft = draft.aircraftTypes ?? []
  const selectedCrewGroups = draft.crewGroupIds ?? []
  const selectedVendors = draft.vendorIds ?? []

  const renderedCount = mounted ? activeCount : 0

  function handleGo() {
    setPeriod(draftFrom, draftTo)
    setFilters(draft)
    setTimeout(() => onGo(), 0)
  }

  return (
    <FilterPanel
      activeCount={renderedCount}
      footer={<FilterGoButton onClick={handleGo} loading={loading} disabled={!draftFrom || !draftTo} />}
    >
      <FilterSection label="Period">
        <PeriodField from={draftFrom} to={draftTo} onChangeFrom={setDraftFrom} onChangeTo={setDraftTo} />
      </FilterSection>

      <FilterSection label="Transport Type">
        <SegmentRow
          value={draft.transportType}
          onChange={(v) => setDraftFilters({ transportType: v })}
          options={[
            { key: 'all', label: 'All' },
            { key: 'ground', label: 'Ground' },
            { key: 'flight', label: 'Flight' },
          ]}
        />
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

      <FilterSection label="Vendor">
        <MultiSelectField
          options={vendorOptions}
          value={selectedVendors}
          onChange={(keys) => setDraftFilters({ vendorIds: keys.length === 0 ? null : keys })}
          allLabel="All Vendors"
          noneLabel="All Vendors"
          searchable
          searchPlaceholder="Search vendors…"
        />
      </FilterSection>
    </FilterPanel>
  )
}

interface SegmentRowProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: Array<{ key: T; label: string }>
}

function SegmentRow<T extends string>({ value, onChange, options }: SegmentRowProps<T>) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-hz-border bg-hz-card">
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`h-8 px-3 text-[13px] font-semibold transition-colors ${
              active ? 'bg-module-accent text-white' : 'text-hz-text-secondary hover:bg-hz-border/30'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
