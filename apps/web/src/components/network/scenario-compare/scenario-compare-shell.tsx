'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useOperatorStore, getOperatorId } from '@/stores/use-operator-store'
import { useRunwayLoading } from '@/hooks/use-runway-loading'
import { RunwayLoadingPanel } from '@/components/ui/runway-loading-panel'
import { EmptyPanel } from '@/components/ui/empty-panel'
import { api, useScenarios, useScenarioEnvelopes, useAircraftTypes } from '@skyhub/api'
import type { ScheduledFlightRef, ScenarioRef } from '@skyhub/api'
import { ScenarioCompareFilterPanel } from './scenario-compare-filter-panel'
import { ScenarioCompareHeader } from './scenario-compare-header'
import { ScenarioCompareOverview } from './scenario-compare-overview'
import { ScenarioDiffTable } from './scenario-diff-table'
import { computeScenarioCompare } from './compute-scenario-compare'
import type { ScenarioCompareFilterState, ScenarioCompareResult, ScenarioWithEnvelope } from './scenario-compare-types'

export function ScenarioCompareShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const loadOperator = useOperatorStore((s) => s.loadOperator)
  const operator = useOperatorStore((s) => s.operator)
  const runway = useRunwayLoading()

  useEffect(() => {
    loadOperator()
  }, [loadOperator])

  const operatorId = operator?._id ?? ''
  const scenariosQuery = useScenarios({ operatorId: operatorId || undefined })
  const envelopesQuery = useScenarioEnvelopes({ operatorId: operatorId || undefined })
  const aircraftTypesQuery = useAircraftTypes(operatorId)

  // Aircraft-type color map — sourced from the operator's Aircraft Types DB
  // so the "Flights by aircraft type" donut uses the same colors as the
  // rest of SkyHub (gantt, rotation, fleet widgets).
  const typeColors = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of aircraftTypesQuery.data ?? []) {
      if (t.color) m[t.icaoType] = t.color
    }
    return m
  }, [aircraftTypesQuery.data])

  const merged: ScenarioWithEnvelope[] = useMemo(() => {
    const list = scenariosQuery.data ?? []
    const envelopes = envelopesQuery.data ?? []
    const envMap = new Map(envelopes.map((e) => [e.scenarioId, e]))
    const prodEnvelope = envMap.get('__production__') ?? null
    // Synthetic Production "scenario" so users can compare a scenario against
    // live production even when there's only one authored scenario.
    const production: ScenarioWithEnvelope = {
      scenario: {
        _id: '__production__',
        operatorId: operatorId,
        seasonCode: '',
        name: 'Production',
        description: 'Live production schedule',
        status: 'published',
        parentScenarioId: null,
        publishedAt: null,
        publishedBy: null,
        createdBy: 'system',
        createdAt: null,
        updatedAt: null,
      },
      envelope: prodEnvelope,
    }
    const scenarios = list.map((scenario) => ({ scenario, envelope: envMap.get(scenario._id) ?? null }))
    return [production, ...scenarios]
  }, [scenariosQuery.data, envelopesQuery.data, operatorId])

  const [hasLoaded, setHasLoaded] = useState(false)
  const [filters, setFilters] = useState<ScenarioCompareFilterState | null>(null)
  const [selectedScenarios, setSelectedScenarios] = useState<ScenarioRef[]>([])
  const [result, setResult] = useState<ScenarioCompareResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadCompare = useCallback(
    async (f: ScenarioCompareFilterState) => {
      const opId = getOperatorId()
      if (!opId) throw new Error('Operator not loaded')
      const flightSets = await Promise.all(
        f.scenarioIds.map(async (scenarioId) => {
          const flights = await api.getScheduledFlights({ operatorId: opId, scenarioId })
          return { scenarioId, flights: flights as ScheduledFlightRef[] }
        }),
      )
      const computed = computeScenarioCompare(flightSets, { periodFrom: f.periodFrom, periodTo: f.periodTo })
      const byId = new Map(merged.map((m) => [m.scenario._id, m.scenario]))
      const scenarios = f.scenarioIds.map((id) => byId.get(id)).filter(Boolean) as ScenarioRef[]
      return { computed, scenarios }
    },
    [merged],
  )

  const handleGo = useCallback(
    async (f: ScenarioCompareFilterState) => {
      setFilters(f)
      setLoadError(null)
      await loadOperator()
      const outcome = await runway.run(async () => loadCompare(f), 'Comparing scenarios\u2026', 'Compare loaded')
      if (outcome) {
        setResult(outcome.computed)
        setSelectedScenarios(outcome.scenarios)
        setHasLoaded(true)
      } else {
        setLoadError('Failed to load scenarios. Retry.')
      }
    },
    [loadOperator, loadCompare, runway],
  )

  const handleRetry = useCallback(() => {
    if (filters) handleGo(filters)
  }, [filters, handleGo])

  const handleReset = useCallback(() => {
    setHasLoaded(false)
    setResult(null)
    setSelectedScenarios([])
    setFilters(null)
    setLoadError(null)
  }, [])

  const handleSwap = useCallback(() => {
    if (selectedScenarios.length < 2 || !result) return
    // 2-way: swap A/B. 3-way: rotate left so A→B, B→C, C→A — one press moves
    // each scenario one slot, three presses return to the original order.
    const nextScenarios =
      selectedScenarios.length === 2
        ? [selectedScenarios[1], selectedScenarios[0]]
        : [...selectedScenarios.slice(1), selectedScenarios[0]]
    setSelectedScenarios(nextScenarios)
    const nextPer = nextScenarios
      .map((s) => result.perScenario.find((p) => p.scenarioId === s._id))
      .filter(Boolean) as ScenarioCompareResult['perScenario']
    const nextRows = result.rows.map((row) => ({
      ...row,
      perScenario: nextScenarios
        .map((s) => row.perScenario.find((c) => c.scenarioId === s._id))
        .filter(Boolean) as typeof row.perScenario,
    }))
    setResult({ perScenario: nextPer, rows: nextRows })
  }, [selectedScenarios, result])

  const glassBg = isDark ? 'rgba(25,25,33,0.85)' : 'rgba(255,255,255,0.85)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  const glassStyle = {
    background: glassBg,
    border: `1px solid ${glassBorder}`,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  }

  return (
    <div className="flex h-full overflow-hidden gap-3 p-3">
      <ScenarioCompareFilterPanel loading={runway.active} scenarios={merged} onGo={handleGo} />

      <div className="flex-1 flex flex-col overflow-y-auto gap-3 min-w-0 min-h-0 relative">
        {!hasLoaded && !runway.active && (
          <EmptyPanel message="Pick 2 or 3 scenarios, set a period, and click Go to compare." />
        )}

        {runway.active && <RunwayLoadingPanel percent={runway.percent} label={runway.label} />}

        {hasLoaded && !runway.active && result && selectedScenarios.length >= 2 && (
          <>
            {loadError && (
              <div
                className="shrink-0 rounded-2xl px-4 py-2.5 flex items-center justify-between"
                style={{ background: 'rgba(230,53,53,0.10)', border: '1px solid rgba(230,53,53,0.35)' }}
              >
                <span className="text-[13px] font-medium" style={{ color: '#E63535' }}>
                  {loadError}
                </span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-[13px] font-semibold px-3 h-7 rounded-lg bg-module-accent text-white hover:opacity-90 transition-opacity"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="shrink-0 rounded-2xl overflow-hidden" style={glassStyle}>
              <ScenarioCompareHeader scenarios={selectedScenarios} onSwap={handleSwap} onReset={handleReset} />
            </div>

            <div className="shrink-0">
              <ScenarioCompareOverview
                scenarios={selectedScenarios}
                perScenario={result.perScenario}
                rows={result.rows}
                typeColors={typeColors}
              />
            </div>

            <div className="shrink-0 h-[560px] rounded-2xl overflow-hidden" style={glassStyle}>
              <ScenarioDiffTable rows={result.rows} scenarios={selectedScenarios} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
