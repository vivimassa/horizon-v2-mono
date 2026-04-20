import type { Pairing, PairingLegMeta } from '@/components/crew-ops/pairing/types'

/**
 * Types for the Pairing Gantt zone overlay: packed duty pills + connector
 * lines + broken-chain detection. Separate from `types.ts` (which serves the
 * Movement Control grid) so this module can evolve without coupling.
 */

export interface PillLayout {
  flightId: string
  x: number
  width: number
  label: string
  isDeadhead: boolean
  depStation: string
  arrStation: string
  flightNumber: string
  stdMs: number
  staMs: number
}

export interface ConnectorSegment {
  /** Horizontal position of the connector start (= previous pill's x+width). */
  x: number
  /** Connector width. */
  width: number
  /** Minutes of sit time between the two pills. */
  sitMinutes: number
  /** Whether the connector is legal (sit >= 30min) or illegal (<30min). */
  isLegal: boolean
  /** Whether the connector bridges a station mismatch. */
  isStationGap: boolean
}

export interface PackedPairing {
  pairingId: string
  pairingCode: string
  lane: number
  pills: PillLayout[]
  connectors: ConnectorSegment[]
  /** Overall legality status. */
  status: 'legal' | 'warning' | 'violation'
  workflowStatus: 'draft' | 'committed'
  /** Chain broken: missing leg, station gap, or non-base-to-base. */
  isBroken: boolean
  /** Reason for broken flag (for tooltip / unlink icon). */
  brokenReason: string | null
  /** Aggregate X range for viewport culling. */
  xMin: number
  xMax: number
  /** Reference to the source pairing for click→inspect handoff. */
  pairing: Pairing
}

export interface PairingLayoutInput {
  pairings: Pairing[]
  filter: 'all' | 'covered' | 'partial' | 'under' | 'over' | 'augmented' | 'illegal'
  startMs: number
  pph: number
  /** Base airports — pairings whose first dep or last arr is outside this set are flagged broken. */
  baseAirports: string[] | null
  /** Minimum legal turnaround time in minutes. */
  minTurnaroundMinutes?: number
}

export interface PairingLayoutResult {
  packed: PackedPairing[]
  maxLane: number
  /** Count of pairings shown after filtering. */
  visibleCount: number
  /** Total count before filtering. */
  totalCount: number
}

/** Coverage state shown on grid flight bars (colorMode = 'pairing_status'). */
export type CoverageState = 'unpaired' | 'paired' | 'under' | 'over' | 'mixed'
