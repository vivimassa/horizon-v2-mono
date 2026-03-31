// ─── FDTL Template Types ────────────────────────────────────────────────────

export interface RuleTemplate {
  category: string
  subcategory: string
  rule_code: string
  label: string
  value: string
  value_type: 'duration' | 'integer' | 'decimal' | 'boolean' | 'text'
  unit: string
  source: 'government' | 'company'
  legal_reference?: string
  sort_order: number
  directionality?: 'MAX_LIMIT' | 'MIN_LIMIT' | 'BOOLEAN' | 'ENUM' | 'FORMULA'
  crew_type?: 'all' | 'cockpit' | 'cabin'
  is_active?: boolean
}

export type RuleOverride = { rule_code: string } & Partial<Omit<RuleTemplate, 'rule_code'>>

export interface FDPTableTemplate {
  table_code: string
  tab_key?: string
  label: string
  legal_reference?: string
  row_axis_label: string
  col_axis_label: string
  row_keys: string[]
  row_labels: string[]
  col_keys: string[]
  col_labels: string[]
  applies_when?: Record<string, unknown>
  cells: { row: string; col: string; minutes: number | null; display: string; source: string }[]
}

export interface AugmentedTemplate {
  crew_count: number
  facility_class: string
  max_fdp_minutes: number
  display_value: string
  min_inflight_rest_minutes?: number
  source: string
  legal_reference?: string
}

// ─── ICAO Baseline Rules ────────────────────────────────────────────────────
// Values are PLACEHOLDER — will be verified against regulations before production.

