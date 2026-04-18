'use client'

import type { GanttFlight } from '@/lib/gantt/types'
import { OccCard } from '../occ-card'
import { OccFlightRow, OccTag } from '../occ-flight-row'
import { OccEmpty, StatStrip, fmtHm } from '../lib/occ-helpers'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const D15_MS = 15 * 60 * 1000

interface ArrivalsCardProps {
  flights: GanttFlight[]
  conflictIds: Set<string>
  nowMs: number
}

export function ArrivalsCard({ flights, conflictIds, nowMs }: ArrivalsCardProps) {
  const late = flights.filter((f) => typeof f.etaUtc === 'number' && f.etaUtc > f.staUtc + D15_MS)
  return (
    <OccCard
      title="Arrivals · Next 2h"
      moduleCode="2.1.1"
      footLeft={
        <span>
          Window{' '}
          <span className="font-mono">
            {fmtHm(nowMs)} – {fmtHm(nowMs + TWO_HOURS_MS)}
          </span>
        </span>
      }
      footRight={{ label: 'Movement Control →', href: '/flight-ops/control/movement-control' }}
    >
      <div className="flex items-end gap-3 mb-2">
        <div className="font-mono text-[28px] font-bold leading-none tabular-nums tracking-[-0.02em]">
          {flights.length}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[.1em] text-[var(--occ-text-2)] font-semibold">
            Expected in
          </div>
          <div className="text-[11.5px] text-[var(--occ-text-3)]">
            <span className="text-[#FF3B3B]">●</span> {conflictIds.size} gate conflicts ·{' '}
            <span className="text-[#FF8800]">●</span> {late.length} delayed &gt;15m
          </div>
        </div>
      </div>
      <StatStrip
        cells={[
          { label: 'On-time', value: flights.length - late.length - conflictIds.size, tone: 'ok' },
          { label: 'Delay>15', value: late.length, tone: 'warn' },
          { label: 'Gate conf.', value: conflictIds.size, tone: 'err' },
          { label: 'Total', value: flights.length, tone: 'info' },
        ]}
      />
      <div className="mt-1">
        {flights.length === 0 ? (
          <OccEmpty message="All clear · nothing arriving in 2h" />
        ) : (
          flights.slice(0, 5).map((f) => <ArrivalRow key={f.id} flight={f} conflict={conflictIds.has(f.id)} />)
        )}
      </div>
    </OccCard>
  )
}

function ArrivalRow({ flight, conflict }: { flight: GanttFlight; conflict: boolean }) {
  const lateMin = typeof flight.etaUtc === 'number' ? Math.round((flight.etaUtc - flight.staUtc) / 60_000) : 0
  const tone: 'ok' | 'warn' | 'err' = conflict ? 'err' : lateMin > 15 ? 'warn' : 'ok'
  return (
    <OccFlightRow
      flightNumber={flight.flightNumber}
      depStation={flight.depStation}
      arrStation={flight.arrStation}
      tags={conflict ? <OccTag tone="gate">gate {flight.arrGate}</OccTag> : null}
      rightLabel={lateMin > 0 ? `+${lateMin}` : lateMin < 0 ? `−${Math.abs(lateMin)}` : '0'}
      rightTone={tone}
    />
  )
}
