'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  FilterPanel,
  FilterSection,
  PeriodField,
  SegmentedField,
  MultiSelectField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { api, type AirportRef } from '@skyhub/api'
import { useTheme } from '@/components/theme-provider'
import { useSsimExportStore } from '@/stores/use-ssim-export-store'

/**
 * Left-side setup panel for 1.2.2 SSIM Export. Mirrors the SSIM Import
 * setup panel in shape and styling. Filters are V1-exact:
 * date range, flight # range, dep/arr stations, service types, action
 * code (H/N/R), plus a time-mode toggle (Local / UTC).
 */
export function SsimExportSetupPanel() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const stage = useSsimExportStore((s) => s.stage)

  const dateFrom = useSsimExportStore((s) => s.dateFrom)
  const dateTo = useSsimExportStore((s) => s.dateTo)
  const setDateFrom = useSsimExportStore((s) => s.setDateFrom)
  const setDateTo = useSsimExportStore((s) => s.setDateTo)

  const flightNumFrom = useSsimExportStore((s) => s.flightNumFrom)
  const flightNumTo = useSsimExportStore((s) => s.flightNumTo)
  const setFlightNumFrom = useSsimExportStore((s) => s.setFlightNumFrom)
  const setFlightNumTo = useSsimExportStore((s) => s.setFlightNumTo)

  const depStations = useSsimExportStore((s) => s.depStations)
  const arrStations = useSsimExportStore((s) => s.arrStations)
  const setDepStations = useSsimExportStore((s) => s.setDepStations)
  const setArrStations = useSsimExportStore((s) => s.setArrStations)

  const serviceTypes = useSsimExportStore((s) => s.serviceTypes)
  const setServiceTypes = useSsimExportStore((s) => s.setServiceTypes)

  const actionCode = useSsimExportStore((s) => s.actionCode)
  const setActionCode = useSsimExportStore((s) => s.setActionCode)

  const timeMode = useSsimExportStore((s) => s.timeMode)
  const setTimeMode = useSsimExportStore((s) => s.setTimeMode)

  const validate = useSsimExportStore((s) => s.validate)
  const download = useSsimExportStore((s) => s.download)

  // ── Station options — fetched lazily from the airport master data ──
  // We only need the codes that the current operator uses. The airports
  // route already filters by tenant via JWT, so a single getAirports call
  // gives us the universe to pick from.
  const [airports, setAirports] = useState<AirportRef[] | null>(null)
  const [airportsLoading, setAirportsLoading] = useState(false)
  useEffect(() => {
    let alive = true
    setAirportsLoading(true)
    api
      .getAirports()
      .then((list) => {
        if (alive) setAirports(list)
      })
      .catch(() => {
        if (alive) setAirports([])
      })
      .finally(() => {
        if (alive) setAirportsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const stationOptions: MultiSelectOption[] = useMemo(() => {
    if (!airports) return []
    return airports
      .filter((a) => a.icaoCode)
      .map((a) => ({
        key: a.icaoCode,
        label: `${a.icaoCode}${a.iataCode ? ` (${a.iataCode})` : ''} — ${a.city ?? a.name}`,
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [airports])

  // ── Service type options — IATA Chapter 2 single-character codes ──
  const serviceTypeOptions: MultiSelectOption[] = [
    { key: 'J', label: 'J — Scheduled passenger' },
    { key: 'S', label: 'S — Scheduled passenger (additional)' },
    { key: 'U', label: 'U — Unscheduled passenger' },
    { key: 'C', label: 'C — Charter passenger' },
    { key: 'F', label: 'F — Freight only' },
    { key: 'V', label: 'V — Service / non-revenue' },
    { key: 'H', label: 'H — Technical / positioning' },
    { key: 'P', label: 'P — Positioning' },
    { key: 'T', label: 'T — Training' },
  ]

  const actionCodeOptions = [
    { key: 'H' as const, label: 'Historical' },
    { key: 'N' as const, label: 'New' },
    { key: 'R' as const, label: 'Revised' },
  ]

  const timeModeOptions = [
    { key: 'local' as const, label: 'Local' },
    { key: 'utc' as const, label: 'UTC only' },
  ]

  const isBusy = stage === 'generating'
  const validationError = validate()
  const goDisabled = isBusy || validationError != null

  const goHint = validationError ?? (airportsLoading ? 'Loading station list…' : undefined)

  // Active-count badge: count of non-default choices the user has made.
  const activeCount =
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (flightNumFrom ? 1 : 0) +
    (flightNumTo ? 1 : 0) +
    (depStations.length > 0 ? 1 : 0) +
    (arrStations.length > 0 ? 1 : 0) +
    (serviceTypes.length > 0 ? 1 : 0) +
    (actionCode !== 'H' ? 1 : 0) +
    (timeMode !== 'local' ? 1 : 0)

  return (
    <FilterPanel
      title="SSIM Export"
      activeCount={activeCount}
      collapsed={false}
      onCollapsedChange={() => {}}
      footer={
        <FilterGoButton
          onClick={download}
          loading={isBusy}
          disabled={goDisabled}
          label="Download SSIM"
          loadingLabel="Generating…"
          hint={goHint}
        />
      }
    >
      <FilterSection label="Date range">
        <PeriodField from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
      </FilterSection>

      <FilterSection label="Flight number">
        <div className="flex items-center gap-2">
          <NumberInput value={flightNumFrom} onChange={setFlightNumFrom} placeholder="From" isDark={isDark} />
          <span className="text-[13px] text-hz-text-tertiary shrink-0">to</span>
          <NumberInput value={flightNumTo} onChange={setFlightNumTo} placeholder="To" isDark={isDark} />
        </div>
      </FilterSection>

      <FilterSection label="Departure stations">
        <MultiSelectField
          options={stationOptions}
          value={depStations}
          onChange={setDepStations}
          allLabel="All stations"
          noneLabel="All stations"
          placeholder={airportsLoading ? 'Loading…' : 'All stations'}
          searchable
          searchPlaceholder="Search ICAO / IATA / city"
          summaryBy="key"
        />
      </FilterSection>

      <FilterSection label="Arrival stations">
        <MultiSelectField
          options={stationOptions}
          value={arrStations}
          onChange={setArrStations}
          allLabel="All stations"
          noneLabel="All stations"
          placeholder={airportsLoading ? 'Loading…' : 'All stations'}
          searchable
          searchPlaceholder="Search ICAO / IATA / city"
          summaryBy="key"
        />
      </FilterSection>

      <FilterSection label="Service types">
        <MultiSelectField
          options={serviceTypeOptions}
          value={serviceTypes}
          onChange={setServiceTypes}
          allLabel="All service types"
          noneLabel="All service types"
          placeholder="All service types"
          summaryBy="key"
        />
      </FilterSection>

      <FilterSection label="Action code">
        <SegmentedField options={actionCodeOptions} value={actionCode} onChange={setActionCode} />
      </FilterSection>

      <FilterSection label="Time format">
        <SegmentedField options={timeModeOptions} value={timeMode} onChange={setTimeMode} />
      </FilterSection>
    </FilterPanel>
  )
}

/* ── Local: small numeric input matching the SkyHub field metrics ── */
function NumberInput({
  value,
  onChange,
  placeholder,
  isDark,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  isDark: boolean
}) {
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)'
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      placeholder={placeholder}
      className="flex-1 min-w-0 h-9 px-3 rounded-xl text-[13px] font-medium text-hz-text outline-none"
      style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
    />
  )
}
