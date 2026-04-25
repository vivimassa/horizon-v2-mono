'use client'

import { useMemo, useState } from 'react'
import { Pencil, FileText, Image as ImageIcon } from 'lucide-react'
import { api, type CrewFlightBookingRef } from '@skyhub/api'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { FlightBookingDrawer } from './flight-booking-drawer'

interface Props {
  /** When 'history' shows cancelled + past-date bookings; otherwise active. */
  mode: 'booked' | 'history'
}

export function FlightBookedView({ mode }: Props) {
  const flightBookings = useCrewTransportStore((s) => s.flightBookings)
  const setFlightBookings = useCrewTransportStore((s) => s.setFlightBookings)
  const [editing, setEditing] = useState<CrewFlightBookingRef | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const list = useMemo(() => {
    return flightBookings
      .filter((b) => {
        const isPast = (b.flightDate ?? '') < today
        const isHistory = b.status === 'cancelled' || isPast
        return mode === 'history' ? isHistory : !isHistory
      })
      .sort((a, b) => (a.flightDate ?? '').localeCompare(b.flightDate ?? ''))
  }, [flightBookings, mode, today])

  if (list.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary">
        {mode === 'history' ? 'No cancelled or completed bookings.' : 'No active bookings.'}
      </div>
    )
  }

  const refresh = async () => {
    const { periodFrom, periodTo } = useCrewTransportStore.getState()
    try {
      const docs = await api.getCrewFlightBookings({ from: periodFrom, to: periodTo })
      setFlightBookings(docs)
    } catch (err) {
      console.warn('[transport] failed to refresh', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-[13px]">
        <thead className="text-[13px] uppercase tracking-wider text-hz-text-secondary bg-hz-border/20 sticky top-0 z-10">
          <tr>
            <th className="text-left font-semibold px-4 py-2.5">Date</th>
            <th className="text-left font-semibold px-3 py-2.5">Pairing</th>
            <th className="text-left font-semibold px-3 py-2.5">Method</th>
            <th className="text-left font-semibold px-3 py-2.5">Carrier · Flight</th>
            <th className="text-left font-semibold px-3 py-2.5">Route</th>
            <th className="text-left font-semibold px-3 py-2.5">PNR / Position</th>
            <th className="text-center font-semibold px-3 py-2.5">Files</th>
            <th className="text-left font-semibold px-3 py-2.5">Status</th>
            {mode === 'booked' && <th className="text-right font-semibold px-3 py-2.5"></th>}
          </tr>
        </thead>
        <tbody>
          {list.map((b) => (
            <tr key={b._id} className="border-t border-hz-border hover:bg-hz-border/20 transition-colors">
              <td className="px-4 py-2.5 text-[13px] tabular-nums text-hz-text">{b.flightDate ?? '—'}</td>
              <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text">{b.pairingCode}</td>
              <td className="px-3 py-2.5 text-[13px] text-hz-text">{b.method === 'ticket' ? 'Ticket' : 'GENDEC'}</td>
              <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text">
                {b.carrierCode ?? '—'} {b.flightNumber ?? ''}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-hz-text">
                {b.depStation ?? '—'} → {b.arrStation ?? '—'}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-hz-text">
                {b.method === 'ticket'
                  ? (b.pnr ?? <span className="text-hz-text-tertiary">—</span>)
                  : (b.gendecPosition ?? '—')}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center justify-center gap-1">
                  {b.attachments.map((a) => (
                    <a
                      key={a._id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      title={a.name}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-module-accent hover:bg-module-accent/15"
                    >
                      {a.mimeType?.startsWith('image/') ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                    </a>
                  ))}
                  {b.attachments.length === 0 && <span className="text-[13px] text-hz-text-tertiary">—</span>}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <StatusPill status={b.status} />
              </td>
              {mode === 'booked' && (
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold bg-module-accent/12 text-module-accent hover:bg-module-accent/20 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <FlightBookingDrawer
          existing={editing}
          leg={null}
          onClosed={(changed) => {
            setEditing(null)
            if (changed) void refresh()
          }}
        />
      )}
    </div>
  )
}

function StatusPill({ status }: { status: CrewFlightBookingRef['status'] }) {
  const map: Record<CrewFlightBookingRef['status'], string> = {
    pending: 'bg-[#FF8800]/12 text-[#FF8800] border-[#FF8800]/30',
    booked: 'bg-[#0063F7]/12 text-[#0063F7] border-[#0063F7]/30',
    confirmed: 'bg-[#06C270]/12 text-[#06C270] border-[#06C270]/30',
    cancelled: 'bg-[#FF3B3B]/12 text-[#FF3B3B] border-[#FF3B3B]/30',
  }
  const labels: Record<CrewFlightBookingRef['status'], string> = {
    pending: 'Pending',
    booked: 'Booked',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-[3px] rounded-md border text-[13px] font-semibold whitespace-nowrap ${map[status]}`}
    >
      {labels[status]}
    </span>
  )
}
