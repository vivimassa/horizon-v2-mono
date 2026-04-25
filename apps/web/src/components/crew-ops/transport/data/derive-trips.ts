// Phase C derivation: turn pairings + assignments + crew profiles into
// CrewTransportTrip rows. Pure function — runs in-browser on every Fetch /
// poll tick and gets persisted by upsertCrewTransportTripsBatch.
//
// Mirrors HOTAC's derive-bookings.ts pattern but the unit of work is a trip
// (one direction, one pickup window) rather than a hotel-night.

import type {
  CrewAssignmentRef,
  CrewHotelRef,
  CrewMemberListItemRef,
  CrewTransportPaxStop,
  CrewTransportTripType,
  CrewTransportVendorRef,
  HotelBookingRef,
  PairingLegRef,
  PairingRef,
} from '@skyhub/api'
import type { CrewTransportFilters } from '@/stores/use-crew-transport-filter-store'
import type { DerivationMode, TransportConfig, TransportTrip, TripVendorLite } from '../types'

interface DeriveInput {
  pairings: PairingRef[]
  crew: CrewMemberListItemRef[]
  assignments: CrewAssignmentRef[]
  vendorsByIcao: Map<string, CrewTransportVendorRef[]>
  config: TransportConfig
  filters: CrewTransportFilters
  mode: DerivationMode
}

interface PairingEdge {
  pairing: PairingRef
  firstLeg: PairingLegRef
  lastLeg: PairingLegRef
  reportUtcMs: number
  releaseUtcMs: number
  baseAirport: string
}

function getEdges(pairing: PairingRef): PairingEdge | null {
  const legs = (pairing.legs ?? []).slice().sort((a, b) => a.legOrder - b.legOrder)
  const first = legs[0]
  const last = legs[legs.length - 1]
  if (!first || !last) return null
  const report = Date.parse(first.stdUtcIso)
  const release = Date.parse(last.staUtcIso)
  if (!Number.isFinite(report) || !Number.isFinite(release)) return null
  return {
    pairing,
    firstLeg: first,
    lastLeg: last,
    reportUtcMs: report,
    releaseUtcMs: release,
    baseAirport: pairing.baseAirport,
  }
}

interface CrewLite {
  id: string
  fullName: string
  position: string
  base: string | null
  homeAddress: string | null
  travelTimeMinutes: number
  transportRequired: boolean
}

function crewLite(c: CrewMemberListItemRef, fallbackTravelTime: number): CrewLite {
  const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.shortCode || c._id
  const homeAddressParts = [c.addressLine1, c.addressLine2, c.addressCity, c.addressCountry].filter(Boolean)
  return {
    id: c._id,
    fullName,
    position: c.position ?? '',
    base: c.base ?? c.baseLabel ?? null,
    homeAddress: homeAddressParts.length > 0 ? homeAddressParts.join(', ') : null,
    travelTimeMinutes: c.travelTimeMinutes ?? fallbackTravelTime,
    transportRequired: c.transportRequired === true,
  }
}

function selectVendor(
  vendorsByIcao: Map<string, CrewTransportVendorRef[]>,
  icao: string,
  paxCount: number,
  scheduledTimeUtcMs: number,
): TripVendorLite | null {
  const list = vendorsByIcao.get(icao) ?? []
  // Sort by priority asc then by name for stability.
  const candidates = list
    .filter((v) => v.isActive)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.vendorName.localeCompare(b.vendorName))

  for (const v of candidates) {
    const contract =
      v.contracts.find((c) => {
        if (c.startDateUtcMs == null || c.endDateUtcMs == null) return v.contracts.length === 1 // implicit always-on
        return c.startDateUtcMs <= scheduledTimeUtcMs && c.endDateUtcMs >= scheduledTimeUtcMs
      }) ?? v.contracts[0]
    if (!contract) continue

    // Pick the smallest tier that fits paxCount; fall back to largest available.
    const tiersAsc = contract.vehicleTiers.slice().sort((a, b) => a.paxCapacity - b.paxCapacity)
    const tier = tiersAsc.find((t) => t.paxCapacity >= paxCount) ?? tiersAsc[tiersAsc.length - 1] ?? null

    return {
      id: v._id,
      name: v.vendorName,
      contractId: contract._id,
      vehicleTierId: tier?._id ?? null,
      vehicleTierName: tier?.tierName ?? null,
      paxCapacity: tier?.paxCapacity ?? null,
      ratePerTrip: tier?.ratePerTrip ?? 0,
      currency: contract.currency,
      priority: v.priority,
    }
  }
  return null
}

