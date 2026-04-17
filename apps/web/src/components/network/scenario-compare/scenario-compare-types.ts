import type { ScheduledFlightRef, ScenarioRef, ScenarioEnvelopeRef } from '@skyhub/api'

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export type ChangeField =
  | 'stdUtc'
  | 'staUtc'
  | 'aircraftTypeIcao'
  | 'blockMinutes'
  | 'daysOfWeek'
  | 'serviceType'
  | 'status'

export type ActionCode = 'TIM' | 'EQT'

export const CHANGE_FIELD_ACTION: Record<ChangeField, ActionCode> = {
  stdUtc: 'TIM',
  staUtc: 'TIM',
  aircraftTypeIcao: 'EQT',
  blockMinutes: 'TIM',
  daysOfWeek: 'TIM',
  serviceType: 'TIM',
  status: 'TIM',
}

export type FlightStatus = 'draft' | 'active' | 'suspended' | 'cancelled'

export interface ScenarioStats {
  totalFlights: number
  totalSectors: number
  totalBlockHours: number
  uniqueStations: number
  uniqueRoutes: number
  aircraftTypes: string[]
  statusBreakdown: Record<FlightStatus, number>
}

export interface FlightSnapshot {
  id: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  aircraftTypeIcao: string | null
  blockMinutes: number | null
  daysOfWeek: string
  serviceType: string | null
  status: FlightStatus
  effectiveFrom: string
  effectiveUntil: string
}

export interface DiffRowCell {
  scenarioId: string
  snap: FlightSnapshot | null
  changedFields: ChangeField[]
}

export interface DiffRow {
  key: string
  flightNumber: string
  depStation: string
  arrStation: string
  effectiveFrom: string
  daysOfWeek: string
  perScenario: DiffRowCell[]
  overallStatus: DiffStatus
}

export interface ScenarioCompareFilterState {
  periodFrom: string
  periodTo: string
  /** Ordered scenario IDs (2–3 items). First entry is A, second B, third C. */
  scenarioIds: string[]
}

export interface ScenarioWithEnvelope {
  scenario: ScenarioRef
  envelope: ScenarioEnvelopeRef | null
}

export interface ScenarioCompareResult {
  perScenario: Array<{ scenarioId: string; stats: ScenarioStats }>
  rows: DiffRow[]
}

export type FlightSet = { scenarioId: string; flights: ScheduledFlightRef[] }
