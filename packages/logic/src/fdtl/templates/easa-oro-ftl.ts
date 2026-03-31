// EASA ORO.FTL — Flight & Duty Time Limitations (EU Regulation 83/2014)
// Overrides ICAO baseline and adds EASA-specific rules.
// Numeric values are PLACEHOLDER — verify against ORO.FTL and CS FTL.1 before production.

import type { RuleOverride, RuleTemplate, FDPTableTemplate, AugmentedTemplate } from './icao'

// ─── Rule Overrides ─────────────────────────────────────────────────────────

export const EASA_OVERRIDES: Array<RuleOverride | RuleTemplate> = [

  // REST
  { rule_code: 'MIN_REST_PRE_FDP',    value: '11:00', legal_reference: 'ORO.FTL.235(b)' },
  { rule_code: 'REDUCED_REST_MIN',    value: '10:00', legal_reference: 'ORO.FTL.235(c)' },
  { rule_code: 'REDUCED_REST_MAX_7D', value: '1',     legal_reference: 'ORO.FTL.235(c)' },
  { rule_code: 'WEEKLY_TIME_FREE',    value: '36:00', legal_reference: 'ORO.FTL.235(g)' },

  // CUMULATIVE
  { rule_code: 'MAX_BH_28D',  value: '100:00', legal_reference: 'ORO.FTL.210(a)' },
  { rule_code: 'MAX_BH_365D', value: '900:00', legal_reference: 'ORO.FTL.210(a)' },
  { rule_code: 'MAX_DH_28D',  value: '190:00', legal_reference: 'ORO.FTL.210(b)' },

  { category: 'cumulative', subcategory: 'duty_hours', rule_code: 'MAX_DH_14D',
    label: 'Max duty hours in 14 days', value: '110:00', value_type: 'duration', unit: 'hrs',
    source: 'government', legal_reference: 'ORO.FTL.210(a)', sort_order: 5 },
]

export const EASA_SPECIFIC: RuleTemplate[] = [

  // ── ACCLIMATIZATION ────────────────────────────────────────────────────────
  { category: 'acclimatization', subcategory: 'state', rule_code: 'ACCLIM_PERIOD',
    label: 'Time to become acclimatized', value: '48:00', value_type: 'duration', unit: 'hrs',
    source: 'government', legal_reference: 'CS FTL.1.205', sort_order: 1 },
  { category: 'acclimatization', subcategory: 'state', rule_code: 'ACCLIM_TZ_THRESHOLD',
    label: 'Time zone difference threshold', value: '2', value_type: 'integer', unit: 'hrs',
    source: 'government', legal_reference: 'CS FTL.1.205', sort_order: 2 },
  { category: 'acclimatization', subcategory: 'state', rule_code: 'UNKNOWN_STATE_FDP_RED',
    label: 'FDP reduction in unknown state', value: '2:00', value_type: 'duration', unit: 'hrs',
    source: 'government', legal_reference: 'CS FTL.1.205', sort_order: 3 },

  // ── DISRUPTIVE SCHEDULES ───────────────────────────────────────────────────
  { category: 'disruptive', subcategory: 'windows', rule_code: 'EARLY_START_WINDOW',
    label: 'Early start window', value: '05:00-06:59', value_type: 'text', unit: 'local',
    source: 'government', legal_reference: 'CS FTL.1.205', sort_order: 1 },
  { category: 'disruptive', subcategory: 'windows', rule_code: 'LATE_FINISH_WINDOW',
    label: 'Late finish window', value: '23:00-01:59', value_type: 'text', unit: 'local',
    source: 'government', legal_reference: 'CS FTL.1.205', sort_order: 2 },
  { category: 'disruptive', subcategory: 'windows', rule_code: 'NIGHT_DUTY_WINDOW',
    label: 'Night duty encroachment window', value: '02:00-04:59', value_type: 'text', unit: 'local',
    source: 'government', legal_reference: 'CS FTL.1.205', sort_order: 3 },
  { category: 'disruptive', subcategory: 'limits', rule_code: 'MAX_CONSEC_DISRUPTIVE',
    label: 'Max consecutive disruptive duties', value: '4', value_type: 'integer', unit: 'duties',
    source: 'company', legal_reference: 'CS FTL.1.205', sort_order: 4 },
  { category: 'disruptive', subcategory: 'recovery', rule_code: 'DISRUPTIVE_RECOVERY',
    label: 'Recovery after disruptive block', value: '36:00', value_type: 'duration', unit: 'hrs',
    source: 'government', legal_reference: 'CS FTL.1.205', sort_order: 5 },

  // ── EXTENSION — commander discretion ──────────────────────────────────────
  { category: 'extension', subcategory: 'discretion', rule_code: 'CMD_DISCRETION_UNAUG',
    label: 'Commander discretion (unaugmented)', value: '2:00', value_type: 'duration', unit: 'hrs',
    source: 'government', legal_reference: 'ORO.FTL.205(f)', sort_order: 1 },
  { category: 'extension', subcategory: 'discretion', rule_code: 'CMD_DISCRETION_AUG',
    label: 'Commander discretion (augmented)', value: '3:00', value_type: 'duration', unit: 'hrs',
    source: 'government', legal_reference: 'ORO.FTL.205(f)', sort_order: 2 },
  { category: 'extension', subcategory: 'reporting', rule_code: 'DISCRETION_REPORT_TO',
    label: 'Report discretion use to authority within', value: '28', value_type: 'integer', unit: 'days',
    source: 'government', legal_reference: 'ORO.FTL.205(f)', sort_order: 3 },
]