function applyFilters(trips: TransportTrip[], filters: CrewTransportFilters): TransportTrip[] {
  return trips.filter((t) => {
    if (filters.stationIcaos && filters.stationIcaos.length > 0) {
      if (!filters.stationIcaos.includes(t.airportIcao)) return false
    }
    if (filters.transportType && filters.transportType !== 'all' && filters.transportType !== 'ground') {
      // Phase C only emits ground; flight comes in Phase D.
      return false
    }
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      if (!t.vendor || !filters.vendorIds.includes(t.vendor.id)) return false
    }
    return true
  })
}

export function deriveTrips(input: DeriveInput): TransportTrip[] {
  const { pairings, assignments, crew, vendorsByIcao, config, filters, mode } = input

  // Index assignments by pairingId
  const assignmentsByPairing = new Map<string, CrewAssignmentRef[]>()
  for (const a of assignments) {
    const arr = assignmentsByPairing.get(a.pairingId)
    if (arr) arr.push(a)
    else assignmentsByPairing.set(a.pairingId, [a])
  }

  // Index crew by id (lite shape with derived addresses + travel time defaults)
  const crewById = new Map<string, CrewLite>()
  for (const c of crew) crewById.set(c._id, crewLite(c, config.defaultTravelTimeMinutes))

  // Group eligible crew per pairing by its base airport
  const out: TransportTrip[] = []

  for (const pairing of pairings) {
    const edge = getEdges(pairing)
    if (!edge) continue

    const pairingCrew = (assignmentsByPairing.get(pairing._id) ?? [])
      .map((a) => crewById.get(a.crewId))
      .filter((c): c is CrewLite => c != null && c.transportRequired)
      // Only crew based at this pairing's base get a Home/Hub trip in Phase C.
      .filter((c) => c.base === edge.baseAirport)

    if (pairingCrew.length === 0) continue

    if (config.pickupMode === 'hub-shuttle') {
      out.push(buildHubTrip(edge, pairingCrew, vendorsByIcao, config, 'depart', mode))
      out.push(buildHubTrip(edge, pairingCrew, vendorsByIcao, config, 'return', mode))
    } else {
      // door-to-door: one trip per crew, batched within window
      const departTrips = buildDoorToDoorTrips(edge, pairingCrew, vendorsByIcao, config, 'depart')
      const returnTrips = buildDoorToDoorTrips(edge, pairingCrew, vendorsByIcao, config, 'return')
      out.push(...departTrips, ...returnTrips)
    }
  }

  return applyFilters(out, filters)
}

