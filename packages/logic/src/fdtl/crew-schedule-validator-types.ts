// Shared types between crew-schedule-validator and evaluators.

export interface ScheduleDuty {
  id: string
  /** `rest` = activity that does NOT count as duty (annual leave, day off,
   *  rest period, home standby, etc). Treated as rest by all evaluators —
   *  ignored by cumulative-duty caps, satisfies weekly-rest gaps, and is
   *  not a duty endpoint for between-duty rest checks. */
  kind: 'pairing' | 'activity' | 'rest'
  startUtcMs: number
  endUtcMs: number
  dutyMinutes: number
  blockMinutes: number
  fdpMinutes: number
  /** Sector / landing count for per-duty limits (MAX_LANDINGS_PER_FDP). 0 for activities. */
  landings: number
  /** Departure station of first leg. Null for activities or pairings with no legs. */
  departureStation: string | null
  arrivalStation: string | null
  isAugmented: boolean
  label: string
  /** True when this duty was authorized under commander discretion (planner
   *  override with audit row). Feeds CMD_DISC_MAX_USES_* rolling counter. */
  commanderDiscretion?: boolean
}

export type CheckStatus = 'pass' | 'warning' | 'violation'

export interface ScheduleLegalityCheck {
  label: string
  /** Display string — e.g. "11:20" for duration, "6" for count. */
  actual: string
  /** Display string — e.g. "12:00" for duration, "8" for count. */
  limit: string
  /** Numeric actual. Minutes for durations, integer for counts. Used by
   *  solvers to compute slack / penalty scores. */
  actualNum: number
  /** Numeric limit. Minutes for durations, integer for counts. */
  limitNum: number
  status: CheckStatus
  ruleCode: string | null
  legalReference?: string | null
  shortReason: string
  /** Rolling-window bounds the check evaluated against. ISO UTC. Only
   *  set for window-scoped evaluators (rolling_cumulative, min_rest_in_window,
   *  commander_discretion_cap). Used by UI to show "28D · 2026-03-15 → 2026-04-12". */
  windowFromIso?: string | null
  windowToIso?: string | null
  /** Short descriptor of the rolling window (e.g. "28D", "168H"). */
  windowLabel?: string | null
}
