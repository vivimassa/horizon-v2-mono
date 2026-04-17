'use client'

import type { ScenarioRef } from '@skyhub/api'
import { ScenarioStatsCard } from './scenario-stats-card'
import type { ScenarioCompareResult, ScenarioStats } from './scenario-compare-types'

interface ScenarioStatsGridProps {
  scenarios: ScenarioRef[]
  perScenario: ScenarioCompareResult['perScenario']
}

const LETTERS = ['A', 'B', 'C'] as const

function averageOfOthers(all: ScenarioStats[], selfIdx: number): ScenarioStats | null {
  const others = all.filter((_, i) => i !== selfIdx)
  if (others.length === 0) return null
  const avg = <K extends keyof ScenarioStats>(key: K): number => {
    const sum = others.reduce((s, o) => s + (o[key] as number), 0)
    return sum / others.length
  }
  return {
    totalFlights: avg('totalFlights'),
    totalSectors: avg('totalSectors'),
    totalBlockHours: avg('totalBlockHours'),
    uniqueStations: avg('uniqueStations'),
    uniqueRoutes: avg('uniqueRoutes'),
    aircraftTypes: [],
    statusBreakdown: { draft: 0, active: 0, suspended: 0, cancelled: 0 },
  }
}

export function ScenarioStatsGrid({ scenarios, perScenario }: ScenarioStatsGridProps) {
  const statsOrdered = scenarios.map((s) => perScenario.find((p) => p.scenarioId === s._id)?.stats)
  const allStats = statsOrdered.filter(Boolean) as ScenarioStats[]

  const colsClass = scenarios.length === 3 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'

  return (
    <div className={`grid gap-3 ${colsClass}`}>
      {scenarios.map((scenario, idx) => {
        const stats = statsOrdered[idx]
        if (!stats) return null
        const other = averageOfOthers(allStats, idx)
        return (
          <ScenarioStatsCard
            key={scenario._id}
            side={LETTERS[idx] ?? '?'}
            scenario={scenario}
            stats={stats}
            other={other}
          />
        )
      })}
    </div>
  )
}
