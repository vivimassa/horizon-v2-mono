'use client'

import {
  FilterPanel as Shell,
  FilterSection,
  PeriodField,
  SelectField,
  SegmentedField,
  FilterGoButton,
} from '@/components/filter-panel'
import { useScheduleSummaryStore, scheduleSummaryActiveCount } from '@/stores/use-schedule-summary-store'

interface FilterPanelProps {
  onGo: () => void
  loading: boolean
  availableAcTypes: string[]
  availableServiceTypes: string[]
}

export function ScheduleSummaryFilterPanel({
  onGo,
  loading,
  availableAcTypes,
  availableServiceTypes,
}: FilterPanelProps) {
  const {
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    acType,
    setAcType,
    serviceType,
    setServiceType,
    flightType,
    setFlightType,
  } = useScheduleSummaryStore()

  const activeCount = scheduleSummaryActiveCount({ acType, serviceType, flightType })
  const periodMissing = !dateFrom || !dateTo
  const disabled = periodMissing || (!!dateFrom && !!dateTo && dateFrom > dateTo)

  return (
    <Shell
      activeCount={activeCount}
      footer={
        <FilterGoButton
          onClick={onGo}
          loading={loading}
          disabled={disabled}
          hint={periodMissing ? 'Select the period to continue' : undefined}
        />
      }
    >
      <FilterSection label="Date Range">
        <PeriodField from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
      </FilterSection>

      <FilterSection label="AC Type">
        <SelectField
          value={acType === 'all' ? '' : acType}
          onChange={(v) => setAcType(v || 'all')}
          placeholder="All Types"
          options={[{ value: '', label: 'All Types' }, ...availableAcTypes.map((t) => ({ value: t, label: t }))]}
        />
      </FilterSection>

      <FilterSection label="Service Type">
        <SelectField
          value={serviceType === 'all' ? '' : serviceType}
          onChange={(v) => setServiceType(v || 'all')}
          placeholder="All"
          options={[{ value: '', label: 'All' }, ...availableServiceTypes.map((t) => ({ value: t, label: t }))]}
        />
      </FilterSection>

      <FilterSection label="Flight Type">
        <SegmentedField
          value={flightType}
          onChange={setFlightType}
          options={[
            { key: 'all', label: 'All' },
            { key: 'dom', label: 'DOM' },
            { key: 'int', label: 'INT' },
          ]}
        />
      </FilterSection>

      <FilterSection label="Compare">
        <div className="opacity-50 pointer-events-none">
          <div
            className="flex items-center justify-between h-9 px-3 rounded-xl"
            style={{ border: '1px solid var(--color-hz-border)' }}
          >
            <span className="text-[13px] font-medium text-hz-text">Compare Period</span>
            <span className="w-9 h-5 rounded-full relative" style={{ background: 'rgba(125,125,140,0.25)' }}>
              <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
            </span>
          </div>
        </div>
        <p className="text-[13px] text-hz-text-secondary italic mt-1">Coming soon</p>
      </FilterSection>
    </Shell>
  )
}
