'use client'

import { useMemo } from 'react'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { StatusChip, fmtMoney, fmtTime, tripTypeLabel } from '../status-meta'
import type { TransportTrip } from '../types'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Day-to-Day operational view with a per-station timeline strip on top and
 *  the same trip list below — but with Driver / Plate columns visible. */
export function GroundDayToDayView() {
  const trips = useCrewTransportStore((s) => s.trips)
  const selectedId = useCrewTransportStore((s) => s.selectedTripId)
  const setSelectedId = useCrewTransportStore((s) => s.setSelectedTripId)

  const todayTrips = useMemo(() => {
    const start = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    const end = start + DAY_MS
    return trips
      .filter((t) => t.scheduledTimeUtcMs >= start && t.scheduledTimeUtcMs < end)
      .sort((a, b) => a.scheduledTimeUtcMs - b.scheduledTimeUtcMs)
  }, [trips])

  const byStation = useMemo(() => {
    const m = new Map<string, TransportTrip[]>()
    for (const t of todayTrips) {
      const arr = m.get(t.airportIcao)
      if (arr) arr.push(t)
      else m.set(t.airportIcao, [t])
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [todayTrips])

  if (todayTrips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary">
        No trips scheduled today.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-hz-border space-y-3">
        {byStation.map(([icao, list]) => (
          <TimelineStrip key={icao} icao={icao} trips={list} selectedId={selectedId} onSelect={setSelectedId} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[13px]">
          <thead className="text-[13px] uppercase tracking-wider text-hz-text-secondary bg-hz-border/20 sticky top-0 z-10">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Time</th>
              <th className="text-left font-semibold px-3 py-2.5">Direction</th>
              <th className="text-left font-semibold px-3 py-2.5">Pickup → Dropoff</th>
              <th className="text-center font-semibold px-3 py-2.5">Pax</th>
              <th className="text-left font-semibold px-3 py-2.5">Vendor</th>
              <th className="text-left font-semibold px-3 py-2.5">Driver / Plate</th>
              <th className="text-left font-semibold px-3 py-2.5">Status</th>
              <th className="text-right font-semibold px-3 py-2.5">Cost</th>
            </tr>
          </thead>
          <tbody>
            {todayTrips.map((t) => {
              const active = selectedId === t.id
              return (
                <tr
                  key={t.id}
                  onClick={() => setSelectedId(active ? null : t.id)}
                  className={`border-t border-hz-border cursor-pointer transition-colors ${
                    active ? 'bg-module-accent/[0.06]' : 'hover:bg-hz-border/20'
                  }`}
                >
                  <td className="px-4 py-2.5 text-[13px] font-bold tabular-nums text-hz-text">
                    {fmtTime(t.scheduledTimeUtcMs)}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-hz-text">{tripTypeLabel(t.tripType)}</td>
                  <td className="px-3 py-2.5 text-[13px] text-hz-text truncate max-w-[260px]">
                    {t.fromLabel} → {t.toLabel}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-hz-text">{t.paxCount}</td>
                  <td className="px-3 py-2.5 text-[13px] text-hz-text">
                    {t.vendor?.name ?? <span className="text-hz-text-tertiary">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-hz-text">
                    {t.driverName ?? <span className="text-hz-text-tertiary">—</span>}
                    {t.vehiclePlate && <span className="text-hz-text-secondary"> · {t.vehiclePlate}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusChip status={t.status} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums font-medium text-hz-text">
                    {t.vendor ? fmtMoney(t.cost, t.costCurrency) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface StripProps {
  icao: string
  trips: TransportTrip[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function TimelineStrip({ icao, trips, selectedId, onSelect }: StripProps) {
  // 24h strip 00:00–24:00 UTC. Each trip = a small pill positioned by hour.
  const startMs = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const endMs = startMs + DAY_MS
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-4 rounded-full bg-module-accent" />
        <span className="text-[13px] font-bold text-hz-text">{icao}</span>
        <span className="text-[13px] text-hz-text-secondary">
          {trips.length} trip{trips.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="relative h-9 rounded-lg bg-hz-border/20 overflow-hidden">
        {/* hour ticks */}
        {Array.from({ length: 25 }).map((_, h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 w-px bg-hz-border/40"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {trips.map((t) => {
          const pct = ((t.scheduledTimeUtcMs - startMs) / (endMs - startMs)) * 100
          const active = selectedId === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              title={`${fmtTime(t.scheduledTimeUtcMs)} ${tripTypeLabel(t.tripType)} · ${t.paxCount} pax`}
              className={`absolute top-1 bottom-1 px-1.5 rounded-md text-[13px] font-semibold transition-colors flex items-center justify-center ${
                active
                  ? 'bg-module-accent text-white shadow-[0_1px_3px_rgba(96,97,112,0.20)]'
                  : 'bg-module-accent/15 text-module-accent hover:bg-module-accent/25'
              }`}
              style={{ left: `calc(${pct}% - 22px)` }}
            >
              {t.paxCount}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between mt-0.5 text-[13px] text-hz-text-tertiary tabular-nums">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  )
}
