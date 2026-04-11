// ─── FDTL Runtime Engine — serializable ruleset ──────────────────────────────
// Loaded once on workspace mount (server action), stored in client state.
// All validation is then done client-side with no per-click round-trips.

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
