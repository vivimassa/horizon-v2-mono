'use client'

import { useMemo } from 'react'
import type { GanttFlight } from '@/lib/gantt/types'
import { OccCard } from './occ-card'
import { aggregateStations } from './lib/aggregate-stations'
import { aggregateParetoByCategory } from './lib/aggregate-pareto'

const CATEGORY_COLOR: Record<string, string> = {
  'ATC / Airspace': '#0063F7',
  ATC: '#0063F7',
  Weather: '#00CFDE',
  Technical: '#FF3B3B',
  Crew: '#AC5DD9',
  'Ground / Commercial': '#FF8800',
  Ground: '#FF8800',
  Commercial: '#FF8800',
  Other: 'var(--occ-text-3)',
}

interface BandNetworkHealthProps {
  flights: GanttFlight[]
}

export function BandNetworkHealth({ flights }: BandNetworkHealthProps) {
  const stations = useMemo(() => aggregateStations(flights, 10), [flights])
  const maxStationMinutes = stations[0]?.delayMinutes ?? 1
  const systemDelay = stations.reduce((a, s) => a + s.delayMinutes, 0)

  const pareto = useMemo(() => aggregateParetoByCategory(flights), [flights])
  const paretoTotal = pareto.reduce((a, g) => a + g.totalMinutes, 0)
  const topFive = pareto.slice(0, 5)
  const paretoMax = topFive[0]?.codes[0]?.minutes ?? 1

  return (
    <section aria-label="Network Health">
      <BandHead tag="Network Health · 1.3" hint="Window reflects Time Filter above" />
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-3.5">
        <OccCard
          title="Station Performance · Top 10 by Delay Min"
          moduleCode="1.3.1"
          footLeft={
            <span>
              System-wide delay <span className="font-mono">{systemDelay.toLocaleString()} min</span>
            </span>
          }
          footRight={{ label: 'Daily Schedule →', href: '/flight-ops' }}
        >
          <div className="grid grid-cols-[60px_1fr_56px_44px] gap-2.5 pb-1.5 px-0.5 border-b border-[rgba(17,17,24,0.08)] dark:border-white/10 text-[10.5px] uppercase tracking-[.08em] text-[var(--occ-text-3)] font-semibold">
            <span>Station</span>
            <span>Delay distribution</span>
            <span className="text-right">Mins</span>
            <span className="text-right">Mov</span>
          </div>
          {stations.length === 0 ? (
            <OccEmpty message="No flights to score · window is empty" />
          ) : (
            stations.map((s) => (
              <div
                key={s.icao}
                className="grid grid-cols-[60px_1fr_56px_44px] gap-2.5 items-center h-[34px] text-[12px] px-0.5 rounded hover:bg-[rgba(17,17,24,0.04)] dark:hover:bg-white/5 cursor-pointer"
              >
                <span className="font-mono font-bold tracking-[.04em] text-[var(--occ-text)]">{s.icao}</span>
                <div className="relative h-[18px] bg-[rgba(17,17,24,0.05)] dark:bg-white/5 rounded-[5px] overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-[5px]"
                    style={{
                      width: `${(s.delayMinutes / maxStationMinutes) * 100}%`,
                      background:
                        s.delayMinutes > maxStationMinutes * 0.7
                          ? 'linear-gradient(90deg, rgba(255,59,59,0.5), #FF3B3B)'
                          : 'linear-gradient(90deg, rgba(255,136,0,0.5), #FF8800)',
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold text-[var(--occ-text)]">
                    {s.minutesPerMovement.toFixed(1)} min/mv
                  </span>
                </div>
                <span className="text-right font-mono font-semibold text-[var(--occ-text)]">
                  {s.delayMinutes.toLocaleString()}
                </span>
                <span className="text-right text-[var(--occ-text-3)] font-mono">{s.movements}</span>
              </div>
            ))
          )}
        </OccCard>

        <OccCard
          title="Delay Cause · Pareto (AHM codes)"
          tone="warn"
          moduleCode="1.3.2"
          footLeft={
            <span>
              <span className="font-mono">{paretoTotal.toLocaleString()} min</span> total coded
            </span>
          }
        >
          {topFive.length === 0 ? (
            <OccEmpty message="No delay codes captured in window" />
          ) : (
            topFive.map((g) => {
              const color = CATEGORY_COLOR[g.category] ?? 'var(--occ-accent)'
              return (
                <div key={g.category} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <i className="w-2 h-2 rounded-sm" style={{ background: color }} />
                    <span className="text-[11.5px] font-semibold text-[var(--occ-text)]">{g.category}</span>
                    <span className="ml-auto font-mono text-[11.5px] text-[var(--occ-text-2)]">
                      {g.totalMinutes.toLocaleString()} min
                    </span>
                  </div>
                  {g.codes.slice(0, 3).map((c) => (
                    <div
                      key={c.code}
                      className="grid grid-cols-[44px_1fr_64px] gap-2 items-center h-[26px] text-[11.5px] px-0.5 rounded hover:bg-[rgba(17,17,24,0.04)] dark:hover:bg-white/5 cursor-pointer"
                    >
                      <span className="font-mono font-semibold text-[var(--occ-text)]">{c.code}</span>
                      <div className="h-[5px] bg-[rgba(17,17,24,0.05)] dark:bg-white/5 rounded-[3px] overflow-hidden">
                        <span
                          className="block h-full rounded-[3px]"
                          style={{ width: `${(c.minutes / paretoMax) * 100}%`, background: color }}
                        />
                      </div>
                      <span className="text-right font-mono text-[var(--occ-text-2)]">{c.minutes} m</span>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </OccCard>
      </div>
    </section>
  )
}

function BandHead({ tag, hint }: { tag: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5 mx-1 mb-2 mt-1">
      <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[var(--occ-text-3)]">{tag}</span>
      <span className="flex-1 h-px bg-[rgba(17,17,24,0.08)] dark:bg-white/10" />
      {hint && <span className="text-[11.5px] text-[var(--occ-text-3)]">{hint}</span>}
    </div>
  )
}

function OccEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-5 gap-2 text-[var(--occ-text-2)]">
      <div className="w-9 h-9 rounded-full bg-[rgba(6,194,112,0.16)] text-[#06C270] grid place-items-center">✓</div>
      <div className="text-[12.5px] font-medium">{message}</div>
    </div>
  )
}
