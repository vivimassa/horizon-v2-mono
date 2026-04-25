'use client'

import { useMemo } from 'react'
import { useHotacStore } from '@/stores/use-hotac-store'
import { useHotacEmailStore } from '@/stores/use-hotac-email-store'
import { StatusChip, fmtMoney } from '../status-meta'
import type { HotacBooking } from '../types'

/** Planning — long-horizon hotel demand projection. Crew counts are the
 *  primary signal; full crew names are intentionally NOT loaded here. */
export function PlanningView() {
  const bookings = useHotacStore((s) => s.bookings)
  const selectedId = useHotacStore((s) => s.selectedBookingId)
  const setSelectedId = useHotacStore((s) => s.setSelectedBookingId)
  const setActiveTab = useHotacStore((s) => s.setActiveTab)
  const openCompose = useHotacEmailStore((s) => s.openCompose)
  const setFolder = useHotacEmailStore((s) => s.setFolder)

  const handleComposeRoomingList = (b: HotacBooking) => {
    setSelectedId(b.id)
    setFolder('held')
    setActiveTab('communication')
    openCompose('new')
  }

  // Group by station-night for the demand table.
  const grouped = useMemo(() => {
    const m = new Map<string, HotacBooking[]>()
    for (const b of bookings) {
      const k = `${b.airportIcao}::${b.layoverNightUtcMs}`
      const arr = m.get(k)
      if (arr) arr.push(b)
      else m.set(k, [b])
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [bookings])

  if (bookings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary">
        No layovers detected for the selected period & filters.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-[13px]">
        <thead className="text-[13px] uppercase tracking-wider text-hz-text-secondary bg-hz-border/20 sticky top-0 z-10">
          <tr>
            <th className="text-left font-semibold px-4 py-2.5">Station</th>
            <th className="text-left font-semibold px-3 py-2.5">Night</th>
            <th className="text-left font-semibold px-3 py-2.5">Pairing</th>
            <th className="text-center font-semibold px-3 py-2.5">Pax</th>
            <th className="text-left font-semibold px-3 py-2.5">By Position</th>
            <th className="text-left font-semibold px-3 py-2.5">Suggested Hotel</th>
            <th className="text-center font-semibold px-3 py-2.5">Rooms</th>
            <th className="text-left font-semibold px-3 py-2.5">Status</th>
            <th className="text-right font-semibold px-3 py-2.5">Cost</th>
          </tr>
        </thead>
        <tbody>
          {grouped.flatMap(([_key, group]) =>
            group.map((b) => {
              const active = selectedId === b.id
              const positionLine = Object.entries(b.crewByPosition)
                .map(([k, n]) => `${n}× ${k}`)
                .join(' · ')
              return (
                <tr
                  key={b.id}
                  onClick={() => setSelectedId(active ? null : b.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleComposeRoomingList(b)
                  }}
                  title="Right-click to compose rooming list"
                  className={`border-t border-hz-border cursor-pointer transition-colors ${
                    active ? 'bg-module-accent/[0.06]' : 'hover:bg-hz-border/20'
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-module-accent/10 text-module-accent flex items-center justify-center text-[13px] font-bold">
                        {b.airportIata}
                      </div>
                      <div className="text-[13px] text-hz-text-secondary">{b.airportIcao}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] tabular-nums text-hz-text">
                    {new Date(b.layoverNightUtcMs).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text">{b.pairingCode}</td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-hz-text">{b.pax}</td>
                  <td className="px-3 py-2.5 text-[13px] text-hz-text">{positionLine || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[13px] truncate max-w-[200px] text-hz-text">
                      {b.hotel?.name ?? <span className="text-hz-text-tertiary">No hotel matched</span>}
                    </div>
                    {b.hotel && (
                      <div className="text-[13px] text-hz-text-secondary">
                        {b.hotel.distance} min · P{b.hotel.priority}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-hz-text">{b.rooms}</td>
                  <td className="px-3 py-2.5">
                    <StatusChip status={b.status} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] tabular-nums font-medium text-hz-text">
                    {b.hotel ? fmtMoney(b.cost, b.costCurrency) : '—'}
                  </td>
                </tr>
              )
            }),
          )}
        </tbody>
      </table>
    </div>
  )
}
