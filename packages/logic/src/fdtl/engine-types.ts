// ─── FDTL Runtime Engine — serializable ruleset ──────────────────────────────
// Loaded once on workspace mount (server action), stored in client state.
// All validation is then done client-side with no per-click round-trips.

/** The 6 generic evaluator shapes that cover ~90% of worldwide FDTL rules.
 *  New frameworks onboard by pointing each rule at one of these + params —
 *  no new code. Custom / bespoke evaluators can be added for the remaining
 *  edge cases (e.g. per-country split-duty formulas). */
export type RuleComputationType =
  | 'rolling_cumulative' // MAX_DUTY_7D, MAX_BLOCK_28D, MAX_FDP_672H, etc.
  | 'min_rest_between_events' // MIN_REST_HOME_BASE, MIN_REST_AWAY, MIN_REST_PRE_FDP
  | 'min_rest_after_augmented' // MIN_REST_AFTER_AUGMENTED
  | 'min_rest_in_window' // MIN_EXTENDED_RECOVERY (window = MAX_BETWEEN_EXTENDED_RECOVERY)
  | 'per_duty_limit' // MAX_LANDINGS_PER_FDP, MAX_FDP_ACCLIMATISED
  | 'consecutive_count' // MAX_CONSECUTIVE_DUTY_DAYS
  | 'commander_discretion_cap' // CMD_DISC_MAX_USES_{N}{D|M|Y}
  | 'custom' // opt-out — validator ignores; engineer wires a bespoke check

export interface SerializedRuleSet {
  operatorId: string
  frameworkCode: string
  frameworkName: string
  /** Minutes before STD that report time begins (e.g. 45) */
  defaultReportMinutes: number
  /** Minutes after STA that FDP ends (debrief, e.g. 30) */
  defaultDebriefMinutes: number
  /** Per-route reporting time overrides. Key: "${time_type}|${route_type}|${column_key}" */
  reportingTimes: Array<{ key: string; minutes: number }>
  /** Null when the FDP table hasn't been configured — reporting times still work */
  fdpTable: {
    tableCode: string
    /** Row keys as stored in DB, e.g. ['0600-1329', '1330-1359', ...] */
    rowKeys: string[]
    rowLabels: string[]
    /** Column keys as stored in DB, e.g. ['1-2', '3', '4', ..., '10+'] */
    colKeys: string[]
    colLabels: string[]
    /** FDP limit cells. Key: "${row_key}|${col_key}" */
    cells: Array<{ key: string; minutes: number }>
  } | null
  rules: Array<{
    code: string
    value: string
    valueType: string
    unit: string
    directionality: string | null
    label: string
    legalReference: string | null
    /** How this rule is evaluated by the crew-schedule validator. When
     *  null, the validator falls back to inference from `code`. See
     *  `inferComputationType` in evaluators.ts. Data-driven so adding
     *  an airline's framework doesn't require code changes. */
    computationType?: RuleComputationType | null
    /** Free-form params consumed by the evaluator for this
     *  computationType. E.g. `{ window: '7D', field: 'duty' }` for
     *  rolling_cumulative, `{ context: 'home' | 'away' | 'augmented' }`
     *  for min_rest_between_events. */
    params?: Record<string, unknown> | null
  }>
  /** Augmented FDP limits keyed by crew count + facility class. Empty when not configured. */
  augmentedLimits: Array<{
    crewCount: number
    facilityClass: string
    facilityLabel: string // e.g. "Class 1 — Bunk"
    maxFdpMinutes: number
    legalReference: string | null
  }>
  /** Cabin crew in-flight rest table (e.g. CAAV Table 05). Null when not configured. */
  cabinRestTable: {
    rowKeys: string[]
    rowLabels: string[]
    colKeys: string[]
    colLabels: string[]
    cells: Array<{ key: string; minutes: number }>
  } | null
  /** Cruise time deductions for computing available in-flight rest time */
  cruiseTimeDeductions: {
    taxiOutMinutes: number
    taxiInMinutes: number
    climbMinutes: number
    descentMinutes: number
  }
}