export const ICAO_RULES: RuleTemplate[] = [

  // ── REST ───────────────────────────────────────────────────────────────────
  { category: 'rest', subcategory: 'minimum_rest', rule_code: 'MIN_REST_PRE_FDP',    label: 'Minimum rest before FDP',              value: '12:00', value_type: 'duration', unit: 'hrs',   source: 'government', sort_order: 1  },
  { category: 'rest', subcategory: 'minimum_rest', rule_code: 'MIN_REST_EXTENDED',   label: 'Extended rest after long FDP',         value: '14:00', value_type: 'duration', unit: 'hrs',   source: 'government', sort_order: 2  },
  { category: 'rest', subcategory: 'minimum_rest', rule_code: 'REDUCED_REST_MIN',    label: 'Reduced rest minimum',                 value: '10:00', value_type: 'duration', unit: 'hrs',   source: 'government', sort_order: 3  },
  { category: 'rest', subcategory: 'minimum_rest', rule_code: 'REDUCED_REST_MAX_7D', label: 'Max reduced rest per 7 days',          value: '2',     value_type: 'integer',  unit: 'times', source: 'government', sort_order: 4  },
  { category: 'rest', subcategory: 'minimum_rest', rule_code: 'RECOVERY_REST',       label: 'Recovery rest after reduced rest',     value: '14:00', value_type: 'duration', unit: 'hrs',   source: 'government', sort_order: 5  },

  { category: 'rest', subcategory: 'split_duty',   rule_code: 'SPLIT_MIN_BREAK',     label: 'Min break for split duty',             value: '3:00',  value_type: 'duration', unit: 'hrs',   source: 'government', sort_order: 10 },
  { category: 'rest', subcategory: 'split_duty',   rule_code: 'SPLIT_FACILITY_REQ',  label: 'Rest facility required for split',     value: 'true',  value_type: 'boolean',  unit: '',      source: 'government', sort_order: 11 },
  { category: 'rest', subcategory: 'split_duty',   rule_code: 'SPLIT_FDP_CREDIT',    label: 'FDP extension credit (% of break)',    value: '50',    value_type: 'integer',  unit: '%',     source: 'government', sort_order: 12 },

  { category: 'rest', subcategory: 'weekly_time_free', rule_code: 'WEEKLY_TIME_FREE', label: 'Minimum time free per 168 hours',    value: '36:00', value_type: 'duration', unit: 'hrs',   source: 'government', sort_order: 15 },

  // ── CUMULATIVE ─────────────────────────────────────────────────────────────
  { category: 'cumulative', subcategory: 'block_hours', rule_code: 'MAX_BH_28D',     label: 'Max block hours in 28 days',           value: '100:00', value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 1  },
  { category: 'cumulative', subcategory: 'block_hours', rule_code: 'MAX_BH_365D',    label: 'Max block hours in 365 days',          value: '900:00', value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 2  },
  { category: 'cumulative', subcategory: 'duty_hours',  rule_code: 'MAX_DH_7D',      label: 'Max duty hours in 7 days',             value: '60:00',  value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 5  },
  { category: 'cumulative', subcategory: 'duty_hours',  rule_code: 'MAX_DH_28D',     label: 'Max duty hours in 28 days',            value: '190:00', value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 6  },

  // ── DUTY ───────────────────────────────────────────────────────────────────
  { category: 'duty', subcategory: 'days_off',    rule_code: 'MIN_OFF_7D',            label: 'Min days off per 7 days',              value: '1',     value_type: 'integer',  unit: 'day',  source: 'government', sort_order: 1  },
  { category: 'duty', subcategory: 'days_off',    rule_code: 'MIN_OFF_28D',           label: 'Min days off per 28 days',             value: '8',     value_type: 'integer',  unit: 'days', source: 'government', sort_order: 2  },
  { category: 'duty', subcategory: 'days_off',    rule_code: 'SINGLE_OFF_DURATION',   label: 'Min single day off duration',          value: '36:00', value_type: 'duration', unit: 'hrs',  source: 'government', sort_order: 3  },
  { category: 'duty', subcategory: 'positioning', rule_code: 'POS_COUNTS_AS_DUTY',   label: 'Positioning counts as duty',           value: 'true',  value_type: 'boolean',  unit: '',     source: 'government', sort_order: 10 },
  { category: 'duty', subcategory: 'positioning', rule_code: 'MAX_CONSEC_DUTY',      label: 'Max consecutive duty days',            value: '7',     value_type: 'integer',  unit: 'days', source: 'government', sort_order: 11 },

  // ── CABIN CREW IN-FLIGHT REST ─────────────────────────────────────────────
  // Cruise time deductions: available rest time = block − taxi out − taxi in − climb − descent
  { category: 'cabin_crew', subcategory: 'inflight_rest', rule_code: 'REST_TAXI_OUT_DEDUCTION', label: 'Taxi-out deduction for cruise time',   value: '0:10', value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 101 },
  { category: 'cabin_crew', subcategory: 'inflight_rest', rule_code: 'REST_TAXI_IN_DEDUCTION',  label: 'Taxi-in deduction for cruise time',    value: '0:10', value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 102 },
  { category: 'cabin_crew', subcategory: 'inflight_rest', rule_code: 'REST_CLIMB_DEDUCTION',    label: 'Climb phase deduction for cruise time',value: '0:30', value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 103 },
  { category: 'cabin_crew', subcategory: 'inflight_rest', rule_code: 'REST_DESCENT_DEDUCTION',  label: 'Descent phase deduction for cruise time',value:'0:30', value_type: 'duration', unit: 'hrs', source: 'government', sort_order: 104 },

  // ── QUALIFICATION ──────────────────────────────────────────────────────────
  { category: 'qualification', subcategory: 'recency',  rule_code: 'RECENCY_LANDINGS',    label: 'Min landings for recency',           value: '3',   value_type: 'integer', unit: 'landings', source: 'government', sort_order: 1  },
  { category: 'qualification', subcategory: 'recency',  rule_code: 'RECENCY_PERIOD',      label: 'Recency period',                     value: '90',  value_type: 'integer', unit: 'days',     source: 'government', sort_order: 2  },
  { category: 'qualification', subcategory: 'recency',  rule_code: 'NIGHT_RECENCY_LDGS',  label: 'Night recency landings',             value: '1',   value_type: 'integer', unit: 'landing',  source: 'government', sort_order: 3  },
  { category: 'qualification', subcategory: 'pairing',  rule_code: 'NEW_CP_FO_RESTRICT',  label: 'Restrict new CP + new FO',           value: 'true', value_type: 'boolean', unit: '',        source: 'company',    sort_order: 10 },
  { category: 'qualification', subcategory: 'pairing',  rule_code: 'NEW_CREW_THRESHOLD',  label: 'New crew block hour threshold',      value: '500', value_type: 'integer', unit: 'BH',       source: 'company',    sort_order: 11 },
]

