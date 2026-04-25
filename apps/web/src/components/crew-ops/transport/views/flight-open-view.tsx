'use client'

import { useMemo, useState } from 'react'
import { Plane, Plus } from 'lucide-react'
import type { CrewFlightBookingRef, PairingLegRef, PairingRef } from '@skyhub/api'
import { useCrewTransportStore } from '@/stores/use-crew-transport-store'
import { FlightBookingDrawer } from './flight-booking-drawer'

interface DeadheadLeg {
  pairing: PairingRef
  leg: PairingLegRef
}

/** Lists deadhead legs from cached pairings that don't yet have a CrewFlightBooking. */
export function FlightOpenView() {
  const pairings = useCrewTransportStore((s) => s.pairings)
  const flightBookings = useCrewTransportStore((s) => s.flightBookings)
  const upsertBooking = useCrewTransportStore((s) => s.upsertFlightBooking)
  const [active, setActive] = useState<DeadheadLeg | null>(null)

  const bookedLegIds = useMemo(() => {
    const s = new Set<string>()
    for (const b of flightBookings) {
      if (b.status !== 'cancelled') s.add(`${b.pairingId}::${b.legId}`)
    }
    return s
  }, [flightBookings])

  const open = useMemo(() => {
    const out: DeadheadLeg[] = []
    for (const p of pairings) {
      for (const leg of p.legs ?? []) {
        if (!leg.isDeadhead) continue
        const k = `${p._id}::${leg.flightId}`
        if (bookedLegIds.has(k)) continue
        out.push({ pairing: p, leg })
      }
    }
    return out.sort((a, b) => Date.parse(a.leg.stdUtcIso) - Date.parse(b.leg.stdUtcIso))
  }, [pairings, bookedLegIds])

  if (pairings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-hz-text-secondary">
        Click Go to load pairings.
      </div>
    )
  }
  if (open.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center text-[13px] text-hz-text-secondary px-12">
        <div>
          <Plane className="h-8 w-8 text-module-accent mx-auto mb-2" strokeWidth={1.6} />
          No open deadhead legs in this period.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-[13px]">
        <thead className="text-[13px] uppercase tracking-wider text-hz-text-secondary bg-hz-border/20 sticky top-0 z-10">
          <tr>
            <th className="text-left font-semibold px-4 py-2.5">Date</th>
            <th className="text-left font-semibold px-3 py-2.5">Pairing</th>
            <th className="text-left font-semibold px-3 py-2.5">Leg</th>
            <th className="text-left font-semibold px-3 py-2.5">Route</th>
            <th className="text-center font-semibold px-3 py-2.5">Pax</th>
            <th className="text-right font-semibold px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {open.map(({ pairing, leg }) => {
            const paxCount = Object.values(pairing.crewCounts ?? {}).reduce((s, n) => s + n, 0)
            return (
              <tr
                key={`${pairing._id}::${leg.flightId}`}
                className="border-t border-hz-border hover:bg-hz-border/20 transition-colors"
              >
                <td className="px-4 py-2.5 text-[13px] tabular-nums text-hz-text">{leg.flightDate}</td>
                <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text">{pairing.pairingCode}</td>
                <td className="px-3 py-2.5 text-[13px] font-mono text-hz-text">{leg.flightNumber}</td>
                <td className="px-3 py-2.5 text-[13px] text-hz-text">
                  {leg.depStation} → {leg.arrStation}
                </td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-hz-text">{paxCount}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setActive({ pairing, leg })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" /> Book
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {active && (
        <FlightBookingDrawer
          existing={null}
          leg={{
            pairingId: active.pairing._id,
            legId: active.leg.flightId,
            pairingCode: active.pairing.pairingCode,
            flightDate: active.leg.flightDate,
            depStation: active.leg.depStation,
            arrStation: active.leg.arrStation,
            crewIds: [],
          }}
          onClosed={(changed) => {
            setActive(null)
            if (changed) {
              // The drawer caller refetches; until then, optimistically clear.
              // The shell's refresh will fold the new booking in.
              void refetchBookings(upsertBooking)
            }
          }}
        />
      )}
    </div>
  )
}

async function refetchBookings(upsert: (b: CrewFlightBookingRef) => void) {
  // The shell's poll picks this up too; we just trigger an immediate refetch
  // by importing the api lazily.
  const { api } = await import('@skyhub/api')
  const { periodFrom, periodTo } = useCrewTransportStore.getState()
  try {
    const docs = await api.getCrewFlightBookings({ from: periodFrom, to: periodTo })
    useCrewTransportStore.getState().setFlightBookings(docs)
    void upsert // satisfy lint
  } catch (err) {
    console.warn('[transport] failed to refresh flight bookings', err)
  }
}
