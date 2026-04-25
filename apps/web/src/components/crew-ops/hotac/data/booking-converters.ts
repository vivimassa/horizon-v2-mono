// Bridge between client-side HotacBooking (UI shape) and server-side
// HotelBookingRef (persistence shape).
//
// The deterministic key `(pairingId, airportIcao, layoverNightUtcMs)` lets us
// match a client-derived row against a server row even before the server
// assigns its UUID `_id`.

import type { AirportRef, HotelBookingDerivedRow, HotelBookingRef } from '@skyhub/api'
import type { HotacBooking, HotacCrewMember, HotelLite } from '../types'

export function deterministicKey(pairingId: string, airportIcao: string, nightUtcMs: number): string {
  return `${pairingId}::${airportIcao}::${nightUtcMs}`
}

export function toDerivedRow(b: HotacBooking): HotelBookingDerivedRow {
  return {
    pairingId: b.pairingId,
    pairingCode: b.pairingCode,
    airportIcao: b.airportIcao,
    layoverNightUtcMs: b.layoverNightUtcMs,
    arrFlight: b.arrFlight,
    arrStaUtcIso: b.arrStaUtcIso,
    depFlight: b.depFlight,
    depStdUtcIso: b.depStdUtcIso,
    layoverHours: b.layoverHours,
    hotelId: b.hotel?.id ?? null,
    hotelName: b.hotel?.name ?? '',
    hotelPriority: b.hotel?.priority ?? null,
    hotelDistance: b.hotel?.distance ?? null,
    rooms: b.rooms,
    occupancy: b.occupancy,
    pax: b.pax,
    crewByPosition: b.crewByPosition,
    crewIds: b.crew.map((c) => c.id),
    costMinor: b.cost,
    costCurrency: b.costCurrency,
    shuttle: b.shuttle,
  }
}

interface HotelLiteIndex {
  airportByIcao: Map<string, AirportRef>
  /** Most recent local derivation by deterministic key — preserves crew names
   *  and the full HotelLite object across server round-trips. */
  localByKey: Map<string, HotacBooking>
}

export function fromServerRow(row: HotelBookingRef, idx: HotelLiteIndex): HotacBooking {
  const detKey = deterministicKey(row.pairingId, row.airportIcao, row.layoverNightUtcMs)
  const local = idx.localByKey.get(detKey)
  const airport = idx.airportByIcao.get(row.airportIcao)
  const iata = airport?.iataCode ?? row.airportIcao

  // Prefer the local HotelLite (rate/currency/amenities) when available,
  // fall back to the minimal subset the server stores.
  const hotel: HotelLite | null = local?.hotel
    ? local.hotel
    : row.hotelId
      ? {
          id: row.hotelId,
          name: row.hotelName,
          icao: row.airportIcao,
          iata,
          priority: row.hotelPriority ?? 1,
          distance: row.hotelDistance ?? 0,
          rate: 0,
          currency: row.costCurrency,
          amenities: [],
        }
      : null

  return {
    id: row._id,
    pairingId: row.pairingId,
    pairingCode: row.pairingCode,
    airportIcao: row.airportIcao,
    airportIata: iata,
    layoverNightUtcMs: row.layoverNightUtcMs,
    arrFlight: row.arrFlight,
    arrStaUtcIso: row.arrStaUtcIso,
    depFlight: row.depFlight,
    depStdUtcIso: row.depStdUtcIso,
    layoverHours: row.layoverHours,
    status: row.status,
    hotel,
    rooms: row.rooms,
    occupancy: row.occupancy,
    pax: row.pax,
    crewByPosition: row.crewByPosition,
    crew: local?.crew ?? [],
    cost: row.costMinor,
    costCurrency: row.costCurrency,
    shuttle: row.shuttle,
    confirmationNumber: row.confirmationNumber,
    notes: row.notes,
    disruptionFlags: row.disruptionFlags,
  }
}

export function indexBookingsByDetKey(bookings: HotacBooking[]): Map<string, HotacBooking> {
  const m = new Map<string, HotacBooking>()
  for (const b of bookings) {
    m.set(deterministicKey(b.pairingId, b.airportIcao, b.layoverNightUtcMs), b)
  }
  return m
}

/** Build the cache used by Day-to-Day mode: pairingId+station+night → crew[].
 *  Always backed by the most recently derived snapshot. */
export function indexCrewByDetKey(bookings: HotacBooking[]): Map<string, HotacCrewMember[]> {
  const m = new Map<string, HotacCrewMember[]>()
  for (const b of bookings) {
    if (b.crew.length > 0) {
      m.set(deterministicKey(b.pairingId, b.airportIcao, b.layoverNightUtcMs), b.crew)
    }
  }
  return m
}