function buildHubTrip(
  edge: PairingEdge,
  crew: CrewLite[],
  vendorsByIcao: Map<string, CrewTransportVendorRef[]>,
  config: TransportConfig,
  direction: 'depart' | 'return',
  _mode: DerivationMode,
): TransportTrip {
  const isDepart = direction === 'depart'
  const tripType: CrewTransportTripType = isDepart ? 'hub-airport' : 'airport-hub'

  // Hub→airport: leave hub far enough ahead that the slowest crew can still
  // make it from home to hub. We use the longest crew travel-time as the
  // gating signal, plus the configured buffer.
  const longestTravel = crew.reduce((m, c) => Math.max(m, c.travelTimeMinutes), 0)
  const bufferMs = config.bufferMinutes * 60_000

  const scheduledTimeUtcMs = isDepart
    ? edge.reportUtcMs - bufferMs - longestTravel * 60_000
    : edge.releaseUtcMs + bufferMs

  const paxStops: CrewTransportPaxStop[] = crew.map((c) => ({
    crewId: c.id,
    crewName: c.fullName,
    position: c.position,
    pickupAddress: config.hubLocation?.addressLine ?? null,
    pickupTimeUtcMs: scheduledTimeUtcMs,
    pickedUpAtUtcMs: null,
    dropoffAtUtcMs: null,
  }))

  const vendor = selectVendor(vendorsByIcao, edge.baseAirport, crew.length, scheduledTimeUtcMs)
  const cost = vendor?.ratePerTrip ?? 0
  const currency = vendor?.currency ?? 'USD'

  const hubLabel = config.hubLocation?.name ?? 'Crew Hub'
  const airportLabel = edge.baseAirport

  return {
    id: `${edge.pairing._id}::${tripType}::${scheduledTimeUtcMs}`,
    pairingId: edge.pairing._id,
    pairingCode: edge.pairing.pairingCode,
    tripType,
    scheduledTimeUtcMs,
    legFlightNumber: isDepart ? edge.firstLeg.flightNumber : edge.lastLeg.flightNumber,
    legStdUtcIso: isDepart ? edge.firstLeg.stdUtcIso : null,
    legStaUtcIso: isDepart ? null : edge.lastLeg.staUtcIso,
    airportIcao: edge.baseAirport,
    fromLocationType: isDepart ? 'hub' : 'airport',
    fromAddress: isDepart ? (config.hubLocation?.addressLine ?? null) : null,
    fromLabel: isDepart ? hubLabel : airportLabel,
    toLocationType: isDepart ? 'airport' : 'hub',
    toAddress: isDepart ? null : (config.hubLocation?.addressLine ?? null),
    toLabel: isDepart ? airportLabel : hubLabel,
    paxStops,
    paxCount: paxStops.length,
    vendor,
    vendorMethod: 'vendor',
    vehiclePlate: null,
    driverName: null,
    driverPhone: null,
    cost,
    costCurrency: currency,
    status: 'demand',
    confirmationNumber: null,
    notes: null,
    disruptionFlags: [],
    sentAtUtcMs: null,
    confirmedAtUtcMs: null,
    dispatchedAtUtcMs: null,
    pickedUpAtUtcMs: null,
    completedAtUtcMs: null,
  }
}

function buildDoorToDoorTrips(
  edge: PairingEdge,
  crew: CrewLite[],
  vendorsByIcao: Map<string, CrewTransportVendorRef[]>,
  config: TransportConfig,
  direction: 'depart' | 'return',
): TransportTrip[] {
  const isDepart = direction === 'depart'
  const tripType: CrewTransportTripType = isDepart ? 'home-airport' : 'airport-home'
  const bufferMs = config.bufferMinutes * 60_000
  const windowMs = config.batchingWindowMinutes * 60_000

  // Compute each crew's pickup time first.
  const perCrew = crew.map((c) => {
    const pickup = isDepart ? edge.reportUtcMs - bufferMs - c.travelTimeMinutes * 60_000 : edge.releaseUtcMs + bufferMs
    return { crew: c, pickup }
  })

  // Sort by pickup time so we can batch sequentially.
  perCrew.sort((a, b) => a.pickup - b.pickup)

  // Group within the batching window.
  const groups: Array<{ pickup: number; members: typeof perCrew }> = []
  for (const entry of perCrew) {
    const last = groups[groups.length - 1]
    if (last && entry.pickup - last.pickup <= windowMs) {
      last.members.push(entry)
    } else {
      groups.push({ pickup: entry.pickup, members: [entry] })
    }
  }

  return groups.map((g) => {
    const paxStops: CrewTransportPaxStop[] = g.members.map((m) => ({
      crewId: m.crew.id,
      crewName: m.crew.fullName,
      position: m.crew.position,
      pickupAddress: m.crew.homeAddress,
      pickupTimeUtcMs: m.pickup,
      pickedUpAtUtcMs: null,
      dropoffAtUtcMs: null,
    }))
    const vendor = selectVendor(vendorsByIcao, edge.baseAirport, paxStops.length, g.pickup)
    const cost = vendor?.ratePerTrip ?? 0
    const currency = vendor?.currency ?? 'USD'
    const homeLabel = paxStops[0]?.crewName ? `${paxStops[0].crewName}'s home` : 'Crew home'

    return {
      id: `${edge.pairing._id}::${tripType}::${g.pickup}`,
      pairingId: edge.pairing._id,
      pairingCode: edge.pairing.pairingCode,
      tripType,
      scheduledTimeUtcMs: g.pickup,
      legFlightNumber: isDepart ? edge.firstLeg.flightNumber : edge.lastLeg.flightNumber,
      legStdUtcIso: isDepart ? edge.firstLeg.stdUtcIso : null,
      legStaUtcIso: isDepart ? null : edge.lastLeg.staUtcIso,
      airportIcao: edge.baseAirport,
      fromLocationType: isDepart ? 'home' : 'airport',
      fromAddress: isDepart ? (paxStops[0]?.pickupAddress ?? null) : null,
      fromLabel: isDepart ? homeLabel : edge.baseAirport,
      toLocationType: isDepart ? 'airport' : 'home',
      toAddress: isDepart ? null : (paxStops[0]?.pickupAddress ?? null),
      toLabel: isDepart ? edge.baseAirport : homeLabel,
      paxStops,
      paxCount: paxStops.length,
      vendor,
      vendorMethod: 'vendor',
      vehiclePlate: null,
      driverName: null,
      driverPhone: null,
      cost,
      costCurrency: currency,
      status: 'demand',
      confirmationNumber: null,
      notes: null,
      disruptionFlags: [],
      sentAtUtcMs: null,
      confirmedAtUtcMs: null,
      dispatchedAtUtcMs: null,
      pickedUpAtUtcMs: null,
      completedAtUtcMs: null,
    }
  })
}

