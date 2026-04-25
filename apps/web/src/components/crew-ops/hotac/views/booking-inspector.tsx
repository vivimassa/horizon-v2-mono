'use client'

import { useState } from 'react'
import { X, BedDouble, Plane, Hotel, MapPin, AlertCircle, LogIn, LogOut, UserX, Send } from 'lucide-react'
import { api } from '@skyhub/api'
import { useHotacStore } from '@/stores/use-hotac-store'
import { StatusChip, fmtMoney } from '../status-meta'
import { fromServerRow } from '../data/booking-converters'
import type { HotacBooking } from '../types'
import { useHotacHotels } from '../use-hotac-hotels'

type Tab = 'overview' | 'crew' | 'cost'

export function BookingInspector() {
  const selectedId = useHotacStore((s) => s.selectedBookingId)
  const setSelectedId = useHotacStore((s) => s.setSelectedBookingId)
  const booking = useHotacStore((s) => s.bookings.find((b) => b.id === selectedId) ?? null)
  const setBookings = useHotacStore((s) => s.setBookings)
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState<null | 'check-in' | 'check-out' | 'no-show' | 'send' | 'delete'>(null)
  const { airportByIcao } = useHotacHotels()

  if (!booking) return null

  const refreshOne = async () => {
    // After a server mutation, we get back the canonical row. Replace the
    // matching booking in the store; preserve crew names + hotel object via
    // the existing local snapshot.
    const cur = useHotacStore.getState().bookings
    const idx = cur.findIndex((b) => b.id === booking.id)
    return { cur, idx }
  }

  const applyPatched = (patchedFromServer: HotacBooking) => {
    const { cur, idx } = {
      cur: useHotacStore.getState().bookings,
      idx: useHotacStore.getState().bookings.findIndex((b) => b.id === booking.id),
    }
    if (idx < 0) return
    const next = [...cur]
    next[idx] = patchedFromServer
    setBookings(next, [])
  }

  const handleCheckIn = async () => {
    setBusy('check-in')
    try {
      const updated = await api.checkInHotelBooking(booking.id, { by: 'hotac' })
      const local = new Map([[`${updated.pairingId}::${updated.airportIcao}::${updated.layoverNightUtcMs}`, booking]])
      applyPatched(fromServerRow(updated, { airportByIcao, localByKey: local }))
    } catch (err) {
      console.warn('[hotac] check-in failed', err)
    } finally {
      setBusy(null)
    }
  }

  const handleCheckOut = async () => {
    setBusy('check-out')
    try {
      const updated = await api.checkOutHotelBooking(booking.id)
      const local = new Map([[`${updated.pairingId}::${updated.airportIcao}::${updated.layoverNightUtcMs}`, booking]])
      applyPatched(fromServerRow(updated, { airportByIcao, localByKey: local }))
    } catch (err) {
      console.warn('[hotac] check-out failed', err)
    } finally {
      setBusy(null)
    }
  }

  const handleNoShow = async () => {
    setBusy('no-show')
    try {
      const updated = await api.noShowHotelBooking(booking.id)
      const local = new Map([[`${updated.pairingId}::${updated.airportIcao}::${updated.layoverNightUtcMs}`, booking]])
      applyPatched(fromServerRow(updated, { airportByIcao, localByKey: local }))
    } catch (err) {
      console.warn('[hotac] no-show failed', err)
    } finally {
      setBusy(null)
    }
  }

  const handleMarkSent = async () => {
    setBusy('send')
    try {
      const updated = await api.patchHotelBooking(booking.id, { status: 'sent' })
      const local = new Map([[`${updated.pairingId}::${updated.airportIcao}::${updated.layoverNightUtcMs}`, booking]])
      applyPatched(fromServerRow(updated, { airportByIcao, localByKey: local }))
    } catch (err) {
      console.warn('[hotac] mark sent failed', err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <aside className="w-[360px] shrink-0 flex flex-col border-l border-hz-border bg-hz-card overflow-hidden">
      <div className="px-4 py-3 border-b border-hz-border flex items-start gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-module-accent/12 flex items-center justify-center shrink-0">
          <BedDouble className="h-[18px] w-[18px] text-module-accent" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold tracking-tight truncate text-hz-text">
            {booking.hotel?.name ?? booking.airportIata}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] font-mono text-hz-text-secondary">{booking.pairingCode}</span>
            <StatusChip status={booking.status} size="sm" />
          </div>
        </div>
        <button
          type="button"
          aria-label="Close inspector"
          onClick={() => setSelectedId(null)}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-hz-border/30 transition-colors text-hz-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pt-2 border-b border-hz-border">
        <div className="flex items-center gap-1">
          {(['overview', 'crew', 'cost'] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[13px] font-semibold rounded-lg capitalize transition-colors ${
                tab === t ? 'bg-module-accent/12 text-module-accent' : 'text-hz-text-secondary hover:bg-hz-border/30'
              }`}
            >
              {t === 'crew' ? `Crew (${booking.crew.length || booking.pax})` : t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'overview' && <OverviewTab booking={booking} />}
        {tab === 'crew' && <CrewTab booking={booking} />}
        {tab === 'cost' && <CostTab booking={booking} />}
      </div>

      <div className="px-3 py-3 border-t border-hz-border bg-hz-border/15 flex items-center gap-2 flex-wrap">
        {(booking.status === 'forecast' || booking.status === 'pending') && (
          <button
            type="button"
            onClick={handleMarkSent}
            disabled={busy !== null}
            className="flex-1 min-w-[120px] h-9 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" /> Mark sent
          </button>
        )}
        {booking.status === 'sent' && (
          <button
            type="button"
            onClick={() =>
              api
                .patchHotelBooking(booking.id, { status: 'confirmed' })
                .then((r) =>
                  applyPatched(
                    fromServerRow(r, {
                      airportByIcao,
                      localByKey: new Map([[`${r.pairingId}::${r.airportIcao}::${r.layoverNightUtcMs}`, booking]]),
                    }),
                  ),
                )
                .catch((e) => console.warn('[hotac] confirm failed', e))
            }
            disabled={busy !== null}
            className="flex-1 min-w-[120px] h-9 rounded-lg text-[13px] font-semibold bg-[#06C270] text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
          >
            Mark confirmed
          </button>
        )}
        {booking.status === 'confirmed' && (
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={busy !== null}
            className="flex-1 min-w-[120px] h-9 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
          >
            <LogIn className="h-3.5 w-3.5" /> Check in
          </button>
        )}
        {booking.status === 'in-house' && (
          <button
            type="button"
            onClick={handleCheckOut}
            disabled={busy !== null}
            className="flex-1 min-w-[120px] h-9 rounded-lg text-[13px] font-semibold bg-module-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" /> Check out
          </button>
        )}
        {(booking.status === 'sent' || booking.status === 'confirmed') && (
          <button
            type="button"
            onClick={handleNoShow}
            disabled={busy !== null}
            className="h-9 px-3 rounded-lg text-[13px] font-semibold border border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/10 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            title="Mark crew as no-show"
          >
            <UserX className="h-3.5 w-3.5" /> No-show
          </button>
        )}
      </div>
    </aside>
  )
}

function OverviewTab({ booking }: { booking: HotacBooking }) {
  return (
    <>
      {booking.disruptionFlags.length > 0 && (
        <div className="p-3 rounded-xl bg-[#FF8800]/10 border border-[#FF8800]/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-[#FF8800] shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-wider text-[#FF8800]">Disruption flags</div>
              <ul className="text-[13px] text-hz-text mt-1 leading-snug list-disc list-inside">
                {booking.disruptionFlags.map((f) => (
                  <li key={f}>{f.replace(/-/g, ' ')}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">Layover</div>
        <div className="rounded-xl bg-hz-border/15 border border-hz-border p-3 space-y-2.5">
          <Row
            icon={Plane}
            label="Inbound"
            value={`${booking.arrFlight ?? '—'} · ${booking.arrStaUtcIso ?? ''}`}
            tone="info"
          />
          <div className="border-t border-dashed border-hz-border" />
          <Row
            icon={BedDouble}
            label="Stay"
            value={`${booking.layoverHours.toFixed(1)}h · ${booking.airportIata}`}
            tone="accent"
          />
          <div className="border-t border-dashed border-hz-border" />
          <Row
            icon={Plane}
            label="Outbound"
            value={`${booking.depFlight ?? '—'} · ${booking.depStdUtcIso ?? ''}`}
            tone="success"
          />
        </div>
      </div>

      {booking.hotel && (
        <div>
          <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">Hotel</div>
          <div className="rounded-xl bg-hz-border/15 border border-hz-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Hotel className="h-3.5 w-3.5 text-module-accent" />
              <span className="text-[13px] font-semibold text-hz-text">{booking.hotel.name}</span>
              <span className="ml-auto text-[13px] font-bold px-1.5 py-0.5 rounded bg-module-accent/15 text-module-accent">
                P{booking.hotel.priority}
              </span>
            </div>
            <div className="text-[13px] text-hz-text-secondary flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {booking.hotel.distance} min from terminal · {booking.airportIcao}
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {booking.hotel.amenities.map((a) => (
                <span key={a} className="text-[13px] font-medium px-1.5 py-0.5 rounded bg-hz-border/40 text-hz-text">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {booking.notes && (
        <div>
          <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">Notes</div>
          <div className="text-[13px] text-hz-text leading-snug bg-[#FF8800]/8 border border-[#FF8800]/25 rounded-xl p-3">
            {booking.notes}
          </div>
        </div>
      )}
    </>
  )
}

function CrewTab({ booking }: { booking: HotacBooking }) {
  if (booking.crew.length === 0) {
    return (
      <div>
        <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">
          By position
        </div>
        <div className="rounded-xl bg-hz-border/15 border border-hz-border p-3">
          <div className="text-[13px] text-hz-text leading-relaxed">
            {Object.entries(booking.crewByPosition)
              .map(([k, n]) => `${n}× ${k}`)
              .join(' · ') || '—'}
          </div>
          <div className="text-[13px] text-hz-text-secondary mt-2">
            Switch to <span className="font-semibold">Day to Day</span> tab to load full crew names.
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {booking.crew.map((c) => (
        <div key={c.id} className="rounded-xl bg-hz-border/15 border border-hz-border p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-module-accent text-white flex items-center justify-center text-[13px] font-bold shrink-0">
            {c.name
              .split(' ')
              .slice(0, 2)
              .map((s) => s[0])
              .join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate text-hz-text">{c.name}</div>
            <div className="text-[13px] text-hz-text-secondary mt-0.5">
              {c.position}
              {c.base && ` · Base ${c.base}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CostTab({ booking }: { booking: HotacBooking }) {
  if (!booking.hotel) {
    return <div className="text-[13px] text-hz-text-secondary">No hotel matched yet — cost estimate unavailable.</div>
  }
  const subtotal = booking.cost
  const tax = Math.round(subtotal * 0.1)
  const total = subtotal + tax
  return (
    <div>
      <div className="text-[13px] uppercase tracking-wider font-semibold text-hz-text-secondary mb-2">
        Cost breakdown
      </div>
      <div className="rounded-xl bg-hz-border/15 border border-hz-border p-3 space-y-2 text-[13px]">
        <div className="flex justify-between">
          <span className="text-hz-text">
            {booking.rooms} rooms × 1 night × {booking.hotel.rate} {booking.hotel.currency}
          </span>
          <span className="font-medium tabular-nums text-hz-text">{fmtMoney(subtotal, booking.costCurrency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-hz-text">Tax & service (10%)</span>
          <span className="font-medium tabular-nums text-hz-text">{fmtMoney(tax, booking.costCurrency)}</span>
        </div>
        <div className="border-t border-hz-border pt-2 flex justify-between">
          <span className="font-bold text-hz-text">Total</span>
          <span className="font-bold tabular-nums text-module-accent">{fmtMoney(total, booking.costCurrency)}</span>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Plane
  label: string
  value: string
  tone: 'info' | 'accent' | 'success'
}) {
  const cls =
    tone === 'info'
      ? 'bg-[#0063F7]/15 text-[#0063F7]'
      : tone === 'success'
        ? 'bg-[#06C270]/15 text-[#06C270]'
        : 'bg-module-accent/15 text-module-accent'
  return (
    <div className="flex items-center gap-3">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 leading-tight">
        <div className="text-[13px] text-hz-text-secondary">{label}</div>
        <div className="text-[13px] font-semibold tabular-nums text-hz-text">{value}</div>
      </div>
    </div>
  )
}
