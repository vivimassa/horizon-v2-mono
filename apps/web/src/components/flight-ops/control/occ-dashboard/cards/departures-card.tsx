'use client'

import type { ReactNode } from 'react'
import type { GanttFlight } from '@/lib/gantt/types'
import { OccCard } from '../occ-card'
import { OccFlightRow, OccTag } from '../occ-flight-row'
import { OccEmpty, StatStrip, fmtHm } from '../lib/occ-helpers'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const D15_MS = 15 * 60 * 1000

interface DeparturesCardProps {
  flights: GanttFlight[]
  conflictIds: Set<string>
  nowMs: number
}

export function DeparturesCard({ flights, conflictIds, nowMs }: DeparturesCardProps) {
  const counts = countDepartureRisks(flights, conflictIds)
  return (
    <OccCard
      title="Departures · Next 2h"
      tone="warn"
      moduleCode="2.1.1"
      footLeft={
        <span>
          Window{' '}
          <span className="font-mono">
            {fmtHm(nowMs)} – {fmtHm(nowMs + TWO_HOURS_MS)}
          </span>
        </span>
      }
      footRight={{ label: 'Disruption Center →', href: '/flight-ops/control/disruption-center' }}
    >
      <div className="flex items-end gap-3 mb-2">
        <div className="font-mono text-[28px] font-bold leading-none tabular-nums tracking-[-0.02em]">
          {flights.length}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[.1em] text-[var(--occ-text-2)] font-semibold">
            Scheduled out
          </div>
          <div className="text-[11.5px] text-[var(--occ-text-3)]">
            <span className="text-[#FF8800]">●</span> {counts.atRisk} at risk ·{' '}
            <span className="text-[#FF3B3B]">●</span> {counts.blocked} blocked
          </div>
        </div>
      </div>
      <StatStrip
        cells={[
          { label: 'On-plan', value: counts.onPlan, tone: 'ok' },
          { label: 'Delayed', value: counts.delayed, tone: 'warn' },
          { label: 'Gate conf.', value: counts.gateConflict, tone: 'err' },
          { label: 'No a/c', value: counts.noAircraft, tone: 'info' },
        ]}
      />
      <div className="mt-1">
        {flights.length === 0 ? (
          <OccEmpty message="All clear · nothing pushing in 2h" />
        ) : (
          flights.slice(0, 5).map((f) => <DepartureRow key={f.id} flight={f} conflict={conflictIds.has(f.id)} />)
        )}
      </div>
    </OccCard>
  )
}

function DepartureRow({ flight, conflict }: { flight: GanttFlight; conflict: boolean }) {
  const delayedMin = typeof flight.etdUtc === 'number' ? Math.round((flight.etdUtc - flight.stdUtc) / 60_000) : 0
  const tags: ReactNode[] = []
  if (delayedMin > 15)
    tags.push(
      <OccTag key="delay" tone="delay">
        ▲ {delayedMin}m
      </OccTag>,
    )
  if (conflict)
    tags.push(
      <OccTag key="gate" tone="gate">
        gate conflict
      </OccTag>,
    )
  if (!flight.aircraftReg)
    tags.push(
      <OccTag key="swap" tone="swap">
        no a/c
      </OccTag>,
    )
  return (
    <OccFlightRow
      flightNumber={flight.flightNumber}
      depStation={flight.depStation}
      arrStation={flight.arrStation}
      tags={<span className="flex gap-1.5 ml-1">{tags}</span>}
      rightLabel={fmtHm(flight.stdUtc)}
      rightTone="muted"
    />
  )
}

function countDepartureRisks(flights: GanttFlight[], conflictIds: Set<string>) {
  let onPlan = 0
  let delayed = 0
  let noAircraft = 0
  for (const f of flights) {
    const isDelayed = typeof f.etdUtc === 'number' && f.etdUtc - f.stdUtc > D15_MS
    if (isDelayed) delayed += 1
    if (!f.aircraftReg) noAircraft += 1
    if (!isDelayed && f.aircraftReg && !conflictIds.has(f.id)) onPlan += 1
  }
  return {
    onPlan,
    delayed,
    gateConflict: conflictIds.size,
    noAircraft,
    atRisk: delayed + noAircraft,
    blocked: conflictIds.size,
  }
}