/** Bucket vendors by every airport they cover (base + serviceAreaIcaos). */
export function indexVendorsByIcao(vendors: CrewTransportVendorRef[]): Map<string, CrewTransportVendorRef[]> {
  const m = new Map<string, CrewTransportVendorRef[]>()
  const push = (icao: string, v: CrewTransportVendorRef) => {
    const arr = m.get(icao)
    if (arr) arr.push(v)
    else m.set(icao, [v])
  }
  for (const v of vendors) {
    push(v.baseAirportIcao, v)
    for (const a of v.serviceAreaIcaos) if (a !== v.baseAirportIcao) push(a, v)
  }
  return m
}

interface DeriveLayoverInput {
  bookings: HotelBookingRef[]
  hotelsById: Map<string, CrewHotelRef>
  crew: CrewMemberListItemRef[]
  vendorsByIcao: Map<string, CrewTransportVendorRef[]>
  config: TransportConfig
  filters: CrewTransportFilters
}

/**
 * Layover transport derivation — emits one inbound (airport→hotel) and one
 * outbound (hotel→airport) trip per HotelBooking when the operator has chosen
 * `layoverTransportProvider = 'vendor'`. Returns an empty array when the
 * provider is `'hotel'` (the hotel runs its own shuttle and 4.1.8.2 stays
 * out of the picture).
 *
 * Times:
 *   - airport→hotel: booking.arrStaUtcIso + bufferMinutes (crew has just landed)
 *   - hotel→airport: booking.depStdUtcIso − bufferMinutes − distanceFromAirportMinutes
 *
 * When `depStdUtcIso` is missing (open-ended layover at end of pairing), the
 * outbound leg is skipped — the next pairing will pick the crew up.
 */
