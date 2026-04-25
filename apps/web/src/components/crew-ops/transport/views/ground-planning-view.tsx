'use client'

import { useMemo } from 'react'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { useTransportEmailStore } from '@/stores/use-transport-email-store'
import { StatusChip, fmtMoney, fmtTime, tripTypeLabel } from '../status-meta'
import type { TransportTrip } from '../types'

/** Long-horizon ground transport demand projection. Crew names shown lightly;
 *  the full per-stop breakdown is in the inspector. Right-click any row to
 *  pre-fill a dispatch-sheet email for the matching vendor. */
export function GroundPlanningView() {
  const trips = useCrewTransportStore((s) => s.trips)
  const setSegment = useCrewTransportStore((s) => s.setSegment)
  const setGroundTab = useCrewTransportStore((s) => s.setGroundTab)
  const selectedId = useCrewTransportStore((s) => s.selectedTripId)
  const setSelectedId = useCrewTransportStore((s) => s.setSelectedTripId)
  const openCompose = useTransportEmailStore((s) => s.openCompose)
  const setFolder = useTransportEmailStore((s) => s.setFolder)

  const groundTrips = useMemo(
    () =>
      trips
        .filter((t) => t.tripType !== 'inter-terminal')
        .slice()
        .sort((a, b) => a.scheduledTimeUtcMs - b.scheduledTimeUtcMs),
    [trips],
  )

  const handleComposeDispatchSheet = (t: TransportTrip) => {
    setSelectedId(t.id)
    setSegment('ground')
    setGroundTab('communication')
    setFolder('held')
    openCompose('new')
  }

  if (groundTrips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary">
        No ground trips for the selected period & filters.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-[13px]">
        <thead className="text-[13px] uppercase tracking-wider text-hz-text-secondary bg-hz-border/20 sticky top-0 z-10">
          <tr>
            <th className="text-left font-semibold px-4 py-2.5">Time</th>
            <th className="text-left font-semibold px-3 py-2.5">Direction</th>
            <th className="text-left font-semibold px-3 py-2.5">Pickup → Dropoff</th>
            <th className="text-center font-semibold px-3 py-2.5">Pax</th>
            <th className="text-left font-semibold px-3 py-2.5">Vendor / Vehicle</th>
            <th className="text-left font-semibold px-3 py-2.5">Status</th>
            <th className="text-right font-semibold px-3 py-2.5">Cost</th>
          </tr>
        </thead>
        <tbody>
          {groundTrips.map((t) => {
            const active = selectedId === t.id
            return (
              <tr
                key={t.id}
                onClick={() => setSelectedId(active ? null : t.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  handleComposeDispatchSheet(t)
                }}
                title="Right-click to compose dispatch sheet"
                className={`border-t border-hz-border cursor-pointer transition-colors ${
                  active ? 'bg-module-accent/[0.06]' : 'hover:bg-hz-border/20'
                }`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold tabular-nums text-hz-text">
                      {fmtTime(t.scheduledTimeUtcMs)}
                    </span>
                    <span className="text-[13px] text-hz-text-secondary tabular-nums">
                      {new Date(t.scheduledTimeUtcMs).toISOString().slice(0, 10)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[13px] text-hz-text">{tripTypeLabel(t.tripType)}</td>
                <td className="px-3 py-2.5">
                  <div className="text-[13px] text-hz-text truncate max-w-[260px]">
                    {t.fromLabel} → {t.toLabel}
                  </div>
                  {t.legFlightNumber && (
                    <div className="text-[13px] text-hz-text-secondary font-mono">{t.legFlightNumber}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-hz-text">{t.paxCount}</td>
                <td className="px-3 py-2.5">
                  {t.vendor ? (
                    <>
                      <div className="font-medium text-[13px] truncate max-w-[180px] text-hz-text">{t.vendor.name}</div>
                      <div className="text-[13px] text-hz-text-secondary">
                        {t.vendor.vehicleTierName ?? '—'}
                        {t.vendor.priority ? ` · P${t.vendor.priority}` : ''}
                      </div>
                    </>
                  ) : (
                    <span className="text-[13px] text-hz-text-tertiary">No vendor matched</span>
                  )}
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
  )
}
