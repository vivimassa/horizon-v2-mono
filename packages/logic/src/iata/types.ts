// ─── IATA Movement Message Types (AHM 780 / AHM 583) ────────────

// ─── MVT ─────────────────────────────────────────────────────────

export type MvtActionCode =
  | 'AD' // Actual Departure
  | 'AA' // Actual Arrival
  | 'ED' // Estimated Departure (delay)
  | 'EA' // Estimated Arrival (standalone revision)
  | 'NI' // Next Information (indefinite delay)
  | 'RR' // Return to Ramp
  | 'FR' // Forced Return (from airborne)

export interface MvtFlightId {
  airline: string // 2-letter IATA code
  flightNumber: string // up to 4 digits + optional suffix
  dayOfMonth: string // DD
  registration: string // tail number (no dashes)
  station: string // 3-letter IATA airport code
}

export interface MvtEta {
  time: string // HHMM
  destination: string // 3-letter IATA
}

export interface MvtDelay {
  code: string // 2-digit numeric
  duration?: string // HHMM (optional)
}

export interface MvtPassengers {
  total: number
  noSeatHolders?: number // infants
  sectors?: number[] // multi-sector breakdown
}

export interface ParsedMvt {
  messageType: 'MVT' | 'COR MVT'
  flightId: MvtFlightId
  actionCode: MvtActionCode
  // AD fields
  offBlocks?: string // HHMM or DDHHMM
  airborne?: string // HHMM or DDHHMM
  // AA fields
  touchdown?: string // HHMM or DDHHMM
  onBlocks?: string // HHMM or DDHHMM
  // ED fields
  estimatedDeparture?: string // DDHHMM
  // NI fields
  nextInfoTime?: string // DDHHMM
  // RR fields
  returnTime?: string // HHMM or DDHHMM
  // FR fields (same as AA)
  // EA entries
  etas: MvtEta[]
  // DL
  delays: MvtDelay[]
  // PX
  passengers?: MvtPassengers
  // SI
  supplementaryInfo: string[]
  // Raw lines for reference
  rawLines: string[]
}

// ─── LDM ─────────────────────────────────────────────────────────

export interface LdmFlightId {
  airline: string
  flightNumber: string
  dayOfMonth: string
  registration: string
  aircraftType?: string
  cabinConfig?: string // e.g. "F16Y129"
  crewConfig?: string // e.g. "2/5"
}

export interface LdmPaxBreakdown {
  /** Per-class counts in cabin config order */
  revenue: number[]
  /** Per-class non-revenue/deadhead */
  nonRevenue: number[]
  /** Total infants (not in seat count) */
  infants?: number
}

export interface LdmCompartmentLoad {
  compartment: number | string
  weight: number // kg
}

export interface LdmBaggage {
  pieces: number
  weight: number // kg
}

export interface LdmDestinationBlock {
  station: string // 3-letter IATA
  paxBreakdown?: string // raw M/F/C/I or A/C/I string
  totalHoldWeight?: number
  compartments: LdmCompartmentLoad[]
  pax?: LdmPaxBreakdown
  baggage?: LdmBaggage
  cargoWeight?: number
  mailWeight?: number
  equipmentWeight?: number
  specialLoads: string[] // AVI/5, HUM/1/102, etc.
}

export interface LdmSupplementary {
  dow?: number // Dry Operating Weight
  zfw?: number // Zero Fuel Weight
  tow?: number // Take-Off Weight
  tof?: number // Take-Off Fuel
  law?: number // Landing Weight
  totalSob?: number // Total Souls On Board
  raw: string[] // raw SI lines
}

export interface ParsedLdm {
  messageType: 'LDM'
  flightId: LdmFlightId
  destinations: LdmDestinationBlock[]
  supplementary: LdmSupplementary
  rawLines: string[]
}

// ─── Envelope ────────────────────────────────────────────────────

export interface TypeBEnvelope {
  priority?: string // QU, QK, QD, etc.
  addresses: string[] // 7-char IATA addresses
  originator?: string
  timestamp?: string // DDHHMM
}

// ─── Union ───────────────────────────────────────────────────────

export type ParsedMessage =
  | ({ type: 'MVT' } & ParsedMvt)
  | ({ type: 'LDM' } & ParsedLdm)
  | { type: 'UNKNOWN'; rawLines: string[]; error: string }
