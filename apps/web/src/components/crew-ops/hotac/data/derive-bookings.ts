// Phase 1 derivation: turn pairings + assignments + crew + hotels into HotacBooking rows.
// No persistence — runs in-browser on every Fetch / poll tick.

import type { CrewAssignmentRef, CrewHotelRef, CrewMemberListItemRef, PairingLegRef, PairingRef } from '@skyhub/api'
import type {
  CrewPosition,
  DerivationMode,
  HotacBooking,
  HotacCrewMember,
  HotacFilters,
  HotelLite,
  LayoverConfig,
} from '../types'

interface DeriveInput {
  pairings: PairingRef[]
  crew: CrewMemberListItemRef[]
  assignments: CrewAssignmentRef[]
  positions: Array<{ _id: string; code: string; category?: string }>
  hotelsByIcao: Map<string, CrewHotelRef[]>
  airportByIcao: Map<string, { iataCode?: string | null; icaoCode?: string | null }>
  layoverConfig: LayoverConfig
  filters: HotacFilters
  mode: DerivationMode
}

interface LayoverGap {
  pairing: PairingRef
  inboundLeg: PairingLegRef
  outboundLeg: PairingLegRef | null
  station: string
  arrUtcMs: number
  depUtcMs: number | null
  hours: number
}

const HOURS_MS = 3_600_000

/** Build the booking ID deterministically so polling reuses the same ID
 *  across snapshots — required for inspector continuity. */
function bookingId(pairingId: string, station: string, layoverNightUtcMs: number): string {
  return `${pairingId}::${station}::${layoverNightUtcMs}`
}

/** Operator-local night key — UTC ms of 00:00 UTC on the *date* of arrival.
 *  Good enough for grouping; Phase 2 swaps in operator-local timezone. */
