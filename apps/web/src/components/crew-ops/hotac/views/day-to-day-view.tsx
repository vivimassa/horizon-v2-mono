'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useHotacStore } from '@/stores/use-hotac-store'
import { StatusChip, fmtMoney } from '../status-meta'
import type { HotacBooking } from '../types'

const HOURS_MS = 3_600_000

/** Day to Day — short-horizon view (next 7 days). Shows real crew names so
 *  HOTAC operators can act on operational disruptions. */
export function DayToDayView() {
  const bookings = useHotacStore((s) => s.bookings)
  const selectedId = useHotacStore((s) => s.selectedBookingId)
  const setSelectedId = useHotacStore((s) => s.setSelectedBookingId)

  const visible = useMemo(() => {
    const now = Date.now()
    const sevenDays = now + 7 * 24 * HOURS_MS
    return bookings
      .filter((b) => b.layoverNightUtcMs >= now - 24 * HOURS_MS && b.layoverNightUtcMs <= sevenDays)
      .sort((a, b) => a.layoverNightUtcMs - b.layoverNightUtcMs)
  }, [bookings])

  if (visible.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary">
        No layovers in the next 7 days.
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
            <th className="text-left font-semibold px-3 py-2.5">In / Out</th>
            <th className="text-left font-semibold px-3 py-2.5">Crew</th>
            <th className="text-left font-semibold px-3 py-2.5">Hotel</th>
            <th className="text-center font-semibold px-3 py-2.5">Rooms</th>
            <th className="text-left font-semibold px-3 py-2.5">Status</th>
            <th className="text-right font-semibold px-3 py-2.5">Cost</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((b) => {
            const active = selectedId === b.id
            const flagged = b.disruptionFlags.length > 0
            return (
              <tr
                key={b.id}
                onClick={() => setSelectedId(active ? null : b.id)}
                className={`border-t border-hz-border cursor-pointer transition-colors ${
                  active
                    ? 'bg-module-accent/[0.06]'
                    : flagged
                      ? 'bg-[#FF8800]/[0.04] hover:bg-[#FF8800]/[0.08]'
                      : 'hover:bg-hz-border/20'
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
                <td className="px-3 py-2.5 text-[13px] tabular-nums text-hz-text">
                  <div>
                    {b.arrFlight ?? '—'} {fmtTime(b.arrStaUtcIso)}
                  </div>
                  <div className="text-hz-text-secondary">
                    {b.depFlight ?? '—'} {fmtTime(b.depStdUtcIso)}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <CrewSummary booking={b} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-[13px] truncate max-w-[180px] text-hz-text">
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
                  <div className="flex flex-col gap-1">
                    <StatusChip status={b.status} size="sm" />
                    {flagged && (
                      <span className="inline-flex items-center gap-1 text-[13px] font-semibold px-1.5 py-px rounded bg-[#FF8800]/10 text-[#FF8800] border border-[#FF8800]/30">
                        <AlertTriangle className="h-3 w-3" />
                        {b.disruptionFlags[0]?.replace(/-/g, ' ')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-[13px] tabular-nums font-medium text-hz-text">
                  {b.hotel ? fmtMoney(b.cost, b.costCurrency) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CrewSummary({ booking }: { booking: HotacBooking }) {
  if (booking.crew.length === 0) {
    const positionLine = Object.entries(booking.crewByPosition)
      .map(([k, n]) => `${n}× ${k}`)
      .join(' · ')
    return <span className="text-[13px] text-hz-text-secondary">{positionLine || '—'}</span>
  }
  const head = booking.crew
    .slice(0, 2)
    .map((c) => c.name)
    .join(', ')
  const more = booking.crew.length > 2 ? ` +${booking.crew.length - 2}` : ''
  return (
    <div>
      <div className="text-[13px] text-hz-text">
        {head}
        {more}
      </div>
      <div className="text-[13px] text-hz-text-secondary">
        {Object.entries(booking.crewByPosition)
          .map(([k, n]) => `${n}× ${k}`)
          .join(' · ')}
      </div>
    </div>
  )
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}z`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}