export function deriveLayoverTrips(input: DeriveLayoverInput): TransportTrip[] {
  const { bookings, hotelsById, crew, vendorsByIcao, config, filters } = input

  if (config.layoverTransportProvider === 'hotel') return []

  const crewById = new Map<string, CrewMemberListItemRef>()
  for (const c of crew) crewById.set(c._id, c)

  const out: TransportTrip[] = []
  const bufferMs = config.bufferMinutes * 60_000

  for (const b of bookings) {
    if (b.status === 'cancelled') continue
    const hotel = b.hotelId ? hotelsById.get(b.hotelId) : null
    const distanceMinutes = hotel?.distanceFromAirportMinutes ?? config.defaultTravelTimeMinutes
    const hotelLabel = hotel?.hotelName || b.hotelName || 'Hotel'
    const hotelAddress = hotel ? [hotel.addressLine1, hotel.addressLine2].filter(Boolean).join(', ') || null : null

    // Pax stops — one per crew member assigned to the booking.
    const paxStops: CrewTransportPaxStop[] = b.crewIds.map((cid) => {
      const c = crewById.get(cid)
      const fullName = c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.shortCode || cid : cid
      return {
        crewId: cid,
        crewName: fullName,
        position: c?.position ?? '',
        pickupAddress: null,
        pickupTimeUtcMs: null,
        pickedUpAtUtcMs: null,
        dropoffAtUtcMs: null,
      }
    })

    const inboundStaMs = b.arrStaUtcIso ? Date.parse(b.arrStaUtcIso) : NaN
    if (Number.isFinite(inboundStaMs)) {
      const scheduledIn = inboundStaMs + bufferMs
      const stops: CrewTransportPaxStop[] = paxStops.map((p) => ({ ...p, pickupTimeUtcMs: scheduledIn }))
      const vendorIn = selectVendor(vendorsByIcao, b.airportIcao, stops.length, scheduledIn)
      out.push(
        buildLayoverTrip({
          booking: b,
          tripType: 'airport-hotel',
          scheduledTimeUtcMs: scheduledIn,
          fromLabel: b.airportIcao,
          fromAddress: null,
          toLabel: hotelLabel,
          toAddress: hotelAddress,
          paxStops: stops,
          vendor: vendorIn,
          legFlightNumber: b.arrFlight,
          legStdUtcIso: null,
          legStaUtcIso: b.arrStaUtcIso,
        }),
      )
    }

    const outboundStdMs = b.depStdUtcIso ? Date.parse(b.depStdUtcIso) : NaN
    if (Number.isFinite(outboundStdMs)) {
      const scheduledOut = outboundStdMs - bufferMs - distanceMinutes * 60_000
      const stops: CrewTransportPaxStop[] = paxStops.map((p) => ({
        ...p,
        pickupAddress: hotelAddress,
        pickupTimeUtcMs: scheduledOut,
      }))
      const vendorOut = selectVendor(vendorsByIcao, b.airportIcao, stops.length, scheduledOut)
      out.push(
        buildLayoverTrip({
          booking: b,
          tripType: 'hotel-airport',
          scheduledTimeUtcMs: scheduledOut,
          fromLabel: hotelLabel,
          fromAddress: hotelAddress,
          toLabel: b.airportIcao,
          toAddress: null,
          paxStops: stops,
          vendor: vendorOut,
          legFlightNumber: b.depFlight,
          legStdUtcIso: b.depStdUtcIso,
          legStaUtcIso: null,
        }),
      )
    }
  }

  return applyFilters(out, filters)
}

interface BuildLayoverArgs {
  booking: HotelBookingRef
  tripType: 'airport-hotel' | 'hotel-airport'
  scheduledTimeUtcMs: number
  fromLabel: string
  fromAddress: string | null
  toLabel: string
  toAddress: string | null
  paxStops: CrewTransportPaxStop[]
  vendor: TripVendorLite | null
  legFlightNumber: string | null
  legStdUtcIso: string | null
  legStaUtcIso: string | null
}

function buildLayoverTrip(args: BuildLayoverArgs): TransportTrip {
  const isOutbound = args.tripType === 'hotel-airport'
  const cost = args.vendor?.ratePerTrip ?? 0
  const currency = args.vendor?.currency ?? 'USD'

  return {
    id: `${args.booking.pairingId}::${args.tripType}::${args.scheduledTimeUtcMs}`,
    pairingId: args.booking.pairingId,
    pairingCode: args.booking.pairingCode,
    tripType: args.tripType,
    scheduledTimeUtcMs: args.scheduledTimeUtcMs,
    legFlightNumber: args.legFlightNumber,
    legStdUtcIso: args.legStdUtcIso,
    legStaUtcIso: args.legStaUtcIso,
    airportIcao: args.booking.airportIcao,
    fromLocationType: isOutbound ? 'hotel' : 'airport',
    fromAddress: args.fromAddress,
    fromLabel: args.fromLabel,
    toLocationType: isOutbound ? 'airport' : 'hotel',
    toAddress: args.toAddress,
    toLabel: args.toLabel,
    paxStops: args.paxStops,
    paxCount: args.paxStops.length,
    vendor: args.vendor,
    vendorMethod: 'vendor',
    vehiclePlate: null,
    driverName: null,
    driverPhone: null,
    cost,
    costCurrency: currency,
    status: 'demand',
    confirmationNumber: null,
    notes: null,
    disruptionFlags: [],
    sentAtUtcMs: null,
    confirmedAtUtcMs: null,
    dispatchedAtUtcMs: null,
    pickedUpAtUtcMs: null,
    completedAtUtcMs: null,
  }
}

export function indexHotelsById(hotels: CrewHotelRef[]): Map<string, CrewHotelRef> {
  const m = new Map<string, CrewHotelRef>()
  for (const h of hotels) m.set(h._id, h)
  return m
}