function nightKey(arrUtcIso: string): number {
  const ms = Date.parse(arrUtcIso)
  if (!Number.isFinite(ms)) return 0
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function findLayovers(pairing: PairingRef, cfg: LayoverConfig, pairingHasHotelAtHomeBase: boolean): LayoverGap[] {
  const legs = (pairing.legs ?? []).slice().sort((a, b) => a.legOrder - b.legOrder)
  if (legs.length === 0) return []

  const out: LayoverGap[] = []
  for (let i = 0; i < legs.length; i += 1) {
    const inbound = legs[i]
    if (!inbound) continue
    const arrUtcMs = Date.parse(inbound.staUtcIso)
    if (!Number.isFinite(arrUtcMs)) continue

    // Skip layovers at the home base when configured — UNLESS at least one
    // crew on this pairing has the hotelAtHomeBase override on their profile.
    if (cfg.excludeHomeBase && inbound.arrStation === pairing.baseAirport && !pairingHasHotelAtHomeBase) continue

    const next = legs[i + 1]
    if (next && next.depStation === inbound.arrStation) {
      const depUtcMs = Date.parse(next.stdUtcIso)
      if (!Number.isFinite(depUtcMs)) continue
      const hours = (depUtcMs - arrUtcMs) / HOURS_MS
      if (hours < cfg.layoverMinHours) continue

      // Optional: require span across local midnight. We check UTC midnight
      // as a coarse approximation; Phase 2 uses station UTC offsets.
      if (cfg.minSpanMidnightHours > 0) {
        const spanCrosses = new Date(arrUtcMs).getUTCDate() !== new Date(depUtcMs).getUTCDate()
        if (!spanCrosses) continue
      }

      out.push({
        pairing,
        inboundLeg: inbound,
        outboundLeg: next,
        station: inbound.arrStation,
        arrUtcMs,
        depUtcMs,
        hours,
      })
    } else if (i === legs.length - 1) {
      // Final leg — release at non-base counts as a layover until the next
      // pairing picks up. We don't know the next pairing here so report it
      // with a null depUtcMs and the configured min as the duration floor.
      // Phase 2's `/hotel-bookings/derive` resolves this server-side.
      // Phase 1 emits it as a layover when arrStation != base so HOTAC sees
      // crew that need a hotel before deadhead/return.
      out.push({
        pairing,
        inboundLeg: inbound,
        outboundLeg: null,
        station: inbound.arrStation,
        arrUtcMs,
        depUtcMs: null,
        hours: cfg.layoverMinHours,
      })
    }
  }
  return out
}

function selectHotel(station: string, hotelsByIcao: Map<string, CrewHotelRef[]>): HotelLite | null {
  const list = hotelsByIcao.get(station)
  if (!list || list.length === 0) return null
  // Already sorted by priority asc in use-hotac-hotels
  const top = list[0]
  if (!top) return null

  const now = Date.now()
  const activeContract = top.contracts?.find((c) => {
    const start = c.startDateUtcMs
    const end = c.endDateUtcMs
    if (start == null || end == null) return false
    return start <= now && end >= now
  })
  const rate = activeContract?.roomRate ?? activeContract?.contractRate ?? 0
  const currency = activeContract?.currency ?? 'USD'

  const amenities: string[] = []
  if (top.shuttleAlwaysAvailable) amenities.push('Shuttle')
  if (top.isAllInclusive) amenities.push('All-incl')
  if (amenities.length === 0) amenities.push('Wifi')

  return {
    id: top._id,
    name: top.hotelName,
    icao: top.airportIcao,
    iata: top.airportIcao, // fallback if airport lookup missing — overridden below
    priority: top.priority ?? 1,
    distance: top.distanceFromAirportMinutes ?? 0,
    rate,
    currency,
    amenities,
  }
}

function positionCodeById(id: string, positions: Array<{ _id: string; code: string }>): string {
  const found = positions.find((p) => p._id === id)
  return found?.code ?? id
}

function crewLineForLeg(
  pairingId: string,
  inboundLegStart: string,
  outboundLegEnd: string | null,
  assignmentsByPairing: Map<string, CrewAssignmentRef[]>,
  crewById: Map<string, CrewMemberListItemRef>,
  positions: Array<{ _id: string; code: string }>,
): HotacCrewMember[] {
  const all = assignmentsByPairing.get(pairingId) ?? []
  const start = Date.parse(inboundLegStart)
  const end = outboundLegEnd ? Date.parse(outboundLegEnd) : Number.POSITIVE_INFINITY
  const overlapping = all.filter((a) => {
    const aStart = Date.parse(a.startUtcIso)
    const aEnd = Date.parse(a.endUtcIso)
    return aEnd >= start && aStart <= end
  })

  return overlapping
    .map((a) => {
      const c = crewById.get(a.crewId)
      if (!c) return null
      return {
        id: c._id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        position: positionCodeById(a.seatPositionId, positions) as CrewPosition,
        base: c.baseLabel,
      } satisfies HotacCrewMember
    })
    .filter((c): c is HotacCrewMember => c !== null)
}

function applyFilters(
  bookings: HotacBooking[],
  filters: HotacFilters,
  crewBaseById: Map<string, string | null>,
): HotacBooking[] {
  return bookings.filter((b) => {
    if (filters.stationIcaos && filters.stationIcaos.length > 0) {
      if (!filters.stationIcaos.includes(b.airportIcao)) return false
    }
    if (filters.positions && filters.positions.length > 0) {
      const hasMatch = Object.keys(b.crewByPosition).some((p) => filters.positions!.includes(p))
      if (!hasMatch) return false
    }
    if (filters.baseAirports && filters.baseAirports.length > 0) {
      // Match against the crew home base when full crew is loaded; fall back to
      // the pairing's base when we only have counts.
      if (b.crew.length > 0) {
        const hasMatch = b.crew.some((c) => c.base && filters.baseAirports!.includes(c.base))
        if (!hasMatch) return false
      } else {
        // Best-effort: pairing baseId comes from Pairing.baseAirport — the row
        // was tagged with that during derivation.
        // For the count-only mode, fall through (no crew bases known).
        return true
      }
    }
    return true
  })
}

export function deriveBookings(input: DeriveInput): HotacBooking[] {
  const { pairings, assignments, crew, positions, hotelsByIcao, airportByIcao, layoverConfig, filters, mode } = input

  // Index assignments by pairingId
  const assignmentsByPairing = new Map<string, CrewAssignmentRef[]>()
  for (const a of assignments) {
    const arr = assignmentsByPairing.get(a.pairingId)
    if (arr) arr.push(a)
    else assignmentsByPairing.set(a.pairingId, [a])
  }

  // Index crew by id
  const crewById = new Map<string, CrewMemberListItemRef>()
  for (const c of crew) crewById.set(c._id, c)

  const crewBaseById = new Map<string, string | null>()
  for (const c of crew) crewBaseById.set(c._id, c.baseLabel)

  // For the planning mode we still need per-position counts. Build them
  // from `pairing.crewCounts` when present, falling back to assignments.
  const out: HotacBooking[] = []
  for (const pairing of pairings) {
    // Per-crew hotelAtHomeBase override: if ANY crew on the pairing has it
    // set, home-base layovers are emitted (otherwise excluded by config).
    const pairingAssignments = assignmentsByPairing.get(pairing._id) ?? []
    const pairingHasHotelAtHomeBase = pairingAssignments.some((a) => crewById.get(a.crewId)?.hotelAtHomeBase === true)
    const layovers = findLayovers(pairing, layoverConfig, pairingHasHotelAtHomeBase)
    if (layovers.length === 0) continue

    for (const layover of layovers) {
      const station = layover.station
      const airport = airportByIcao.get(station)
      const iata = airport?.iataCode ?? station

      let crewByPosition: Record<string, number>
      let crewList: HotacCrewMember[] = []

      if (mode === 'planning') {
        // Use pairing-level counts — fast, names not needed.
        crewByPosition = pairing.crewCounts ?? {}
        // If pairing didn't seed counts, fall back to live assignment counts.
        if (Object.keys(crewByPosition).length === 0) {
          crewByPosition = countAssignmentsByPosition(pairing._id, assignmentsByPairing, positions)
        }
      } else {
        // Day-to-Day: full crew names
        crewList = crewLineForLeg(
          pairing._id,
          layover.inboundLeg.staUtcIso,
          layover.outboundLeg?.stdUtcIso ?? null,
          assignmentsByPairing,
          crewById,
          positions,
        )
        crewByPosition = {}
        for (const c of crewList) {
          crewByPosition[c.position] = (crewByPosition[c.position] ?? 0) + 1
        }
      }

      const pax = Object.values(crewByPosition).reduce((s, n) => s + n, 0)
      const hotel = selectHotel(station, hotelsByIcao)
      if (hotel && airport?.iataCode) {
        hotel.iata = airport.iataCode
      }

      const layoverNightUtcMs = nightKey(layover.inboundLeg.staUtcIso)

      const rooms = pax // single occupancy default — Phase 4 config tunes this
      const cost = hotel ? hotel.rate * rooms : 0

      const booking: HotacBooking = {
        id: bookingId(pairing._id, station, layoverNightUtcMs),
        pairingId: pairing._id,
        pairingCode: pairing.pairingCode,
        airportIcao: station,
        airportIata: iata,
        layoverNightUtcMs,
        arrFlight: layover.inboundLeg.flightNumber,
        arrStaUtcIso: layover.inboundLeg.staUtcIso,
        depFlight: layover.outboundLeg?.flightNumber ?? null,
        depStdUtcIso: layover.outboundLeg?.stdUtcIso ?? null,
        layoverHours: Math.round(layover.hours * 10) / 10,
        status: 'demand',
        hotel,
        rooms,
        occupancy: 'single',
        pax,
        crewByPosition,
        crew: crewList,
        cost,
        costCurrency: hotel?.currency ?? 'USD',
        shuttle: hotel ? (hotel.amenities.includes('Shuttle') ? 'Y' : 'N') : null,
        confirmationNumber: null,
        notes: null,
        disruptionFlags: [],
      }
      out.push(booking)
    }
  }

  return applyFilters(out, filters, crewBaseById)
}

function countAssignmentsByPosition(
  pairingId: string,
  assignmentsByPairing: Map<string, CrewAssignmentRef[]>,
  positions: Array<{ _id: string; code: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  const all = assignmentsByPairing.get(pairingId) ?? []
  for (const a of all) {
    const code = positionCodeById(a.seatPositionId, positions)
    counts[code] = (counts[code] ?? 0) + 1
  }
  return counts
}

/**
 * Enlist — recompute room counts using the room-allocation policy. Phase 1
 * is single-occupancy across the board; Phase 4 reads doubleOccupancyPositions
 * from OperatorHotacConfig and halves the rooms for those.
 */
export function enlistBookings(bookings: HotacBooking[]): HotacBooking[] {
  return bookings.map((b) => ({ ...b, status: 'forecast' as const }))
}
