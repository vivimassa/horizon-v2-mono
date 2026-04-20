// Core domain types for Crew Pairing workspace (4.1.5)
// Ported from v1 components/workforce/pairing/pairing-types.ts

export interface PairingFlight {
  /** Compound: `${scheduledFlightId}__${instanceDate}` */
  id: string
  scheduledFlightId: string
  instanceDate: string // 'YYYY-MM-DD'
  flightNumber: string
  departureAirport: string
  arrivalAirport: string
  /** Local datetimes for display */
  std: string
  sta: string
  /** UTC ISO timestamps for all duration math */
  stdUtc: string
  staUtc: string
  blockMinutes: number
  aircraftType: string
  tailNumber: string | null
  rotationId: string | null
  rotationLabel: string | null
  serviceType: string | null
  daysOfWeek: string | null
  departureDayOffset: number
  arrivalDayOffset: number
  status: string
  /** Schedule-level effectivity — inherited from the underlying ScheduledFlight. */
  effectiveFrom: string
  effectiveUntil: string
  pairingId: string | null
}

export interface Rotation {
  id: string
  name: string
  color: string
  flightIds: string[]
}

export type PairingLegalityStatus = 'legal' | 'warning' | 'violation'
export type PairingWorkflowStatus = 'draft' | 'committed'

export interface PairingLegMeta {
  flightId: string
  legOrder: number
  isDeadhead: boolean
  depStation: string
  arrStation: string
  flightDate: string
  flightNumber?: string
  stdUtc?: string
  staUtc?: string
  blockMinutes?: number
  aircraftTypeIcao?: string
  stdUtcIso?: string
  staUtcIso?: string
}

export interface Pairing {
  id: string
  pairingCode: string
  baseAirport: string
  status: PairingLegalityStatus
  workflowStatus: PairingWorkflowStatus
  totalBlockMinutes: number
  totalDutyMinutes: number
  pairingDays: number
  startDate: string
  endDate: string
  flightIds: string[]
  deadheadFlightIds: string[]
  complementKey: string
  cockpitCount: number
  facilityClass: string | null
  crewCounts: Record<string, number> | null
  routeChain: string
  reportTime?: string
  legs: PairingLegMeta[]
}

export interface LegalityCheck {
  label: string
  actual: string
  limit: string
  status: 'pass' | 'warning' | 'violation' | 'info'
  fdtlRef?: string
  isOperational?: boolean
  isBaseRouting?: boolean
  depStatus?: 'pass' | 'violation'
  arrStatus?: 'pass' | 'violation'
  tier?: 'normal' | 'extended' | 'augmented'
  escalationNote?: string | null
}

export interface LegalityResult {
  overallStatus: 'pass' | 'warning' | 'violation'
  checks: LegalityCheck[]
  tableRef?: string
  openPairing?: boolean
  crossBase?: boolean
  isMult?: boolean
  augmentedSuggestion?: {
    complementKey: string
    cockpitCount: number
    facilityClass: string
    facilityLabel: string
    maxFdpMinutes: number
  }
  rulesSummary?: Array<{ code: string; label: string; value: string }>
}

export interface PairingOptions {
  cockpitCount: number
  cockpitFacilityClass: string | null
  complementKey?: string
  isAcclimatized?: boolean
  isSinglePilot?: boolean
  splitDutyRest?: number | null
  totalCabinCrew?: number | null
  minOperatingCabin?: number | null
}

export type DurationFilterValue = '1d' | '2d' | '3d' | '4d' | '5d' | '6d' | '7d'

export interface PairingFilters {
  /** null = all bases */
  baseAirports: string[] | null
  /** null = all aircraft types */
  aircraftTypes: string[] | null
  /** Pairing legality status */
  statusFilter: PairingLegalityStatus[]
  /** Workflow status */
  workflowFilter: PairingWorkflowStatus[]
  /** Trip-length filter (empty = all durations) */
  durations: DurationFilterValue[]
  /** Scenario id; null = production */
  scenarioId: string | null
}

export const ALL_STATUS: PairingLegalityStatus[] = ['legal', 'warning', 'violation']
export const ALL_WORKFLOW: PairingWorkflowStatus[] = ['draft', 'committed']
export const ALL_DURATIONS: DurationFilterValue[] = ['1d', '2d', '3d', '4d', '5d', '6d', '7d']

export const DEFAULT_FILTERS: PairingFilters = {
  baseAirports: null,
  aircraftTypes: null,
  statusFilter: ALL_STATUS,
  workflowFilter: ALL_WORKFLOW,
  durations: [],
  scenarioId: null,
}
