'use client'

import { useMemo, useState } from 'react'
import { FilterPanel, FilterSection, PeriodField, MultiSelectField, FilterGoButton } from '@/components/filter-panel'
import type { ScenarioCompareFilterState, ScenarioWithEnvelope } from './scenario-compare-types'

interface ScenarioCompareFilterPanelProps {
  loading?: boolean
  scenarios: ScenarioWithEnvelope[]
  onGo: (filters: ScenarioCompareFilterState) => void
}

const MIN_SCENARIOS = 2
const MAX_SCENARIOS = 3

function defaultPeriod(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 6, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: fmt(start), to: fmt(end) }
}

function intersects(env: ScenarioWithEnvelope['envelope'], from: string, to: string): boolean {
  if (!env) return false
  return env.effectiveFromUtc.slice(0, 10) <= to && env.effectiveUntilUtc.slice(0, 10) >= from
}

export function ScenarioCompareFilterPanel({ loading = false, scenarios, onGo }: ScenarioCompareFilterPanelProps) {
  const initial = useMemo(defaultPeriod, [])
  const [periodFrom, setPeriodFrom] = useState(initial.from)
  const [periodTo, setPeriodTo] = useState(initial.to)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const availableScenarios = useMemo(
    () => scenarios.filter((s) => s.envelope && intersects(s.envelope, periodFrom, periodTo)),
    [scenarios, periodFrom, periodTo],
  )

  const options = useMemo(
    () =>
      availableScenarios.map((s) => ({
        key: s.scenario._id,
        label: `${s.scenario.name} \u00b7 ${s.scenario.status}${s.envelope ? ` \u00b7 ${s.envelope.flightCount} flts` : ''}`,
      })),
    [availableScenarios],
  )

  // Drop any previously-selected IDs that dropped out of the available set
  // (e.g. user narrowed the period after picking scenarios).
  const validSelected = useMemo(() => {
    const allowed = new Set(options.map((o) => o.key))
    return selectedIds.filter((id) => allowed.has(id))
  }, [options, selectedIds])

  function handleSelectionChange(next: string[]) {
    // Cap at MAX_SCENARIOS so the UI never lets the user over-select silently.
    if (next.length > MAX_SCENARIOS) {
      const added = next.find((id) => !selectedIds.includes(id))
      // Drop the oldest pick (first in list) to make room for the new one.
      const dropOldest = selectedIds.slice(1)
      const reconciled = added ? [...dropOldest, added] : selectedIds
      setSelectedIds(reconciled)
      return
    }
    setSelectedIds(next)
  }

  const periodMissing = !periodFrom || !periodTo
  const scenarioEmpty = scenarios.length === 0
  const noOverlap = !scenarioEmpty && availableScenarios.length < MIN_SCENARIOS
  const tooFew = validSelected.length < MIN_SCENARIOS
  const tooMany = validSelected.length > MAX_SCENARIOS

  const disabledReason = scenarioEmpty
    ? 'No scenarios found. Create one in Scheduling XL, or compare Production alone.'
    : noOverlap
      ? 'No scenarios overlap this period \u2014 widen the range.'
      : periodMissing
        ? 'Select a period to continue.'
        : tooFew
          ? `Pick ${MIN_SCENARIOS} to ${MAX_SCENARIOS} scenarios to compare.`
          : tooMany
            ? `Pick at most ${MAX_SCENARIOS} scenarios.`
            : null

  const disabled = loading || Boolean(disabledReason)

  const activeCount = (periodFrom && periodTo ? 1 : 0) + (validSelected.length > 0 ? 1 : 0)

  function handleGo() {
    if (disabled) return
    onGo({
      periodFrom,
      periodTo,
      scenarioIds: validSelected,
    })
  }

  return (
    <FilterPanel
      title="Compare"
      activeCount={activeCount}
      footer={
        <FilterGoButton
          onClick={handleGo}
          loading={loading}
          disabled={disabled}
          hint={disabledReason ?? `${validSelected.length} of ${MAX_SCENARIOS} selected`}
        />
      }
    >
      <FilterSection label="Period">
        <PeriodField from={periodFrom} to={periodTo} onChangeFrom={setPeriodFrom} onChangeTo={setPeriodTo} />
      </FilterSection>

      <FilterSection label={`Scenarios (${MIN_SCENARIOS}\u2013${MAX_SCENARIOS})`}>
        <MultiSelectField
          options={options}
          value={validSelected}
          onChange={handleSelectionChange}
          placeholder={
            scenarioEmpty
              ? 'No scenarios yet'
              : availableScenarios.length === 0
                ? 'No scenarios in this period'
                : 'Pick 2 to 3 scenarios'
          }
          noneLabel="None"
          searchable
          searchPlaceholder="Search scenarios"
          summaryBy="label"
          summaryMax={3}
        />
      </FilterSection>
    </FilterPanel>
  )
}
