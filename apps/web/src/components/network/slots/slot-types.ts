// ── Slot Manager Types (Module 1.1.3) ──
// camelCase fields matching V2 Mongoose schemas in server/src/models/Slot*.ts

// ── Enums / Union Types ──

export type SlotStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'offered'
  | 'waitlisted'
  | 'refused'
  | 'conditional'
  | 'cancelled'
  | 'historic'

export type PriorityCategory =
  | 'historic'
  | 'changed_historic'
  | 'new_entrant'
  | 'new'
  | 'adhoc'

export type OperationStatus =
  | 'scheduled'
  | 'operated'
  | 'cancelled'
  | 'no_show'
  | 'jnus'

export type MessageDirection = 'inbound' | 'outbound'

export type MessageType =
  | 'SCR' | 'SAL' | 'SHL' | 'SMA'
  | 'SIR' | 'SAQ' | 'WCR' | 'WIR'

export type AirlineActionCode =
  | 'N' | 'Y' | 'B' | 'V' | 'F'
  | 'C' | 'M' | 'R' | 'L' | 'I'
  | 'D' | 'A' | 'P' | 'Z'

export type CoordinatorActionCode =
  | 'K' | 'H' | 'O' | 'U'
  | 'X' | 'T' | 'W'

// ── Constants ──

export const ACTION_CODE_LABELS: Record<string, string> = {
  N: 'New',
  Y: 'New (year-round)',
  B: 'New entrant',
  V: 'NE year-round',
  F: 'Historic',
  C: 'Change (operational)',
  M: 'Change (non-op)',
  R: 'Replace (offer OK)',
  L: 'Replace (no offer)',
  I: 'Revised (year-round)',
  D: 'Delete',
  A: 'Accept',
  P: 'Accept (stay waitlist)',
  Z: 'Decline',
  K: 'Confirmed',
  H: 'Historic-eligible',
  O: 'Offered',
  U: 'Unable',
  X: 'Cancelled',
  T: 'Conditional',
  W: 'Unable to reconcile',
}

export const STATUS_COLORS: Record<SlotStatus, string> = {
  draft: 'gray',
  submitted: 'blue',
  confirmed: 'green',
  offered: 'amber',
  waitlisted: 'purple',
  refused: 'red',
  conditional: 'cyan',
  cancelled: 'red',
  historic: 'teal',
}

export const STATUS_CHIP_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  confirmed:   { bg: 'rgba(6,194,112,0.12)',  text: '#06C270', border: 'rgba(6,194,112,0.18)' },
  offered:     { bg: 'rgba(255,136,0,0.12)',   text: '#FF8800', border: 'rgba(255,136,0,0.18)' },
  refused:     { bg: 'rgba(255,59,59,0.12)',   text: '#FF3B3B', border: 'rgba(255,59,59,0.18)' },
  waitlisted:  { bg: 'rgba(124,58,237,0.12)',  text: '#7c3aed', border: 'rgba(124,58,237,0.18)' },
  historic:    { bg: 'rgba(0,207,222,0.10)',   text: '#00CFDE', border: 'rgba(0,207,222,0.15)' },
  conditional: { bg: 'rgba(0,207,222,0.10)',   text: '#00CFDE', border: 'rgba(0,207,222,0.15)' },
  submitted:   { bg: 'rgba(0,99,247,0.10)',    text: '#0063F7', border: 'rgba(0,99,247,0.15)' },
  draft:       { bg: 'rgba(128,128,128,0.08)', text: '#8F90A6', border: 'rgba(128,128,128,0.12)' },
  cancelled:   { bg: 'rgba(255,59,59,0.12)',   text: '#FF3B3B', border: 'rgba(255,59,59,0.18)' },
}

export const JNUS_REASONS = [
  'Airport/airspace closure',
  'ATC disruption',
  'Weather',
  'Health/pandemic',
  'Industrial action',
  'Manufacturing/supply chain',
  'Security/terrorism',
  'War/political unrest',
  'Geological event',
  'Regulatory restriction',
] as const

export type JnusReason = (typeof JNUS_REASONS)[number]

export const PRIORITY_LABELS: Record<PriorityCategory, string> = {
  historic: 'Historic',
  changed_historic: 'Changed',
  new_entrant: 'New Entrant',
  new: 'New',
  adhoc: 'Ad-hoc',
}

// ── Table Interfaces (camelCase, matching Mongoose schemas) ──

