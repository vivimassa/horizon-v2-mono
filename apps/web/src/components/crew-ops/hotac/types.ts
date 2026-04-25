// HOTAC workspace types — 4.1.8.1
// Bookings/emails have no backend yet (Phases 2/3); these are the in-memory
// shapes used for derivation, display, and (later) network round-trips.

export type HotacTab = 'planning' | 'dayToDay' | 'communication'

export type DerivationMode = 'planning' | 'dayToDay'

export type BookingStatus =
  | 'demand' // freshly derived from pairings, not yet allocated
  | 'forecast' // Enlist run — rooms allocated, hotel matched, not yet sent
  | 'pending' // queued to send to hotel
  | 'sent' // sent, awaiting hotel reply
  | 'confirmed' // hotel confirmed
  | 'in-house' // crew checked in
  | 'departed' // crew checked out
  | 'cancelled' // booking cancelled (e.g. flight cancelled)
  | 'no-show' // crew never showed up

export type CrewPosition = 'PIC' | 'FO' | 'CSM' | 'CCM' | string

export interface HotacCrewMember {
  id: string
  name: string
  position: CrewPosition
  base: string | null
}

/** Lightweight hotel projection used by booking rows — derived from CrewHotelRef. */
export interface HotelLite {
  id: string
  name: string
  icao: string
  iata: string
  priority: number
  distance: number
  rate: number
  currency: string
  amenities: string[]
}

/** A single hotel-night booking. In Phase 1 these are derived in-memory from
 *  pairings + assignments. In Phase 2 they're persisted as `HotelBooking` docs. */
export interface HotacBooking {
  id: string
  pairingId: string
  pairingCode: string
  airportIcao: string
  airportIata: string
  /** UTC ms of 00:00 on the operator-local night. Used as the grouping key. */
  layoverNightUtcMs: number
  arrFlight: string | null
  arrStaUtcIso: string | null
  depFlight: string | null
  depStdUtcIso: string | null
  /** Block-to-block layover in hours (rest period from inbound STA → outbound STD). */
  layoverHours: number
  status: BookingStatus
  hotel: HotelLite | null
  rooms: number
  occupancy: 'single' | 'double'
  pax: number
  /** Aggregate counts per position. Always present. */
  crewByPosition: Record<string, number>
  /** Full crew list — only populated when derivation runs in 'dayToDay' mode. */
  crew: HotacCrewMember[]
  cost: number
  costCurrency: string
  shuttle: 'Y' | 'N' | 'walking' | null
  confirmationNumber: string | null
  notes: string | null
  /** Disruption flags computed by detect-disruptions (post-fetch). */
  disruptionFlags: DisruptionFlag[]
}

export type DisruptionFlag =
  | 'inbound-cancelled'
  | 'outbound-cancelled'
  | 'inbound-delayed'
  | 'outbound-delayed'
  | 'extend-night'
  | 'overdue-confirmation'

export interface HotacDisruption {
  bookingId: string
  flag: DisruptionFlag
  detail: string
  detectedAtUtcMs: number
}

/** Filter state mirrors the 4.1.6.2 schedule store shape so both modules can
 *  coexist on the same draft pattern. Station is HOTAC-specific. */
export interface HotacFilters {
  stationIcaos: string[] | null
  baseAirports: string[] | null
  positions: string[] | null
  aircraftTypes: string[] | null
  crewGroupIds: string[] | null
}

export const EMPTY_HOTAC_FILTERS: HotacFilters = {
  stationIcaos: null,
  baseAirports: null,
  positions: null,
  aircraftTypes: null,
  crewGroupIds: null,
}

/** Per-position layover-rule defaults. Phase 4 swaps this for OperatorHotacConfig. */
export interface LayoverConfig {
  layoverMinHours: number
  excludeHomeBase: boolean
  minSpanMidnightHours: number
}

export const DEFAULT_LAYOVER_CONFIG: LayoverConfig = {
  layoverMinHours: 6,
  excludeHomeBase: true,
  minSpanMidnightHours: 0,
}
