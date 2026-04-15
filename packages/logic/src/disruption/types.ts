/**
 * Disruption signal contract.
 *
 * Every detector (rule engine today, ML model after 2.1.3.1) emits signals
 * in this shape. The feed, KPI strip, and detail panel consume signals —
 * they do not know whether a signal came from rules or ML. This is the
 * seam that lets 2.1.3.1 plug in without touching the UI.
 *
 * Keep this shape STABLE. Changing field names is a breaking change for
 * the ML adapter and the persisted disruption_issues collection.
 */

export type DisruptionCategory =
  | 'TAIL_SWAP'
  | 'DELAY'
  | 'CANCELLATION'
  | 'DIVERSION'
  | 'CONFIG_CHANGE'
  | 'MISSING_OOOI'
  | 'MAINTENANCE_RISK'
  | 'CURFEW_VIOLATION'
  | 'TAT_VIOLATION'

export type DisruptionSeverity = 'critical' | 'warning' | 'info'

export type DisruptionSource = 'IROPS_AUTO' | 'ML_PREDICTION' | 'MANUAL'

/**
 * Suggested action surfaced on the detail panel. Cost + delay estimates are
 * populated by the recovery-solver cost model so dispatchers see the
 * numeric impact, not just a text recommendation (V1 regret).
 */
export interface SuggestedAction {
  id: string
  label: string
  /** Deep-link target — MODULE_REGISTRY code, e.g. '2.1.1'. Never a hardcoded path. */
  linkedModuleCode?: string | null
  linkedEntityId?: string | null
  estimatedDelayMinutes?: number | null
  estimatedCostUsd?: number | null
}

export interface DisruptionSignal {
  /** Stable id — deduplicates repeated detector runs. Convention: `${category}-${flightId}-${hashOfReasons}`. */
  sourceAlertId: string
  source: DisruptionSource

  // Flight context
  flightId: string | null
  flightNumber: string | null
  forDate: string | null
  depStation: string | null
  arrStation: string | null
  tail: string | null
  aircraftType: string | null

  category: DisruptionCategory
  severity: DisruptionSeverity
  /** 0..1 — probability for ML, heuristic score for rules. Never null for rule-based. */
  score: number
  reasons: string[]

  title: string
  description: string | null

  suggestedActions: SuggestedAction[]
}

/**
 * Signal adapter — rule engine today, ML model after 2.1.3.1. Both
 * implement this interface so the server route that runs detection is
 * agnostic to which is active.
 */
export interface DisruptionAdapter {
  readonly name: string
  detect(input: DetectorInput): Promise<DisruptionSignal[]> | DisruptionSignal[]
}

/**
 * Everything a detector needs. Kept flat and Mongo-agnostic so detectors
 * can be unit-tested with plain fixtures.
 */
export interface DetectorInput {
  operatorId: string
  /** UTC ms — the reference "now". Used for MISSING_OOOI freshness checks. */
  nowMs: number
  flights: DetectorFlight[]
  maintenance: DetectorMaintenanceEvent[]
  /** Optional METAR/weather snapshot keyed by airport ICAO. */
  weatherByIcao?: Record<string, DetectorWeather>
  /** Airport curfews keyed by IATA — ms offsets relative to midnight UTC. */
  curfewByIata?: Record<string, { startRelativeMs: number; endRelativeMs: number }>
  /** TAT minimums per aircraft type ICAO. */
  tatByAircraftType?: Record<string, number>
}

export interface DetectorFlight {
  id: string
  flightNumber: string
  operatingDate: string
  depIata: string | null
  arrIata: string | null
  stdUtcMs: number | null
  staUtcMs: number | null
  etdUtcMs: number | null
  etaUtcMs: number | null
  atdUtcMs: number | null
  ataUtcMs: number | null
  scheduledTail: string | null
  actualTail: string | null
  aircraftTypeIcao: string | null
  status: string
  /** ScheduledFlight id — used to detect TAIL_SWAP by comparing schedule vs instance. */
  scheduledFlightId: string | null
}

export interface DetectorMaintenanceEvent {
  aircraftId: string
  tail: string | null
  plannedStartUtc: string
  plannedEndUtc: string | null
  status: string
}

export interface DetectorWeather {
  icao: string
  /** VFR, MVFR, IFR, LIFR — drives MAINTENANCE_RISK boost and is displayed on detail panel. */
  category: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'
  observedAtMs: number
}
