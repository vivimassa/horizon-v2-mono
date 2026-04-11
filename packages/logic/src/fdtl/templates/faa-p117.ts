// FAA Part 117 — Flight & Duty Time Limitations
// Overrides ICAO baseline and adds FAA-specific rules.
// Numeric values are PLACEHOLDER — verify against 14 CFR Part 117 before production.

import type { RuleOverride, RuleTemplate, FDPTableTemplate, AugmentedTemplate } from './icao.js'

// ─── Rule Overrides ─────────────────────────────────────────────────────────

export const FAA_P117_OVERRIDES: Array<RuleOverride | RuleTemplate> = [
  // REST — FAA uses 10h rest with 8h sleep opportunity
  { rule_code: 'MIN_REST_PRE_FDP', value: '10:00', legal_reference: '14 CFR 117.25(b)' },
  { rule_code: 'WEEKLY_TIME_FREE', value: '30:00', legal_reference: '14 CFR 117.25(a)' },

  {
    category: 'rest',
    subcategory: 'minimum_rest',
    rule_code: 'REST_SLEEP_OPP',
    label: 'Sleep opportunity within rest',
    value: '8:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: '14 CFR 117.25(b)',
    sort_order: 6,
  },

  // CUMULATIVE
  { rule_code: 'MAX_BH_28D', value: '100:00', legal_reference: '14 CFR 117.23(a)' },
  { rule_code: 'MAX_BH_365D', value: '1000:00', legal_reference: '14 CFR 117.23(a)' },

  {
    category: 'cumulative',
    subcategory: 'fdp_hours',
    rule_code: 'MAX_FDP_168H',
    label: 'Max FDP hours in 168 hours',
    value: '60:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: '14 CFR 117.23(b)',
    sort_order: 7,
  },
  {
    category: 'cumulative',
    subcategory: 'fdp_hours',
    rule_code: 'MAX_FDP_672H',
    label: 'Max FDP hours in 672 hours',
    value: '190:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: '14 CFR 117.23(b)',
    sort_order: 8,
  },

  // EXTENSION
  {
    category: 'extension',
    subcategory: 'discretion',
    rule_code: 'UNFORESEEN_EXT_MAX',
    label: 'Max unforeseen extension',
    value: '2:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: '14 CFR 117.19',
    sort_order: 1,
  },
  {
    category: 'extension',
    subcategory: 'reporting',
    rule_code: 'EXT_REPORT_THRESHOLD',
    label: 'Report exceedance >30 min within',
    value: '10',
    value_type: 'integer',
    unit: 'days',
    source: 'government',
    legal_reference: '14 CFR 117.19(b)',
    sort_order: 2,
  },

  // STANDBY
  {
    category: 'standby',
    subcategory: 'reserve',
    rule_code: 'SHORT_CALL_RESERVE_MAX',
    label: 'Short-call reserve max availability',
    value: '14:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: '14 CFR 117.21',
    sort_order: 1,
  },
  {
    category: 'standby',
    subcategory: 'reserve',
    rule_code: 'AIRPORT_STANDBY_IN_FDP',
    label: 'Airport standby counts in FDP',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: '14 CFR 117.21',
    sort_order: 2,
  },

  // FITNESS
  {
    category: 'fitness',
    subcategory: 'declaration',
    rule_code: 'FFD_DECLARATION_REQ',
    label: 'Fitness for duty self-declaration',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: '14 CFR 117.5',
    sort_order: 1,
  },
  {
    category: 'fitness',
    subcategory: 'declaration',
    rule_code: 'FFD_FATIGUE_CALL',
    label: 'Fatigue call permitted without penalty',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: '14 CFR 117.5',
    sort_order: 2,
  },
  {
    category: 'fitness',
    subcategory: 'tracking',
    rule_code: 'FFD_TRACKING_REQ',
    label: 'Operator must track fatigue reports',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: '14 CFR 117.9',
    sort_order: 3,
  },
]

// ─── FDP Table — Table B (Unaugmented) ──────────────────────────────────────
// FAA Part 117 Table B: 8 start-time rows × 7 flight-segment columns.
// Values in minutes — PLACEHOLDER; verify against 14 CFR Part 117 Appendix before production.

