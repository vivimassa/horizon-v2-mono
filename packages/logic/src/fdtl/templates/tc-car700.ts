// Transport Canada CAR 700 — Flight & Duty Time Limitations
// Overrides ICAO baseline with Canada-specific values.
// Numeric values are PLACEHOLDER — verify against CAR 700 before production.

import type { RuleOverride, RuleTemplate, FDPTableTemplate, AugmentedTemplate } from './icao'

// ─── Rule Overrides ─────────────────────────────────────────────────────────

export const TC_CAR700_OVERRIDES: Array<RuleOverride | RuleTemplate> = [
  // REST — TC CAR 700 requirements
  { rule_code: 'MIN_REST_PRE_FDP', value: '10:00', legal_reference: 'CAR 700.29' },
  { rule_code: 'MIN_REST_EXTENDED', value: '11:00', legal_reference: 'CAR 700.29' },
  { rule_code: 'REDUCED_REST_MIN', value: '8:00', legal_reference: 'CAR 700.29' },
  { rule_code: 'REDUCED_REST_MAX_7D', value: '1', legal_reference: 'CAR 700.29' },
  { rule_code: 'RECOVERY_REST', value: '10:00', legal_reference: 'CAR 700.29' },
  { rule_code: 'WEEKLY_TIME_FREE', value: '36:00', legal_reference: 'CAR 700.15' },

  // CUMULATIVE — TC limits
  { rule_code: 'MAX_BH_28D', value: '120:00', legal_reference: 'CAR 700.21' },
  { rule_code: 'MAX_BH_365D', value: '1200:00', legal_reference: 'CAR 700.21' },
  { rule_code: 'MAX_DH_7D', value: '60:00', legal_reference: 'CAR 700.21' },
  { rule_code: 'MAX_DH_28D', value: '210:00', legal_reference: 'CAR 700.21' },

  // DUTY
  { rule_code: 'MAX_CONSEC_DUTY', value: '7', legal_reference: 'CAR 700.19' },

  // EXTENSION
  {
    category: 'extension',
    subcategory: 'discretion',
    rule_code: 'UNFORESEEN_EXT_MAX',
    label: 'Max unforeseen extension (PIC discretion)',
    value: '1:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'CAR 700.28',
    sort_order: 1,
  },

  // STANDBY
  {
    category: 'standby',
    subcategory: 'reserve',
    rule_code: 'AIRPORT_STANDBY_IN_FDP',
    label: 'Airport standby counts in FDP',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'CAR 700.25',
    sort_order: 1,
  },
  {
    category: 'standby',
    subcategory: 'reserve',
    rule_code: 'CALL_OUT_STANDBY_MAX',
    label: 'Call-out standby availability window',
    value: '10:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'CAR 700.25',
    sort_order: 2,
  },

  // FITNESS
  {
    category: 'fitness',
    subcategory: 'declaration',
    rule_code: 'FFD_DECLARATION_REQ',
    label: 'Fitness for duty self-declaration required',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'CAR 700.13',
    sort_order: 1,
  },
]

// TC CAR 700 does not define a tabular FDP lookup — limits are expressed as formulas.
export const TC_CAR700_FDP_TABLES: FDPTableTemplate[] = []

// ─── Augmented Limits ───────────────────────────────────────────────────────
// Values in minutes — PLACEHOLDER.

export const TC_CAR700_AUGMENTED: AugmentedTemplate[] = [
  {
    crew_count: 3,
    facility_class: 'CLASS_1',
    max_fdp_minutes: 900,
    display_value: '15:00',
    min_inflight_rest_minutes: 240,
    source: 'government',
    legal_reference: 'CAR 700.27',
  },
  {
    crew_count: 3,
    facility_class: 'CLASS_2',
    max_fdp_minutes: 810,
    display_value: '13:30',
    min_inflight_rest_minutes: 180,
    source: 'government',
    legal_reference: 'CAR 700.27',
  },
  {
    crew_count: 4,
    facility_class: 'CLASS_1',
    max_fdp_minutes: 1020,
    display_value: '17:00',
    min_inflight_rest_minutes: 360,
    source: 'government',
    legal_reference: 'CAR 700.27',
  },
  {
    crew_count: 4,
    facility_class: 'CLASS_2',
    max_fdp_minutes: 900,
    display_value: '15:00',
    min_inflight_rest_minutes: 270,
    source: 'government',
    legal_reference: 'CAR 700.27',
  },
]