// ─── ICAO Baseline FDP Table ────────────────────────────────────────────────
// Values are PLACEHOLDER — verify against ICAO Annex 6 before production.

export const ICAO_FDP_TABLE: FDPTableTemplate = {
  table_code: 'ICAO_FDP',
  label: 'Maximum Flight Duty Period',
  row_axis_label: 'Duty Start Time (Local)',
  col_axis_label: 'Number of Sectors',
  row_keys:   ['0600-0729', '0730-1259', '1300-1759', '1800-2159', '2200-0559'],
  row_labels: ['0600–0729', '0730–1259', '1300–1759', '1800–2159', '2200–0559'],
  col_keys:   ['1', '2', '3', '4', '5+'],
  col_labels: ['1', '2', '3', '4', '5+'],
  applies_when: { augmented: false },
  cells: [
    // 0600-0729
    { row: '0600-0729', col: '1',  minutes: 780, display: '13:00', source: 'government' },
    { row: '0600-0729', col: '2',  minutes: 750, display: '12:30', source: 'government' },
    { row: '0600-0729', col: '3',  minutes: 720, display: '12:00', source: 'government' },
    { row: '0600-0729', col: '4',  minutes: 690, display: '11:30', source: 'government' },
    { row: '0600-0729', col: '5+', minutes: 660, display: '11:00', source: 'government' },
    // 0730-1259
    { row: '0730-1259', col: '1',  minutes: 840, display: '14:00', source: 'government' },
    { row: '0730-1259', col: '2',  minutes: 810, display: '13:30', source: 'government' },
    { row: '0730-1259', col: '3',  minutes: 780, display: '13:00', source: 'government' },
    { row: '0730-1259', col: '4',  minutes: 750, display: '12:30', source: 'government' },
    { row: '0730-1259', col: '5+', minutes: 720, display: '12:00', source: 'government' },
    // 1300-1759
    { row: '1300-1759', col: '1',  minutes: 780, display: '13:00', source: 'government' },
    { row: '1300-1759', col: '2',  minutes: 750, display: '12:30', source: 'government' },
    { row: '1300-1759', col: '3',  minutes: 720, display: '12:00', source: 'government' },
    { row: '1300-1759', col: '4',  minutes: 690, display: '11:30', source: 'government' },
    { row: '1300-1759', col: '5+', minutes: 660, display: '11:00', source: 'government' },
    // 1800-2159
    { row: '1800-2159', col: '1',  minutes: 720, display: '12:00', source: 'government' },
    { row: '1800-2159', col: '2',  minutes: 690, display: '11:30', source: 'government' },
    { row: '1800-2159', col: '3',  minutes: 660, display: '11:00', source: 'government' },
    { row: '1800-2159', col: '4',  minutes: 630, display: '10:30', source: 'government' },
    { row: '1800-2159', col: '5+', minutes: 600, display: '10:00', source: 'government' },
    // 2200-0559
    { row: '2200-0559', col: '1',  minutes: 660, display: '11:00', source: 'government' },
    { row: '2200-0559', col: '2',  minutes: 630, display: '10:30', source: 'government' },
    { row: '2200-0559', col: '3',  minutes: 600, display: '10:00', source: 'government' },
    { row: '2200-0559', col: '4',  minutes: 570, display: '09:30', source: 'government' },
    { row: '2200-0559', col: '5+', minutes: 540, display: '09:00', source: 'government' },
  ],
}

export const ICAO_FDP_TABLES: FDPTableTemplate[] = [ICAO_FDP_TABLE]

// ICAO has no augmented limits table (defined per-framework)
export const ICAO_AUGMENTED: AugmentedTemplate[] = []