export const FAA_TABLE_B: FDPTableTemplate = {
  table_code: 'FAA_TABLE_B',
  label: 'Table B — Maximum Flight Duty Period (Unaugmented)',
  legal_reference: '14 CFR Part 117 Table B',
  row_axis_label: 'FDP Start Time (Acclimated)',
  col_axis_label: 'Flight Segments',
  row_keys: ['0000-0359', '0400-0459', '0500-0559', '0600-0659', '0700-1159', '1200-1259', '1300-1659', '1700-2359'],
  row_labels: ['0000–0359', '0400–0459', '0500–0559', '0600–0659', '0700–1159', '1200–1259', '1300–1659', '1700–2359'],
  col_keys: ['1', '2', '3', '4', '5', '6', '7+'],
  col_labels: ['1', '2', '3', '4', '5', '6', '7+'],
  applies_when: { augmented: false },
  cells: [
    // 0000-0359
    { row: '0000-0359', col: '1', minutes: 540, display: '9:00', source: 'government' },
    { row: '0000-0359', col: '2', minutes: 540, display: '9:00', source: 'government' },
    { row: '0000-0359', col: '3', minutes: 540, display: '9:00', source: 'government' },
    { row: '0000-0359', col: '4', minutes: 540, display: '9:00', source: 'government' },
    { row: '0000-0359', col: '5', minutes: 540, display: '9:00', source: 'government' },
    { row: '0000-0359', col: '6', minutes: 540, display: '9:00', source: 'government' },
    { row: '0000-0359', col: '7+', minutes: 540, display: '9:00', source: 'government' },
    // 0400-0459
    { row: '0400-0459', col: '1', minutes: 600, display: '10:00', source: 'government' },
    { row: '0400-0459', col: '2', minutes: 600, display: '10:00', source: 'government' },
    { row: '0400-0459', col: '3', minutes: 600, display: '10:00', source: 'government' },
    { row: '0400-0459', col: '4', minutes: 600, display: '10:00', source: 'government' },
    { row: '0400-0459', col: '5', minutes: 540, display: '9:00', source: 'government' },
    { row: '0400-0459', col: '6', minutes: 540, display: '9:00', source: 'government' },
    { row: '0400-0459', col: '7+', minutes: 540, display: '9:00', source: 'government' },
    // 0500-0559
    { row: '0500-0559', col: '1', minutes: 720, display: '12:00', source: 'government' },
    { row: '0500-0559', col: '2', minutes: 720, display: '12:00', source: 'government' },
    { row: '0500-0559', col: '3', minutes: 720, display: '12:00', source: 'government' },
    { row: '0500-0559', col: '4', minutes: 720, display: '12:00', source: 'government' },
    { row: '0500-0559', col: '5', minutes: 690, display: '11:30', source: 'government' },
    { row: '0500-0559', col: '6', minutes: 660, display: '11:00', source: 'government' },
    { row: '0500-0559', col: '7+', minutes: 630, display: '10:30', source: 'government' },
    // 0600-0659
    { row: '0600-0659', col: '1', minutes: 780, display: '13:00', source: 'government' },
    { row: '0600-0659', col: '2', minutes: 780, display: '13:00', source: 'government' },
    { row: '0600-0659', col: '3', minutes: 720, display: '12:00', source: 'government' },
    { row: '0600-0659', col: '4', minutes: 720, display: '12:00', source: 'government' },
    { row: '0600-0659', col: '5', minutes: 690, display: '11:30', source: 'government' },
    { row: '0600-0659', col: '6', minutes: 660, display: '11:00', source: 'government' },
    { row: '0600-0659', col: '7+', minutes: 630, display: '10:30', source: 'government' },
    // 0700-1159
    { row: '0700-1159', col: '1', minutes: 840, display: '14:00', source: 'government' },
    { row: '0700-1159', col: '2', minutes: 840, display: '14:00', source: 'government' },
    { row: '0700-1159', col: '3', minutes: 780, display: '13:00', source: 'government' },
    { row: '0700-1159', col: '4', minutes: 780, display: '13:00', source: 'government' },
    { row: '0700-1159', col: '5', minutes: 750, display: '12:30', source: 'government' },
    { row: '0700-1159', col: '6', minutes: 720, display: '12:00', source: 'government' },
    { row: '0700-1159', col: '7+', minutes: 690, display: '11:30', source: 'government' },
    // 1200-1259
    { row: '1200-1259', col: '1', minutes: 840, display: '14:00', source: 'government' },
    { row: '1200-1259', col: '2', minutes: 840, display: '14:00', source: 'government' },
    { row: '1200-1259', col: '3', minutes: 780, display: '13:00', source: 'government' },
    { row: '1200-1259', col: '4', minutes: 780, display: '13:00', source: 'government' },
    { row: '1200-1259', col: '5', minutes: 750, display: '12:30', source: 'government' },
    { row: '1200-1259', col: '6', minutes: 720, display: '12:00', source: 'government' },
    { row: '1200-1259', col: '7+', minutes: 690, display: '11:30', source: 'government' },
    // 1300-1659
    { row: '1300-1659', col: '1', minutes: 840, display: '14:00', source: 'government' },
    { row: '1300-1659', col: '2', minutes: 840, display: '14:00', source: 'government' },
    { row: '1300-1659', col: '3', minutes: 780, display: '13:00', source: 'government' },
    { row: '1300-1659', col: '4', minutes: 780, display: '13:00', source: 'government' },
    { row: '1300-1659', col: '5', minutes: 750, display: '12:30', source: 'government' },
    { row: '1300-1659', col: '6', minutes: 720, display: '12:00', source: 'government' },
    { row: '1300-1659', col: '7+', minutes: 690, display: '11:30', source: 'government' },
    // 1700-2359
    { row: '1700-2359', col: '1', minutes: 840, display: '14:00', source: 'government' },
    { row: '1700-2359', col: '2', minutes: 840, display: '14:00', source: 'government' },
    { row: '1700-2359', col: '3', minutes: 780, display: '13:00', source: 'government' },
    { row: '1700-2359', col: '4', minutes: 780, display: '13:00', source: 'government' },
    { row: '1700-2359', col: '5', minutes: 750, display: '12:30', source: 'government' },
    { row: '1700-2359', col: '6', minutes: 720, display: '12:00', source: 'government' },
    { row: '1700-2359', col: '7+', minutes: 690, display: '11:30', source: 'government' },
  ],
}