export interface SlotSeries {
  _id: string
  operatorId: string
  airportIata: string
  seasonCode: string
  arrivalFlightNumber: string | null
  departureFlightNumber: string | null
  arrivalOriginIata: string | null
  departureDestIata: string | null
  requestedArrivalTime: number | null
  requestedDepartureTime: number | null
  allocatedArrivalTime: number | null
  allocatedDepartureTime: number | null
  overnightIndicator: number
  periodStart: string
  periodEnd: string
  daysOfOperation: string
  frequencyRate: number
  seats: number | null
  aircraftTypeIcao: string | null
  arrivalServiceType: string | null
  departureServiceType: string | null
  status: SlotStatus
  priorityCategory: PriorityCategory
  historicEligible: boolean
  lastActionCode: string | null
  lastCoordinatorCode: string | null
  flexibilityArrival: string | null
  flexibilityDeparture: string | null
  minTurnaroundMinutes: number | null
  coordinatorRef: string | null
  coordinatorReasonArrival: string | null
  coordinatorReasonDeparture: string | null
  waitlistPosition: number | null
  linkedScheduledFlightId: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface SlotDate {
  _id: string
  seriesId: string
  slotDate: string
  operationStatus: OperationStatus
  jnusReason: string | null
  jnusEvidence: string | null
  actualArrivalTime: number | null
  actualDepartureTime: number | null
  createdAt: string | null
}

export interface SlotMessage {
  _id: string
  operatorId: string
  direction: MessageDirection
  messageType: string
  airportIata: string
  seasonCode: string
  rawText: string
  parseStatus: 'pending' | 'parsed' | 'error' | 'partial'
  parseErrors: Array<{ line: number; message: string }> | null
  parsedSeriesCount: number
  source: string | null
  reference: string | null
  createdAt: string | null
}

export interface SlotActionLog {
  _id: string
  seriesId: string
  actionCode: string
  actionSource: 'airline' | 'coordinator'
  messageId: string | null
  details: Record<string, unknown> | null
  createdAt: string | null
}

// ── Computed / View Types ──

export interface CoordinatedAirport {
  iataCode: string
  name: string
  coordinationLevel: 1 | 2 | 3
  slotsPerHourDay: number | null
  slotsPerHourNight: number | null
  coordinatorName: string | null
  coordinatorEmail: string | null
}

export interface UtilizationSummary {
  seriesId: string
  totalDates: number
  operated: number
  cancelled: number
  jnus: number
  noShow: number
  scheduled: number
  utilizationPct: number
  isAtRisk: boolean
  isClose: boolean
}

export interface PortfolioStats {
  totalSeries: number
  confirmed: number
  offered: number
  waitlisted: number
  refused: number
  atRisk80: number
}

export interface SlotCalendarWeek {
  weekNumber: number
  operated: number
  cancelled: number
  jnus: number
  total: number
}

// ── Helpers ──

export function formatSlotTime(hhmm: number | null): string {
  if (hhmm === null || hhmm === undefined) return '\u2014'
  const h = Math.floor(hhmm / 100)
  const m = hhmm % 100
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Parse DD/MM/YYYY or YYYY-MM-DD into a Date */
function parseFlexDate(str: string): Date | null {
  if (!str) return null
  // DD/MM/YYYY
  if (str.includes('/')) {
    const [d, m, y] = str.split('/')
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
  }
  // ISO YYYY-MM-DD
  return new Date(str)
}

export function formatPeriod(start: string, end: string): string {
  if (!start || !end) return '\u2014'
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const s = parseFlexDate(start)
  const e = parseFlexDate(end)
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return '\u2014'
  const sd = `${String(s.getDate()).padStart(2, '0')}${months[s.getMonth()]}`
  const ed = `${String(e.getDate()).padStart(2, '0')}${months[e.getMonth()]}`
  return `${sd}\u2013${ed}`
}

export function getCurrentSeason(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear() % 100
  if (month >= 3 && month <= 9) return `S${year}`
  return `W${year}`
}

/**
 * Map snake_case parser output to camelCase API format.
 * Used when importing parsed SAL/SCR message data.
 */
export function parsedSeriesToApiFormat(snake: Record<string, unknown>): Partial<SlotSeries> {
  return {
    operatorId: snake.operator_id as string,
    airportIata: snake.airport_iata as string,
    seasonCode: snake.season_code as string,
    arrivalFlightNumber: (snake.arrival_flight_number as string) ?? null,
    departureFlightNumber: (snake.departure_flight_number as string) ?? null,
    arrivalOriginIata: (snake.arrival_origin_iata as string) ?? null,
    departureDestIata: (snake.departure_dest_iata as string) ?? null,
    requestedArrivalTime: (snake.requested_arrival_time as number) ?? null,
    requestedDepartureTime: (snake.requested_departure_time as number) ?? null,
    allocatedArrivalTime: (snake.allocated_arrival_time as number) ?? null,
    allocatedDepartureTime: (snake.allocated_departure_time as number) ?? null,
    overnightIndicator: (snake.overnight_indicator as number) ?? 0,
    periodStart: (snake.period_start as string) ?? '',
    periodEnd: (snake.period_end as string) ?? '',
    daysOfOperation: (snake.days_of_operation as string) ?? '1234567',
    frequencyRate: (snake.frequency_rate as number) ?? 1,
    seats: (snake.seats as number) ?? null,
    aircraftTypeIcao: (snake.aircraft_type_icao as string) ?? null,
    arrivalServiceType: (snake.arrival_service_type as string) ?? null,
    departureServiceType: (snake.departure_service_type as string) ?? null,
    status: (snake.status as SlotStatus) ?? 'draft',
    priorityCategory: (snake.priority_category as PriorityCategory) ?? 'new',
    historicEligible: (snake.historic_eligible as boolean) ?? false,
    lastActionCode: (snake.last_action_code as string) ?? null,
    lastCoordinatorCode: (snake.last_coordinator_code as string) ?? null,
    flexibilityArrival: (snake.flexibility_arrival as string) ?? null,
    flexibilityDeparture: (snake.flexibility_departure as string) ?? null,
    minTurnaroundMinutes: (snake.min_turnaround_minutes as number) ?? null,
    coordinatorReasonArrival: (snake.coordinator_reason_arrival as string) ?? null,
    coordinatorReasonDeparture: (snake.coordinator_reason_departure as string) ?? null,
  }
}