// ─── FDP Table — Table 2 (Acclimatized) ─────────────────────────────────────
// EASA ORO.FTL Table 2: 13 start-time rows × 9 sector columns.
// Generated programmatically: base FDP per row, −30 min per sector step, floor 9:00.
// Values are PLACEHOLDER — verify against ORO.FTL.205 Table 2 / CS FTL.1 before production.

const EASA_ROW_KEYS   = ['0600-0614','0615-0629','0630-0644','0645-0659','0700-0714','0715-0729','0730-1329','1330-1359','1400-1429','1430-1459','1500-1729','1730-2159','2200-0559'] as const
const EASA_ROW_LABELS = EASA_ROW_KEYS.map(k => k.replace('-', '–'))
const EASA_COL_KEYS   = ['1-2', '3', '4', '5', '6', '7', '8', '9', '10+'] as const
const EASA_COL_LABELS = ['1–2', '3', '4', '5', '6', '7', '8', '9', '10+']

// Base FDP (minutes) for "1-2 sectors" column per row
const EASA_BASE_FDP: Record<string, number> = {
  '0600-0614': 780,  // 13:00
  '0615-0629': 765,  // 12:45
  '0630-0644': 750,  // 12:30
  '0645-0659': 735,  // 12:15
  '0700-0714': 780,  // 13:00
  '0715-0729': 795,  // 13:15
  '0730-1329': 780,  // 13:00 (peak window)
  '1330-1359': 765,  // 12:45
  '1400-1429': 750,  // 12:30
  '1430-1459': 735,  // 12:15
  '1500-1729': 720,  // 12:00
  '1730-2159': 690,  // 11:30
  '2200-0559': 660,  // 11:00
}

function fmt(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}`
}

function generateEASACells(): FDPTableTemplate['cells'] {
  const cells: FDPTableTemplate['cells'] = []
  for (const rowKey of EASA_ROW_KEYS) {
    const base = EASA_BASE_FDP[rowKey]
    for (let ci = 0; ci < EASA_COL_KEYS.length; ci++) {
      const minutes = Math.max(540, base - ci * 30)
      cells.push({ row: rowKey, col: EASA_COL_KEYS[ci], minutes, display: fmt(minutes), source: 'government' })
    }
  }
  return cells
}

export const EASA_TABLE_2: FDPTableTemplate = {
  table_code: 'EASA_TABLE_2',
  label: 'Table 2 — Maximum FDP (Acclimatized Crew)',
  legal_reference: 'ORO.FTL.205 Table 2',
  row_axis_label: 'FDP Start Time (Reference Time)',
  col_axis_label: 'Number of Sectors',
  row_keys:   [...EASA_ROW_KEYS],
  row_labels: EASA_ROW_LABELS,
  col_keys:   [...EASA_COL_KEYS],
  col_labels: EASA_COL_LABELS,
  applies_when: { augmented: false, acclimatized: true },
  cells: generateEASACells(),
}

// Array alias consumed by getTemplateForFramework()
export const EASA_FDP_TABLES: FDPTableTemplate[] = [EASA_TABLE_2]

// ─── Augmented Limits ───────────────────────────────────────────────────────
// EASA CS FTL.1.225 — Values in minutes — PLACEHOLDER.

export const EASA_AUGMENTED: AugmentedTemplate[] = [
  // 3-pilot crew
  { crew_count: 3, facility_class: 'CLASS_1', max_fdp_minutes: 1020, display_value: '17:00', source: 'government', legal_reference: 'CS FTL.1.205' },
  { crew_count: 3, facility_class: 'CLASS_2', max_fdp_minutes: 960,  display_value: '16:00', source: 'government', legal_reference: 'CS FTL.1.205' },
  { crew_count: 3, facility_class: 'CLASS_3', max_fdp_minutes: 900,  display_value: '15:00', source: 'government', legal_reference: 'CS FTL.1.205' },
  // 4-pilot crew
  { crew_count: 4, facility_class: 'CLASS_1', max_fdp_minutes: 1140, display_value: '19:00', source: 'government', legal_reference: 'CS FTL.1.205' },
  { crew_count: 4, facility_class: 'CLASS_2', max_fdp_minutes: 1080, display_value: '18:00', source: 'government', legal_reference: 'CS FTL.1.205' },
  { crew_count: 4, facility_class: 'CLASS_3', max_fdp_minutes: 1050, display_value: '17:30', source: 'government', legal_reference: 'CS FTL.1.205' },
]