// Array alias consumed by getTemplateForFramework()
export const FAA_P117_FDP_TABLES: FDPTableTemplate[] = [FAA_TABLE_B]

// ─── Augmented Limits — Table C ──────────────────────────────────────────────
// FAA Part 117 Table C: augmented operations (3- and 4-pilot crew).
// Values in minutes — PLACEHOLDER; verify against 14 CFR Part 117 Table C before production.

export const FAA_AUGMENTED: AugmentedTemplate[] = [
  // 3-pilot crew
  {
    crew_count: 3,
    facility_class: 'CLASS_1',
    max_fdp_minutes: 1020,
    display_value: '17:00',
    source: 'government',
    legal_reference: '14 CFR Part 117 Table C',
  },
  {
    crew_count: 3,
    facility_class: 'CLASS_2',
    max_fdp_minutes: 960,
    display_value: '16:00',
    source: 'government',
    legal_reference: '14 CFR Part 117 Table C',
  },
  {
    crew_count: 3,
    facility_class: 'CLASS_3',
    max_fdp_minutes: 900,
    display_value: '15:00',
    source: 'government',
    legal_reference: '14 CFR Part 117 Table C',
  },
  // 4-pilot crew
  {
    crew_count: 4,
    facility_class: 'CLASS_1',
    max_fdp_minutes: 1140,
    display_value: '19:00',
    source: 'government',
    legal_reference: '14 CFR Part 117 Table C',
  },
  {
    crew_count: 4,
    facility_class: 'CLASS_2',
    max_fdp_minutes: 1080,
    display_value: '18:00',
    source: 'government',
    legal_reference: '14 CFR Part 117 Table C',
  },
  {
    crew_count: 4,
    facility_class: 'CLASS_3',
    max_fdp_minutes: 1050,
    display_value: '17:30',
    source: 'government',
    legal_reference: '14 CFR Part 117 Table C',
  },
]

// Array alias consumed by getTemplateForFramework()
export const FAA_P117_AUGMENTED: AugmentedTemplate[] = FAA_AUGMENTED
