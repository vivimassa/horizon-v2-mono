'use client'

import type { GanttFlight } from '@/lib/gantt/types'
import { OccCard } from '../occ-card'
import { OccFlightRow } from '../occ-flight-row'
import { OccEmpty } from '../lib/occ-helpers'

interface AirborneCardProps {
  flights: GanttFlight[]
  nowMs: number
}

export function AirborneCard({ flights, nowMs }: AirborneCardProps) {
  const nearing = [...flights]
    .filter((f) => typeof f.etaUtc === 'number' || typeof f.staUtc === 'number')
    .sort((a, b) => (a.etaUtc ?? a.staUtc) - (b.etaUtc ?? b.staUtc))
    .slice(0, 5)

  return (
    <OccCard
      title="Flights Airborne Now"
      moduleCode="2.1.1"
      footLeft={<span>Derived from OUT/IN times</span>}
      footRight={{ label: 'Movement Control →', href: '/flight-ops/control/movement-control' }}
    >
      <div className="flex items-end gap-3 mb-2.5">
        <div className="font-mono text-[28px] font-bold leading-none tabular-nums tracking-[-0.02em]">
          {flights.length}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[.1em] text-[var(--occ-text-2)] font-semibold">In the air</div>
          <div className="text-[11.5px] text-[var(--occ-text-3)]">
            {flights.length > 0 ? `avg ETA in ${avgRemainingMinutes(flights, nowMs)} min` : 'no active flights'}
          </div>
        </div>
      </div>
      {nearing.length === 0 ? (
        <OccEmpty message="All clear · no airborne flights" />
      ) : (
        <div className="mt-2.5 pt-2.5 border-t border-dashed border-[rgba(17,17,24,0.08)] dark:border-white/10">
          <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[.1em] font-semibold text-[var(--occ-text-3)] mb-1">
            <span>Nearing arrival</span>
            <span>ETA Δ</span>
          </div>
          {nearing.map((f) => {
            const eta = f.etaUtc ?? f.staUtc
            const deltaMs = eta - f.staUtc
            const deltaMin = Math.round(deltaMs / 60_000)
            const tone: 'ok' | 'warn' | 'muted' = deltaMin <= 0 ? 'ok' : deltaMin > 15 ? 'warn' : 'muted'
            return (
              <OccFlightRow
                key={f.id}
                flightNumber={f.flightNumber}
                depStation={f.depStation}
                arrStation={f.arrStation}
                meta={f.aircraftReg ?? f.aircraftTypeIcao ?? ''}
                rightLabel={deltaMin === 0 ? '0' : deltaMin > 0 ? `+${deltaMin}` : `−${Math.abs(deltaMin)}`}
                rightTone={tone}
              />
            )
          })}
        </div>
      )}
    </OccCard>
  )
}

function avgRemainingMinutes(flights: GanttFlight[], nowMs: number): number {
  const remainings = flights
    .map((f) => {
      const eta = f.etaUtc ?? f.staUtc
      return Math.max(0, Math.round((eta - nowMs) / 60_000))
    })
    .filter((n) => n > 0)
  if (remainings.length === 0) return 0
  return Math.round(remainings.reduce((a, b) => a + b, 0) / remainings.length)
}
