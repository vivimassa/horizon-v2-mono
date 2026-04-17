'use client'

import { useMemo } from 'react'
import {
  FilterPanel,
  FilterSection,
  PeriodField,
  MultiSelectField,
  FileField,
  FilterGoButton,
  type MultiSelectOption,
} from '@/components/filter-panel'
import { useSsimComparisonStore } from '@/stores/use-ssim-comparison-store'

/**
 * Left-side filter panel for 1.2.3 SSIM Comparison.
 *
 * Fields:
 *   1. File A — baseline SSIM upload
 *   2. File B — comparison SSIM upload
 *   3. Date range — date-range calendar (auto-seeded to the intersection
 *      of both files' coverage, user-overridable)
 *   4. Aircraft type filter — restrict stats to a subset of types
 *   5. Compare — primary CTA, disabled until everything is ready
 */
export function SsimComparisonSetupPanel() {
  const a = useSsimComparisonStore((s) => s.a)
  const b = useSsimComparisonStore((s) => s.b)
  const dateFrom = useSsimComparisonStore((s) => s.dateFrom)
  const dateTo = useSsimComparisonStore((s) => s.dateTo)
  const aircraftTypeFilter = useSsimComparisonStore((s) => s.aircraftTypeFilter)
  const stage = useSsimComparisonStore((s) => s.stage)

  const setFileA = useSsimComparisonStore((s) => s.setFileA)
  const setFileB = useSsimComparisonStore((s) => s.setFileB)
  const setDateFrom = useSsimComparisonStore((s) => s.setDateFrom)
  const setDateTo = useSsimComparisonStore((s) => s.setDateTo)
  const setAircraftTypeFilter = useSsimComparisonStore((s) => s.setAircraftTypeFilter)
  const validate = useSsimComparisonStore((s) => s.validate)
  const compare = useSsimComparisonStore((s) => s.compare)

  // Aircraft-type options = union of both files' aircraft-type sets.
  const aircraftOptions: MultiSelectOption[] = useMemo(() => {
    const set = new Set<string>()
    a.result?.stats.aircraftTypes.forEach((t) => set.add(t))
    b.result?.stats.aircraftTypes.forEach((t) => set.add(t))
    return [...set].sort().map((t) => ({ key: t, label: t }))
  }, [a.result, b.result])

  const validationError = validate()
  const isBusy = stage === 'parsing' || stage === 'comparing'
  const goDisabled = isBusy || validationError != null

  const activeCount =
    (a.file ? 1 : 0) + (b.file ? 1 : 0) + (dateFrom && dateTo ? 1 : 0) + (aircraftTypeFilter.length > 0 ? 1 : 0)

  return (
    <FilterPanel
      title="SSIM Comparison"
      activeCount={activeCount}
      collapsed={false}
      onCollapsedChange={() => {}}
      footer={
        <FilterGoButton
          onClick={compare}
          loading={stage === 'comparing'}
          disabled={goDisabled}
          label="Compare"
          loadingLabel="Comparing…"
        />
      }
    >
      <FilterSection label="Date range">
        <PeriodField from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
      </FilterSection>

      <FilterSection label="File A — baseline">
        <FileField
          value={a.file}
          onChange={(file) => {
            void setFileA(file)
          }}
          accept=".txt,.ssim,.dat,text/plain"
          placeholder="Drop SSIM file or click to browse"
          hint={a.result ? `${a.result.flights.length} flights parsed` : undefined}
        />
      </FilterSection>

      <FilterSection label="File B — comparison">
        <FileField
          value={b.file}
          onChange={(file) => {
            void setFileB(file)
          }}
          accept=".txt,.ssim,.dat,text/plain"
          placeholder="Drop SSIM file or click to browse"
          hint={b.result ? `${b.result.flights.length} flights parsed` : undefined}
        />
      </FilterSection>

      <FilterSection label="Aircraft types">
        <MultiSelectField
          options={aircraftOptions}
          value={aircraftTypeFilter}
          onChange={setAircraftTypeFilter}
          allLabel="All aircraft types"
          noneLabel="All aircraft types"
          placeholder={aircraftOptions.length === 0 ? 'Upload files to populate' : 'All aircraft types'}
          summaryBy="key"
        />
      </FilterSection>
    </FilterPanel>
  )
}
