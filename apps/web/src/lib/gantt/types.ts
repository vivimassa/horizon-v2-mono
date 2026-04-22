// ── API Response Types (mirror server response) ──

export interface GanttFlight {
  id: string
  scheduledFlightId: string
  airlineCode: string | null
  flightNumber: string
  depStation: string
  arrStation: string
  stdUtc: number
  staUtc: number
  blockMinutes: number
  /** Actual departure time (OUT) from FlightInstance */
  atdUtc?: number | null
  /** Actual takeoff time (OFF) from FlightInstance */
  offUtc?: number | null
  /** Actual landing time (ON) from FlightInstance */
  onUtc?: number | null
  /** Actual arrival time (IN) from FlightInstance */
  ataUtc?: number | null
  /** Estimated departure from FlightInstance */
  etdUtc?: number | null
  /** Estimated arrival from FlightInstance */
  etaUtc?: number | null
  operatingDate: string
  aircraftTypeIcao: string | null
  aircraftReg: string | null
  status: string
  serviceType: string
  scenarioId: string | null
  rotationId: string | null
  rotationSequence: number | null
  rotationLabel: string | null
  /** Slot status from SlotSeries linked via scheduledFlightId */
  slotStatus?: 'confirmed' | 'offered' | 'waitlisted' | 'refused' | 'conditional' | null
  /** Slot utilization % for the linked series (0-100) */
  slotUtilizationPct?: number | null
  /** Risk level derived from utilization: safe (>=85%), close (80-85%), at_risk (<80%) */
  slotRiskLevel?: 'safe' | 'close' | 'at_risk' | null
  /** SlotSeries ID for cancel-impact lookup */
  slotSeriesId?: string | null
  /** Flight protected from disruption solver — will never be delayed/cancelled/swapped */
  isProtected?: boolean

  // ── OCC Dashboard extras (present only when fetched with includeOcc=1) ──
  /** Delay entries captured against this flight — code is AHM 730/731 or 732 depending on operator config. */
  delays?: { code: string; minutes: number; category: string }[]
  /** Departure gate (free-text). */
  depGate?: string | null
  /** Arrival gate (free-text). */
  arrGate?: string | null
  /** Applied disruption kind from Flight Information Dialog. */
  disruptionKind?: 'none' | 'divert' | 'airReturn' | 'rampReturn'
  /** Epoch ms when a disruption was applied (null if none). */
  disruptionAppliedAt?: number | null
}

export interface GanttAircraft {
  id: string
  registration: string
  aircraftTypeId: string
  aircraftTypeIcao: string | null
  aircraftTypeName: string | null
  status: string
  homeBaseIcao: string | null
  color: string | null
  fuelBurnRateKgPerHour: number | null
  /** Seat counts per cabin class, e.g. "0/0/230" (F/J/Y) */
  seatConfig: string | null
}

export interface GanttAircraftType {
  id: string
  icaoType: string
  name: string
  category: string
  color: string | null
  tatDefaultMinutes: number | null
  tatDomDom: number | null
  tatDomInt: number | null
  tatIntDom: number | null
  tatIntInt: number | null
  fuelBurnRateKgPerHour: number | null
}

export interface GanttMeta {
  from: string
  to: string
  totalFlights: number
  totalAircraft: number
  expandedAt: number
}

export interface StationCurfew {
  startTime: string // "HH:MM" local
  endTime: string // "HH:MM" local
  effectiveFrom: string | null
  effectiveUntil: string | null
}

export interface GanttApiResponse {
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  operatorCountry: string | null
  stationCountryMap: Record<string, string>
  stationUtcOffsetMap: Record<string, number>
  stationCurfewMap: Record<string, StationCurfew[]>
  meta: GanttMeta
}

// ── View State Types ──

export type ZoomLevel = '1D' | '2D' | '3D' | '4D' | '5D' | '6D' | '7D' | '14D' | '21D' | '28D'
export type ColorMode = 'status' | 'ac_type' | 'service_type' | 'route_type'
export type BarLabelMode = 'flightNo' | 'sector'
export type FleetSortOrder = 'type' | 'registration' | 'utilization'

export const ZOOM_CONFIG: Record<ZoomLevel, { days: number; hoursPerTick: number }> = {
  '1D': { days: 1, hoursPerTick: 1 },
  '2D': { days: 2, hoursPerTick: 2 },
  '3D': { days: 3, hoursPerTick: 2 },
  '4D': { days: 4, hoursPerTick: 3 },
  '5D': { days: 5, hoursPerTick: 4 },
  '6D': { days: 6, hoursPerTick: 4 },
  '7D': { days: 7, hoursPerTick: 6 },
  '14D': { days: 14, hoursPerTick: 12 },
  '21D': { days: 21, hoursPerTick: 24 },
  '28D': { days: 28, hoursPerTick: 24 },
}

export const ROW_HEIGHT_LEVELS = [
  { label: 'compact', rowH: 32, barH: 22, fontSize: 10 },
  { label: 'default', rowH: 44, barH: 28, fontSize: 11 },
  { label: 'large', rowH: 56, barH: 36, fontSize: 12 },
  { label: 'xlarge', rowH: 72, barH: 48, fontSize: 13 },
] as const

// ── Layout Types (output of layout engine, used by canvas renderer) ──

export interface BarLayout {
  flightId: string
  x: number
  y: number
  width: number
  height: number
  color: string
  textColor: string
  label: string
  row: number
  flight: GanttFlight
  /** Pairing-gantt only: mark bars whose pairing uses an augmented crew template. */
  augmented?: boolean
}

export interface RowLayout {
  type: 'group_header' | 'aircraft' | 'unassigned' | 'suspended' | 'cancelled'
  registration?: string
  aircraftTypeIcao?: string
  aircraftTypeName?: string
  seatConfig?: string | null
  label: string
  y: number
  height: number
  color?: string
  aircraftCount?: number
  /** Count of flights on this row; used for status summary rows */
  flightCount?: number
}

export interface TickMark {
  x: number
  label: string
  isMajor: boolean
  /** ISO date string (YYYY-MM-DD) for major (day boundary) ticks */
  date?: string
}

export interface LayoutResult {
  rows: RowLayout[]
  bars: BarLayout[]
  ticks: TickMark[]
  totalWidth: number
  totalHeight: number
  /** Virtual placement map (flightId → registration) for affinity on next recompute */
  virtualPlacements: Map<string, string>
}
