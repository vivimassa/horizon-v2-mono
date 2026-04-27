// ── Flight Detail Types (for Flight Information dialog) ──

export interface AirportSummary {
  icaoCode: string
  iataCode: string | null
  name: string
  city: string | null
  country: string | null
  timezone: string
  utcOffsetHours: number | null
}

export interface AircraftTypeSummary {
  icaoType: string
  name: string
  category: string
  paxCapacity: number | null
  manufacturer: string | null
}

export interface AircraftSummary {
  registration: string
  serialNumber: string | null
  homeBaseIcao: string | null
  status: string
}

export interface FlightDetail {
  // Identity
  id: string
  scheduledFlightId: string
  flightNumber: string
  airlineCode: string
  operatingDate: string

  // Route
  depStation: string
  arrStation: string
  depAirport: AirportSummary | null
  arrAirport: AirportSummary | null

  // Schedule
  stdUtc: number
  staUtc: number
  blockMinutes: number
  daysOfWeek: string
  effectiveFrom: string
  effectiveUntil: string
  departureDayOffset: number
  arrivalDayOffset: number

  // Aircraft
  aircraftTypeIcao: string | null
  aircraftType: AircraftTypeSummary | null
  aircraftReg: string | null
  aircraft: AircraftSummary | null

  // Operational (populated when FlightInstance exists)
  hasInstance: boolean
  actual: {
    doorCloseUtc: number | null
    atdUtc: number | null
    offUtc: number | null
    onUtc: number | null
    ataUtc: number | null
  }
  estimated: {
    etdUtc: number | null
    etaUtc: number | null
  }
  depInfo: { terminal: string | null; gate: string | null; stand: string | null; ctot: string | null }
  arrInfo: { terminal: string | null; gate: string | null; stand: string | null }
  pax: {
    adultExpected: number | null
    adultActual: number | null
    childExpected: number | null
    childActual: number | null
    infantExpected: number | null
    infantActual: number | null
  } | null
  fuel: { initial: number | null; uplift: number | null; burn: number | null; flightPlan: number | null } | null
  cargo: Array<{ category: string; weight: number | null; pieces: number | null }>
  delays: Array<{ code: string; minutes: number; reason: string; category: string }>
  crew: Array<{
    employeeId: string
    role: string
    name: string
    /** 'operational' = check-in override on FlightInstance.crew[];
     *  'rostered'    = computed from Pairing → CrewAssignment. */
    source: 'operational' | 'rostered'
    pairingId: string | null
    pairingCode: string | null
    status: 'planned' | 'confirmed' | 'rostered' | 'cancelled' | null
    crewId: string | null
  }>
  /** Pairings whose legs include this flight. Empty when the flight is
   *  not yet rostered. Used by the Crew tab to deep-link into Crew Ops. */
  pairings: Array<{ id: string; code: string }>
  memos: Array<{ id: string; category: string; content: string; author: string; pinned: boolean; createdAt: string }>
  connections: {
    outgoing: Array<{ flightNumber: string; pax: number }>
    incoming: Array<{ flightNumber: string; pax: number }>
  }

  // Disruption state (AIMS §5.4.1–5.4.2)
  disruption: {
    kind: 'none' | 'divert' | 'airReturn' | 'rampReturn'
    divertAirportIcao?: string | null
    ataUtc?: number | null
    etaUtc?: number | null
    reasonCode?: string | null
    reasonText?: string | null
    nextFlightNumber?: string | null
    nextEtdUtc?: number | null
    doNotGenerateNextFlight?: boolean
    appliedAt?: number | null
    appliedBy?: string | null
  }

  // Crew reporting time (AIMS §5.4.4) — Reschedule resets this to null
  crewReportingTimeUtc: number | null

  // Jump seaters (AIMS §5.3) — from crew directory or non-crew directory
  jumpSeaters: Array<{
    kind: 'crew' | 'nonCrew'
    personId: string
    name: string
    company: string | null
    department: string | null
    assignedAt: number
    assignedBy: string
  }>

  // Schedule metadata
  status: string
  serviceType: string
  cockpitCrewRequired: number | null
  cabinCrewRequired: number | null
  isEtops: boolean
  isOverwater: boolean
  rotationId: string | null
  rotationLabel: string | null
  rotationSequence: number | null
  source: string
  createdAt: string | null
  updatedAt: string | null

  // LOPA (cabin layout)
  lopa: {
    configName: string
    totalSeats: number
    cabins: Array<{ classCode: string; seats: number }>
  } | null
}
