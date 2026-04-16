'use client'

import { useMemo } from 'react'
import { useTheme } from '@/components/theme-provider'
import { FilterPanel } from '@/components/filter-panel/panel'
import {
  FilterSection,
  PeriodField,
  MultiSelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel/fields'

export interface MessageFilterValues {
  from: string | null
  to: string | null
  direction: string[]
  messageTypes: string[]
  actionCodes: string[]
  statuses: string[]
  stations: string[]
  flightNumber: string
}

const DIRECTION_OPTIONS: MultiSelectOption[] = [
  { key: 'outbound', label: 'Outbound' },
  { key: 'inbound', label: 'Inbound' },
]

const TYPE_OPTIONS: MultiSelectOption[] = [
  { key: 'MVT', label: 'MVT — Movement' },
  { key: 'LDM', label: 'LDM — Load Distribution' },
]

const ACTION_OPTIONS: MultiSelectOption[] = [
  { key: 'AD', label: 'AD — Actual Departure' },
  { key: 'AA', label: 'AA — Actual Arrival' },
  { key: 'ED', label: 'ED — Estimated Departure' },
  { key: 'EA', label: 'EA — Estimated Arrival' },
  { key: 'NI', label: 'NI — Next Information' },
  { key: 'RR', label: 'RR — Return to Ramp' },
  { key: 'FR', label: 'FR — Forced Return' },
]

const STATUS_OPTIONS: MultiSelectOption[] = [
  { key: 'held', label: 'Held for review' },
  { key: 'pending', label: 'Pending' },
  { key: 'sent', label: 'Sent' },
  { key: 'applied', label: 'Applied' },
  { key: 'failed', label: 'Failed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'discarded', label: 'Discarded' },
]

interface Props {
  values: MessageFilterValues
  onChange: (next: MessageFilterValues) => void
  onGo: () => void
  loading: boolean
  stationOptions: MultiSelectOption[]
}

export function MessageFilterPanel({ values, onChange, onGo, loading, stationOptions }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'

  const activeCount = useMemo(
    () =>
      (values.from ? 1 : 0) +
      (values.to ? 1 : 0) +
      values.direction.length +
      values.messageTypes.length +
      values.actionCodes.length +
      values.statuses.length +
      values.stations.length +
      (values.flightNumber ? 1 : 0),
    [values],
  )

  const patch = (p: Partial<MessageFilterValues>) => onChange({ ...values, ...p })

  return (
    <FilterPanel
      activeCount={activeCount}
      footer={<FilterGoButton onClick={onGo} loading={loading} label="Load" loadingLabel="Loading…" />}
    >
      <FilterSection label="Period">
        <PeriodField
          from={values.from ?? ''}
          to={values.to ?? ''}
          onChangeFrom={(v) => patch({ from: v || null })}
          onChangeTo={(v) => patch({ to: v || null })}
        />
      </FilterSection>

      <FilterSection label="Direction">
        <MultiSelectField
          options={DIRECTION_OPTIONS}
          value={values.direction}
          onChange={(keys) => patch({ direction: keys })}
          allLabel="All directions"
          noneLabel="All directions"
        />
      </FilterSection>

      <FilterSection label="Message type">
        <MultiSelectField
          options={TYPE_OPTIONS}
          value={values.messageTypes}
          onChange={(keys) => patch({ messageTypes: keys })}
          allLabel="All types"
          noneLabel="All types"
        />
      </FilterSection>

      <FilterSection label="Action code">
        <MultiSelectField
          options={ACTION_OPTIONS}
          value={values.actionCodes}
          onChange={(keys) => patch({ actionCodes: keys })}
          allLabel="All actions"
          noneLabel="All actions"
          searchable
          searchPlaceholder="Search actions…"
        />
      </FilterSection>

      <FilterSection label="Status">
        <MultiSelectField
          options={STATUS_OPTIONS}
          value={values.statuses}
          onChange={(keys) => patch({ statuses: keys })}
          allLabel="All statuses"
          noneLabel="All statuses"
        />
      </FilterSection>

      <FilterSection label="Station">
        <MultiSelectField
          options={stationOptions}
          value={values.stations}
          onChange={(keys) => patch({ stations: keys })}
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
          value={values.flightNumber}
          onChange={(e) => patch({ flightNumber: e.target.value.toUpperCase() })}
          placeholder="Filter by flight number"
          className="w-full h-9 px-3 rounded-xl text-[13px] font-medium outline-none text-hz-text placeholder:text-hz-text-tertiary"
          style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
        />
      </FilterSection>
    </FilterPanel>
  )
}
