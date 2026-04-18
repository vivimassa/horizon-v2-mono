'use client'

import { useMemo } from 'react'
import type { GanttFlight } from '@/lib/gantt/types'
import { AirborneCard } from './cards/airborne-card'
import { DeparturesCard } from './cards/departures-card'
import { ArrivalsCard } from './cards/arrivals-card'
import { BandHead } from './lib/occ-helpers'
import { detectGateConflicts, flightIdsWithConflict } from './lib/detect-gate-conflicts'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

interface BandLiveOperationsProps {
  flights: GanttFlight[]
  nowMs: number
}

export function BandLiveOperations({ flights, nowMs }: BandLiveOperationsProps) {
  const { airborne, departures, arrivals, depConflictIds, arrConflictIds } = useMemo(() => {
    const airborne = flights.filter((f) => typeof f.atdUtc === 'number' && typeof f.ataUtc !== 'number')
    const departures = flights
      .filter((f) => f.stdUtc >= nowMs && f.stdUtc <= nowMs + TWO_HOURS_MS && f.status !== 'cancelled')
      .sort((a, b) => a.stdUtc - b.stdUtc)
    const arrivals = flights
      .filter((f) => f.staUtc >= nowMs && f.staUtc <= nowMs + TWO_HOURS_MS && f.status !== 'cancelled')
      .sort((a, b) => a.staUtc - b.staUtc)
    const depConflicts = detectGateConflicts(departures, 'dep')
    const arrConflicts = detectGateConflicts(arrivals, 'arr')
    return {
      airborne,
      departures,
      arrivals,
      depConflictIds: flightIdsWithConflict(depConflicts),
      arrConflictIds: flightIdsWithConflict(arrConflicts),
    }
  }, [flights, nowMs])

  return (
    <section aria-label="Live Operations">
      <BandHead tag="Live Operations · 2.1.1" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        <AirborneCard flights={airborne} nowMs={nowMs} />
        <DeparturesCard flights={departures} conflictIds={depConflictIds} nowMs={nowMs} />
        <ArrivalsCard flights={arrivals} conflictIds={arrConflictIds} nowMs={nowMs} />
      </div>
    </section>
  )
}
