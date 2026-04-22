// CAAV VAR Part 15 — Fatigue Management
// Vietnam Aviation Regulations Part 15, revised per Circular 03/2016/TT-BGTVT
// and Circular 21/2017/TT-BGTVT. EASA-derived with Vietnam-specific values.

import type { RuleTemplate, FDPTableTemplate, AugmentedTemplate } from './icao'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}`
}

// ─── Table 01: Max Daily FDP — Acclimatised Crew ─────────────────────────────
// §15.025(b)(1). 13 time-of-day rows × 9 sector columns.
// Pattern: base FDP per row, −30 min per sector step, floor 09:00 (540 min).

const CAAV_T01_ROW_KEYS = [
  '0600-1329',
  '1330-1359',
  '1400-1429',
  '1430-1459',
  '1500-1529',
  '1530-1559',
  '1600-1629',
  '1630-1659',
  '1700-0459',
  '0500-0514',
  '0515-0529',
  '0530-0544',
  '0545-0559',
] as const

// Base FDP in minutes for "1-2 sectors" column
const CAAV_T01_BASE: Record<string, number> = {
  '0600-1329': 780, // 13:00
  '1330-1359': 765, // 12:45
  '1400-1429': 750, // 12:30
  '1430-1459': 735, // 12:15
  '1500-1529': 720, // 12:00
  '1530-1559': 705, // 11:45
  '1600-1629': 690, // 11:30
  '1630-1659': 675, // 11:15
  '1700-0459': 660, // 11:00
  '0500-0514': 720, // 12:00
  '0515-0529': 735, // 12:15
  '0530-0544': 750, // 12:30
  '0545-0559': 765, // 12:45
}

const CAAV_T01_COL_KEYS = ['1-2', '3', '4', '5', '6', '7', '8', '9', '10'] as const

function generateTable01Cells(): FDPTableTemplate['cells'] {
  const cells: FDPTableTemplate['cells'] = []
  for (const rowKey of CAAV_T01_ROW_KEYS) {
    const base = CAAV_T01_BASE[rowKey]
    for (let ci = 0; ci < CAAV_T01_COL_KEYS.length; ci++) {
      const minutes = Math.max(540, base - ci * 30)
      cells.push({ row: rowKey, col: CAAV_T01_COL_KEYS[ci], minutes, display: fmt(minutes), source: 'government' })
    }
  }
  return cells
}

export const CAAV_TABLE_01: FDPTableTemplate = {
  table_code: 'CAAV_TABLE_01',
  tab_key: 'fdp',
  label: 'Table 01 — Max Daily FDP (Acclimatised Crew)',
  legal_reference: 'VAR 15 §15.025(b)(1)',
  row_axis_label: 'FDP Start Time (Local)',
  col_axis_label: 'Number of Sectors',
  row_keys: [...CAAV_T01_ROW_KEYS],
  row_labels: CAAV_T01_ROW_KEYS.map((k) => k.replace('-', '–')),
  col_keys: [...CAAV_T01_COL_KEYS],
  col_labels: [...CAAV_T01_COL_KEYS],
  applies_when: { augmented: false, acclimatized: true },
  cells: generateTable01Cells(),
}

// ─── Table 02: Max Daily FDP — Unacclimatised Crew (Without FRM) ──────────────
// §15.025(b)(2). Single row (no start-time variation), 7 sector columns.
// FDP is reduced vs Table 01; no WOCL/start-time benefit applies.

export const CAAV_TABLE_02: FDPTableTemplate = {
  table_code: 'CAAV_TABLE_02',
  tab_key: 'fdp_unacclim',
  label: 'Table 02 — Max Daily FDP (Unacclimatised, Without FRM)',
  legal_reference: 'VAR 15 §15.025(b)(2)',
  row_axis_label: 'Crew Status',
  col_axis_label: 'Number of Sectors',
  row_keys: ['unacclim'],
  row_labels: ['Unacclimatised'],
  col_keys: ['1', '2', '3', '4', '5', '6', '7+'],
  col_labels: ['1', '2', '3', '4', '5', '6', '7+'],
  applies_when: { acclimatized: false, frm: false },
  cells: [
    { row: 'unacclim', col: '1', minutes: 630, display: '10:30', source: 'government' },
    { row: 'unacclim', col: '2', minutes: 630, display: '10:30', source: 'government' },
    { row: 'unacclim', col: '3', minutes: 600, display: '10:00', source: 'government' },
    { row: 'unacclim', col: '4', minutes: 570, display: '9:30', source: 'government' },
    { row: 'unacclim', col: '5', minutes: 540, display: '9:00', source: 'government' },
    { row: 'unacclim', col: '6', minutes: 510, display: '8:30', source: 'government' },
    { row: 'unacclim', col: '7+', minutes: 480, display: '8:00', source: 'government' },
  ],
}

// ─── Table 03: Max Daily FDP — Unacclimatised Crew (With FRM) ────────────────
// §15.025(b)(3). Same structure as Table 02 but FRM approval unlocks ~1h extra.

export const CAAV_TABLE_03: FDPTableTemplate = {
  table_code: 'CAAV_TABLE_03',
  tab_key: 'fdp_unacclim',
  label: 'Table 03 — Max Daily FDP (Unacclimatised, With FRM)',
  legal_reference: 'VAR 15 §15.025(b)(3)',
  row_axis_label: 'Crew Status',
  col_axis_label: 'Number of Sectors',
  row_keys: ['unacclim_frm'],
  row_labels: ['Unacclimatised (FRM)'],
  col_keys: ['1', '2', '3', '4', '5', '6', '7+'],
  col_labels: ['1', '2', '3', '4', '5', '6', '7+'],
  applies_when: { acclimatized: false, frm: true },
  cells: [
    { row: 'unacclim_frm', col: '1', minutes: 690, display: '11:30', source: 'government' },
    { row: 'unacclim_frm', col: '2', minutes: 690, display: '11:30', source: 'government' },
    { row: 'unacclim_frm', col: '3', minutes: 660, display: '11:00', source: 'government' },
    { row: 'unacclim_frm', col: '4', minutes: 630, display: '10:30', source: 'government' },
    { row: 'unacclim_frm', col: '5', minutes: 600, display: '10:00', source: 'government' },
    { row: 'unacclim_frm', col: '6', minutes: 570, display: '9:30', source: 'government' },
    { row: 'unacclim_frm', col: '7+', minutes: 540, display: '9:00', source: 'government' },
  ],
}

// ─── Table 04: Maximum Daily FDP with Extension (without in-flight rest) ─────
// §15.025(d)(5). This is the planned extension table.
// Values = Table 01 + 1 hour, with restrictions by start time and sector count.
// -1 = "Not allowed" (DB column is NOT NULL; -1 is the sentinel for N/A).

const CAAV_T04_ROW_KEYS = [
  '0600-0614',
  '0615-0629',
  '0630-0644',
  '0645-0659',
  '0700-1329',
  '1330-1359',
  '1400-1429',
  '1430-1459',
  '1500-1529',
  '1530-1559',
  '1600-1629',
  '1630-1659',
  '1700-1729',
  '1730-1759',
  '1800-1829',
  '1830-1859',
  '1900-0559',
] as const

const CAAV_T04_COL_KEYS = ['1-2', '3', '4', '5'] as const

// Cell values in minutes. null = "Not allowed" (-1 stored in DB)
const CAAV_T04_CELLS: { row: string; col: string; minutes: number | null }[] = [
  // 06:00–06:14 — Not allowed for any sector count
  { row: '0600-0614', col: '1-2', minutes: null },
  { row: '0600-0614', col: '3', minutes: null },
  { row: '0600-0614', col: '4', minutes: null },
  { row: '0600-0614', col: '5', minutes: null },

  // 06:15–06:29
  { row: '0615-0629', col: '1-2', minutes: 795 },
  { row: '0615-0629', col: '3', minutes: 765 },
  { row: '0615-0629', col: '4', minutes: 735 },
  { row: '0615-0629', col: '5', minutes: 705 },
  // 06:30–06:44
  { row: '0630-0644', col: '1-2', minutes: 810 },
  { row: '0630-0644', col: '3', minutes: 780 },
  { row: '0630-0644', col: '4', minutes: 750 },
  { row: '0630-0644', col: '5', minutes: 720 },
  // 06:45–06:59
  { row: '0645-0659', col: '1-2', minutes: 825 },
  { row: '0645-0659', col: '3', minutes: 795 },
  { row: '0645-0659', col: '4', minutes: 765 },
  { row: '0645-0659', col: '5', minutes: 735 },

  // 07:00–13:29 — peak window
  { row: '0700-1329', col: '1-2', minutes: 840 },
  { row: '0700-1329', col: '3', minutes: 810 },
  { row: '0700-1329', col: '4', minutes: 780 },
  { row: '0700-1329', col: '5', minutes: 750 },

  // 13:30–13:59 — 5 sectors not allowed
  { row: '1330-1359', col: '1-2', minutes: 825 },
  { row: '1330-1359', col: '3', minutes: 795 },
  { row: '1330-1359', col: '4', minutes: 765 },
  { row: '1330-1359', col: '5', minutes: null },
  // 14:00–14:29
  { row: '1400-1429', col: '1-2', minutes: 810 },
  { row: '1400-1429', col: '3', minutes: 780 },
  { row: '1400-1429', col: '4', minutes: 750 },
  { row: '1400-1429', col: '5', minutes: null },
  // 14:30–14:59
  { row: '1430-1459', col: '1-2', minutes: 795 },
  { row: '1430-1459', col: '3', minutes: 765 },
  { row: '1430-1459', col: '4', minutes: 735 },
  { row: '1430-1459', col: '5', minutes: null },
  // 15:00–15:29
  { row: '1500-1529', col: '1-2', minutes: 780 },
  { row: '1500-1529', col: '3', minutes: 750 },
  { row: '1500-1529', col: '4', minutes: 720 },
  { row: '1500-1529', col: '5', minutes: null },

  // 15:30–18:59 — only 1-2 sectors allowed
  { row: '1530-1559', col: '1-2', minutes: 765 },
  { row: '1530-1559', col: '3', minutes: null },
  { row: '1530-1559', col: '4', minutes: null },
  { row: '1530-1559', col: '5', minutes: null },
  { row: '1600-1629', col: '1-2', minutes: 750 },
  { row: '1600-1629', col: '3', minutes: null },
  { row: '1600-1629', col: '4', minutes: null },
  { row: '1600-1629', col: '5', minutes: null },
  { row: '1630-1659', col: '1-2', minutes: 735 },
  { row: '1630-1659', col: '3', minutes: null },
  { row: '1630-1659', col: '4', minutes: null },
  { row: '1630-1659', col: '5', minutes: null },
  { row: '1700-1729', col: '1-2', minutes: 720 },
  { row: '1700-1729', col: '3', minutes: null },
  { row: '1700-1729', col: '4', minutes: null },
  { row: '1700-1729', col: '5', minutes: null },
  { row: '1730-1759', col: '1-2', minutes: 705 },
  { row: '1730-1759', col: '3', minutes: null },
  { row: '1730-1759', col: '4', minutes: null },
  { row: '1730-1759', col: '5', minutes: null },
  { row: '1800-1829', col: '1-2', minutes: 690 },
  { row: '1800-1829', col: '3', minutes: null },
  { row: '1800-1829', col: '4', minutes: null },
  { row: '1800-1829', col: '5', minutes: null },
  { row: '1830-1859', col: '1-2', minutes: 675 },
  { row: '1830-1859', col: '3', minutes: null },
  { row: '1830-1859', col: '4', minutes: null },
  { row: '1830-1859', col: '5', minutes: null },

  // 19:00–05:59 — Not allowed for any sector count
  { row: '1900-0559', col: '1-2', minutes: null },
  { row: '1900-0559', col: '3', minutes: null },
  { row: '1900-0559', col: '4', minutes: null },
  { row: '1900-0559', col: '5', minutes: null },
]

export const CAAV_TABLE_04: FDPTableTemplate = {
  table_code: 'CAAV_TABLE_04',
  tab_key: 'fdp_extended',
  label: 'Table 04 — Maximum Daily FDP with Extension',
  legal_reference: 'VAR 15 §15.025(d)(5)',
  row_axis_label: 'Starting Time of FDP (Local)',
  col_axis_label: 'Number of Sectors',
  row_keys: [...CAAV_T04_ROW_KEYS],
  row_labels: [
    '06:00 – 06:14',
    '06:15 – 06:29',
    '06:30 – 06:44',
    '06:45 – 06:59',
    '07:00 – 13:29',
    '13:30 – 13:59',
    '14:00 – 14:29',
    '14:30 – 14:59',
    '15:00 – 15:29',
    '15:30 – 15:59',
    '16:00 – 16:29',
    '16:30 – 16:59',
    '17:00 – 17:29',
    '17:30 – 17:59',
    '18:00 – 18:29',
    '18:30 – 18:59',
    '19:00 – 05:59',
  ],
  col_keys: [...CAAV_T04_COL_KEYS],
  col_labels: ['1 – 2 sectors', '3 sectors', '4 sectors', '5 sectors'],
  applies_when: { extension: true, augmented: false },
  cells: CAAV_T04_CELLS.map((c) => ({
    row: c.row,
    col: c.col,
    minutes: c.minutes ?? -1, // -1 = "Not allowed" sentinel (DB column is NOT NULL)
    display: c.minutes != null ? fmt(c.minutes) : 'N/A',
    source: 'government' as const,
  })),
}

// ─── Table 05: Minimum In-Flight Rest for Each Cabin Crew Member ─────────────
// §15.025(c)(5). Rows = Maximum Extended FDP bands, Cols = rest facility class.
// "Not allowed" entries enforce maximum extended FDP caps per facility class:
//   Class 3 (Reclining): max 16:00 extended FDP
//   Class 2 (Seat):      max 17:00 extended FDP
//   Class 1 (Bunk):      max 18:00 extended FDP

export const CAAV_TABLE_05: FDPTableTemplate = {
  table_code: 'CAAV_TABLE_05',
  tab_key: 'cabin_crew',
  label: 'Table 05 — Cabin Crew In-Flight Rest Minimums',
  legal_reference: 'VAR 15 §15.025(c)(5)',
  row_axis_label: 'Maximum Extended FDP',
  col_axis_label: 'Rest Facility Class',
  row_keys: [
    'fdp_lte_1430',
    'fdp_1431_1500',
    'fdp_1501_1530',
    'fdp_1531_1600',
    'fdp_1601_1630',
    'fdp_1631_1700',
    'fdp_1701_1730',
    'fdp_1731_1800',
  ],
  row_labels: [
    'Up to 14:30',
    '14:31 – 15:00',
    '15:01 – 15:30',
    '15:31 – 16:00',
    '16:01 – 16:30',
    '16:31 – 17:00',
    '17:01 – 17:30',
    '17:31 – 18:00',
  ],
  col_keys: ['CLASS_1', 'CLASS_2', 'CLASS_3'],
  col_labels: ['Class 1 (Bunk)', 'Class 2 (Seat)', 'Class 3 (Reclining)'],
  applies_when: { crew_type: 'cabin' },
  cells: [
    // Up to 14:30 — all classes same minimum
    { row: 'fdp_lte_1430', col: 'CLASS_1', minutes: 90, display: '1:30', source: 'government' },
    { row: 'fdp_lte_1430', col: 'CLASS_2', minutes: 90, display: '1:30', source: 'government' },
    { row: 'fdp_lte_1430', col: 'CLASS_3', minutes: 90, display: '1:30', source: 'government' },
    // 14:31 – 15:00
    { row: 'fdp_1431_1500', col: 'CLASS_1', minutes: 105, display: '1:45', source: 'government' },
    { row: 'fdp_1431_1500', col: 'CLASS_2', minutes: 120, display: '2:00', source: 'government' },
    { row: 'fdp_1431_1500', col: 'CLASS_3', minutes: 140, display: '2:20', source: 'government' },
    // 15:01 – 15:30
    { row: 'fdp_1501_1530', col: 'CLASS_1', minutes: 120, display: '2:00', source: 'government' },
    { row: 'fdp_1501_1530', col: 'CLASS_2', minutes: 140, display: '2:20', source: 'government' },
    { row: 'fdp_1501_1530', col: 'CLASS_3', minutes: 160, display: '2:40', source: 'government' },
    // 15:31 – 16:00
    { row: 'fdp_1531_1600', col: 'CLASS_1', minutes: 135, display: '2:15', source: 'government' },
    { row: 'fdp_1531_1600', col: 'CLASS_2', minutes: 160, display: '2:40', source: 'government' },
    { row: 'fdp_1531_1600', col: 'CLASS_3', minutes: 180, display: '3:00', source: 'government' },
    // 16:01 – 16:30 — Class 3 NOT ALLOWED (max extended FDP for Class 3)
    { row: 'fdp_1601_1630', col: 'CLASS_1', minutes: 155, display: '2:35', source: 'government' },
    { row: 'fdp_1601_1630', col: 'CLASS_2', minutes: 180, display: '3:00', source: 'government' },
    { row: 'fdp_1601_1630', col: 'CLASS_3', minutes: -1, display: 'N/A', source: 'government' },
    // 16:31 – 17:00 — Class 3 NOT ALLOWED
    { row: 'fdp_1631_1700', col: 'CLASS_1', minutes: 180, display: '3:00', source: 'government' },
    { row: 'fdp_1631_1700', col: 'CLASS_2', minutes: 205, display: '3:25', source: 'government' },
    { row: 'fdp_1631_1700', col: 'CLASS_3', minutes: -1, display: 'N/A', source: 'government' },
    // 17:01 – 17:30 — Class 2 & 3 NOT ALLOWED
    { row: 'fdp_1701_1730', col: 'CLASS_1', minutes: 205, display: '3:25', source: 'government' },
    { row: 'fdp_1701_1730', col: 'CLASS_2', minutes: -1, display: 'N/A', source: 'government' },
    { row: 'fdp_1701_1730', col: 'CLASS_3', minutes: -1, display: 'N/A', source: 'government' },
    // 17:31 – 18:00 — Class 2 & 3 NOT ALLOWED
    { row: 'fdp_1731_1800', col: 'CLASS_1', minutes: 230, display: '3:50', source: 'government' },
    { row: 'fdp_1731_1800', col: 'CLASS_2', minutes: -1, display: 'N/A', source: 'government' },
    { row: 'fdp_1731_1800', col: 'CLASS_3', minutes: -1, display: 'N/A', source: 'government' },
  ],
}

// ─── Table 06: Single-Pilot FDP Limits ───────────────────────────────────────
// §15.025(e). Rows = FDP start time bands, Cols = number of landings.

export const CAAV_TABLE_06: FDPTableTemplate = {
  table_code: 'CAAV_TABLE_06',
  tab_key: 'fdp_single_pilot',
  label: 'Table 06 — Single-Pilot Max FDP',
  legal_reference: 'VAR 15 §15.025(e)',
  row_axis_label: 'FDP Start Time (Local)',
  col_axis_label: 'Number of Landings',
  row_keys: ['0600-1359', '1400-1759', '1800-0559'],
  row_labels: ['06:00–13:59', '14:00–17:59', '18:00–05:59'],
  col_keys: ['1-4', '5', '6+'],
  col_labels: ['1–4', '5', '6+'],
  applies_when: { single_pilot: true },
  cells: [
    { row: '0600-1359', col: '1-4', minutes: 600, display: '10:00', source: 'government' },
    { row: '0600-1359', col: '5', minutes: 570, display: '9:30', source: 'government' },
    { row: '0600-1359', col: '6+', minutes: 540, display: '9:00', source: 'government' },
    { row: '1400-1759', col: '1-4', minutes: 570, display: '9:30', source: 'government' },
    { row: '1400-1759', col: '5', minutes: 540, display: '9:00', source: 'government' },
    { row: '1400-1759', col: '6+', minutes: 480, display: '8:00', source: 'government' },
    { row: '1800-0559', col: '1-4', minutes: 480, display: '8:00', source: 'government' },
    { row: '1800-0559', col: '5', minutes: 450, display: '7:30', source: 'government' },
    { row: '1800-0559', col: '6+', minutes: 420, display: '7:00', source: 'government' },
  ],
}

// ─── Table 07: Time Zone Acclimatisation Rest Requirement ────────────────────
// Appendix 1 to §15.037(b). Values = minimum local nights of rest required.
// Stored as integer night counts in value_minutes column.

export const CAAV_TABLE_07: FDPTableTemplate = {
  table_code: 'CAAV_TABLE_07',
  tab_key: 'disruptive',
  label: 'Table 07 — Time Zone Compensation Rest (Local Nights)',
  legal_reference: 'VAR 15 App.1 to §15.037(b)',
  row_axis_label: 'Direction of Travel',
  col_axis_label: 'Elapsed Acclimatisation Period (hours)',
  row_keys: ['eastward', 'westward', 'alternating'],
  row_labels: ['Eastward', 'Westward', 'E↔W Alternating'],
  col_keys: ['lt_48h', '48_71h', '72_95h', 'gte_96h'],
  col_labels: ['<48', '48–71', '72–95', '≥96'],
  applies_when: { time_zone_displacement: true },
  cells: [
    { row: 'eastward', col: 'lt_48h', minutes: 2, display: '2 nights', source: 'government' },
    { row: 'eastward', col: '48_71h', minutes: 2, display: '2 nights', source: 'government' },
    { row: 'eastward', col: '72_95h', minutes: 3, display: '3 nights', source: 'government' },
    { row: 'eastward', col: 'gte_96h', minutes: 4, display: '4 nights', source: 'government' },
    { row: 'westward', col: 'lt_48h', minutes: 2, display: '2 nights', source: 'government' },
    { row: 'westward', col: '48_71h', minutes: 2, display: '2 nights', source: 'government' },
    { row: 'westward', col: '72_95h', minutes: 3, display: '3 nights', source: 'government' },
    { row: 'westward', col: 'gte_96h', minutes: 3, display: '3 nights', source: 'government' },
    { row: 'alternating', col: 'lt_48h', minutes: 3, display: '3 nights', source: 'government' },
    { row: 'alternating', col: '48_71h', minutes: 3, display: '3 nights', source: 'government' },
    { row: 'alternating', col: '72_95h', minutes: 4, display: '4 nights', source: 'government' },
    { row: 'alternating', col: 'gte_96h', minutes: 4, display: '4 nights', source: 'government' },
  ],
}

// ─── Augmented Limits ─────────────────────────────────────────────────────────
// Appendix 1 to §15.025(c)(3). In-flight rest with +1 or +2 additional crew.

export const CAAV_AUGMENTED: AugmentedTemplate[] = [
  // +1 additional crew member (3-pilot)
  {
    crew_count: 3,
    facility_class: 'CLASS_3',
    max_fdp_minutes: 840,
    display_value: '14:00',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(c)(3)(i)(A)',
  },
  {
    crew_count: 3,
    facility_class: 'CLASS_2',
    max_fdp_minutes: 900,
    display_value: '15:00',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(c)(3)(i)(B)',
  },
  {
    crew_count: 3,
    facility_class: 'CLASS_1',
    max_fdp_minutes: 960,
    display_value: '16:00',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(c)(3)(i)(C)',
  },
  // +2 additional crew members (4-pilot)
  {
    crew_count: 4,
    facility_class: 'CLASS_3',
    max_fdp_minutes: 900,
    display_value: '15:00',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(c)(3)(ii)(A)',
  },
  {
    crew_count: 4,
    facility_class: 'CLASS_2',
    max_fdp_minutes: 960,
    display_value: '16:00',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(c)(3)(ii)(B)',
  },
  {
    crew_count: 4,
    facility_class: 'CLASS_1',
    max_fdp_minutes: 1020,
    display_value: '17:00',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(c)(3)(ii)(C)',
  },
]

// ─── Rule Parameters ─────────────────────────────────────────────────────────

export const CAAV_RULES: RuleTemplate[] = [
  // ═══════════════════════════════════════════════
  // CUMULATIVE LIMITS — §15.027
  // ═══════════════════════════════════════════════

  {
    category: 'cumulative',
    subcategory: 'duty_hours',
    rule_code: 'MAX_DUTY_7D',
    label: 'Max duty in 7 consecutive days',
    value: '60:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.027(a)(1)',
    directionality: 'MAX_LIMIT',
    sort_order: 1,
  },

  {
    category: 'cumulative',
    subcategory: 'duty_hours',
    rule_code: 'MAX_DUTY_14D',
    label: 'Max duty in 14 consecutive days',
    value: '110:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.027(a)(2)',
    directionality: 'MAX_LIMIT',
    sort_order: 2,
  },

  {
    category: 'cumulative',
    subcategory: 'duty_hours',
    rule_code: 'MAX_DUTY_28D',
    label: 'Max duty in 28 consecutive days',
    value: '190:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.027(a)(3)',
    directionality: 'MAX_LIMIT',
    sort_order: 3,
  },

  // ICAO-legacy block hour codes — not applicable under VAR Part 15
  // (CAAV uses MAX_FLIGHT_TIME_28D / MAX_FLIGHT_TIME_12M instead)
  {
    category: 'cumulative',
    subcategory: 'block_hours',
    rule_code: 'MAX_BH_28D',
    label: 'Max block hours in 28 days (N/A)',
    value: '0',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    sort_order: 99,
    is_active: false,
  },
  {
    category: 'cumulative',
    subcategory: 'block_hours',
    rule_code: 'MAX_BH_365D',
    label: 'Max block hours in 365 days (N/A)',
    value: '0',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    sort_order: 99,
    is_active: false,
  },

  // ICAO-legacy duty hour codes — not applicable under VAR Part 15
  // (CAAV uses MAX_DUTY_7D / MAX_DUTY_14D / MAX_DUTY_28D instead)
  {
    category: 'cumulative',
    subcategory: 'duty_hours',
    rule_code: 'MAX_DH_7D',
    label: 'Max duty hours in 7 days (N/A)',
    value: '0',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    sort_order: 99,
    is_active: false,
  },
  {
    category: 'cumulative',
    subcategory: 'duty_hours',
    rule_code: 'MAX_DH_28D',
    label: 'Max duty hours in 28 days (N/A)',
    value: '0',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    sort_order: 99,
    is_active: false,
  },

  {
    category: 'cumulative',
    subcategory: 'block_hours',
    rule_code: 'MAX_FLIGHT_TIME_28D',
    label: 'Max flight time in 28 consecutive days',
    value: '100:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.027(b)(1)',
    directionality: 'MAX_LIMIT',
    sort_order: 4,
  },

  {
    category: 'cumulative',
    subcategory: 'block_hours',
    rule_code: 'MAX_FLIGHT_TIME_12M',
    label: 'Max flight time in 12 calendar months',
    value: '1000:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.027(b)(2)',
    directionality: 'MAX_LIMIT',
    sort_order: 5,
  },

  // ═══════════════════════════════════════════════
  // REST — §15.037
  // ═══════════════════════════════════════════════

  {
    category: 'rest',
    subcategory: 'home_base',
    rule_code: 'MIN_REST_HOME_BASE',
    label: 'Min rest at home base',
    value: '12:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(a)(1)',
    directionality: 'MIN_LIMIT',
    sort_order: 10,
    computation_type: 'min_rest_between_events',
    params: { context: 'home', mustMatchPrecedingDuty: true },
  },

  {
    category: 'rest',
    subcategory: 'home_base',
    rule_code: 'MIN_REST_HOME_BASE_RULE',
    label: 'Rest at home base: at least the preceding duty period',
    value: 'max(preceding_duty, 12h)',
    value_type: 'text',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(a)(1)',
    sort_order: 11,
  },

  {
    category: 'rest',
    subcategory: 'away_base',
    rule_code: 'MIN_REST_AWAY',
    label: 'Min rest away from home base',
    value: '10:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(b)',
    directionality: 'MIN_LIMIT',
    sort_order: 12,
  },

  {
    category: 'rest',
    subcategory: 'away_base',
    rule_code: 'MIN_SLEEP_OPP_AWAY',
    label: 'Sleep opportunity within away rest',
    value: '08:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(b)',
    directionality: 'MIN_LIMIT',
    sort_order: 13,
  },

  {
    category: 'rest',
    subcategory: 'reduced_rest',
    rule_code: 'MIN_REDUCED_REST_HOME',
    label: 'Min reduced rest at home base',
    value: '12:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.037(c)(1)',
    directionality: 'MIN_LIMIT',
    sort_order: 14,
  },

  {
    category: 'rest',
    subcategory: 'reduced_rest',
    rule_code: 'MIN_REDUCED_REST_AWAY',
    label: 'Min reduced rest away from base',
    value: '10:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.037(c)(1)',
    directionality: 'MIN_LIMIT',
    sort_order: 15,
  },

  {
    category: 'rest',
    subcategory: 'reduced_rest',
    rule_code: 'MAX_REDUCED_REST_PER_CYCLE',
    label: 'Max reduced rest periods between extended recovery',
    value: '2',
    value_type: 'integer',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.037(c)(5)',
    directionality: 'MAX_LIMIT',
    sort_order: 16,
  },

  {
    category: 'rest',
    subcategory: 'extended_recovery',
    rule_code: 'MIN_EXTENDED_RECOVERY',
    label: 'Min extended recovery rest',
    value: '36:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(d)',
    directionality: 'MIN_LIMIT',
    sort_order: 17,
  },

  {
    category: 'rest',
    subcategory: 'extended_recovery',
    rule_code: 'EXTENDED_RECOVERY_NIGHTS',
    label: 'Local nights in extended recovery rest',
    value: '2',
    value_type: 'integer',
    unit: 'nights',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(d)',
    directionality: 'MIN_LIMIT',
    sort_order: 18,
  },

  {
    category: 'rest',
    subcategory: 'extended_recovery',
    rule_code: 'MAX_BETWEEN_EXTENDED_RECOVERY',
    label: 'Max hours between extended recovery rests',
    value: '168:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(d)',
    directionality: 'MAX_LIMIT',
    sort_order: 19,
  },

  {
    category: 'rest',
    subcategory: 'extended_recovery',
    rule_code: 'EXTENDED_RECOVERY_2DAYS_MONTHLY',
    label: 'Extended recovery increased to 2 local days, min twice per month',
    value: '2',
    value_type: 'integer',
    unit: 'per month',
    source: 'government',
    legal_reference: 'VAR 15 §15.037(d)',
    directionality: 'MIN_LIMIT',
    sort_order: 20,
  },

  {
    category: 'rest',
    subcategory: 'augmented_rest',
    rule_code: 'MIN_REST_AFTER_AUGMENTED',
    label: 'Min rest after augmented FDP',
    value: '14:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(c)(7)',
    directionality: 'MIN_LIMIT',
    sort_order: 21,
  },

  {
    category: 'rest',
    subcategory: 'home_base_change',
    rule_code: 'HOME_BASE_CHANGE_REST',
    label: 'Rest before starting duties at new home base',
    value: '72:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.023(b)',
    directionality: 'MIN_LIMIT',
    sort_order: 22,
  },

  {
    category: 'rest',
    subcategory: 'home_base_change',
    rule_code: 'HOME_BASE_CHANGE_NIGHTS',
    label: 'Local nights for home base change rest',
    value: '3',
    value_type: 'integer',
    unit: 'nights',
    source: 'government',
    legal_reference: 'VAR 15 §15.023(b)',
    directionality: 'MIN_LIMIT',
    sort_order: 23,
  },

  // ═══════════════════════════════════════════════
  // EXTENSION — §15.025(d)
  // ═══════════════════════════════════════════════

  {
    category: 'extension',
    subcategory: 'fdp_extension',
    rule_code: 'FDP_EXTENSION_MAX',
    label: 'Max FDP extension without in-flight rest',
    value: '01:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(d)(1)',
    directionality: 'MAX_LIMIT',
    sort_order: 30,
  },

  {
    category: 'extension',
    subcategory: 'fdp_extension',
    rule_code: 'FDP_EXTENSION_MAX_PER_7D',
    label: 'Max extensions in 7 consecutive days',
    value: '2',
    value_type: 'integer',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(d)(1)',
    directionality: 'MAX_LIMIT',
    sort_order: 31,
  },

  {
    category: 'extension',
    subcategory: 'fdp_extension',
    rule_code: 'FDP_EXT_MAX_SECTORS_NO_WOCL',
    label: 'Max sectors with extension — WOCL not encroached',
    value: '5',
    value_type: 'integer',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(d)(3)(i)',
    directionality: 'MAX_LIMIT',
    sort_order: 32,
  },

  {
    category: 'extension',
    subcategory: 'fdp_extension',
    rule_code: 'FDP_EXT_MAX_SECTORS_WOCL_LTE2',
    label: 'Max sectors with extension — WOCL encroached ≤2h',
    value: '4',
    value_type: 'integer',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(d)(3)(ii)',
    directionality: 'MAX_LIMIT',
    sort_order: 33,
  },

  {
    category: 'extension',
    subcategory: 'fdp_extension',
    rule_code: 'FDP_EXT_MAX_SECTORS_WOCL_GT2',
    label: 'Max sectors with extension — WOCL encroached >2h',
    value: '2',
    value_type: 'integer',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(d)(3)(iii)',
    directionality: 'MAX_LIMIT',
    sort_order: 34,
  },

  {
    category: 'extension',
    subcategory: 'fdp_extension',
    rule_code: 'FDP_EXT_NO_COMBINE_IFR',
    label: 'Extension cannot combine with in-flight rest',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(d)(4)',
    directionality: 'BOOLEAN',
    sort_order: 35,
  },

  {
    category: 'extension',
    subcategory: 'fdp_extension',
    rule_code: 'FDP_EXT_NO_COMBINE_SPLIT',
    label: 'Extension cannot combine with split duty',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(d)(4)',
    directionality: 'BOOLEAN',
    sort_order: 36,
  },

  // Commander discretion — §15.025(f)
  {
    category: 'extension',
    subcategory: 'commander_discretion',
    rule_code: 'CMD_DISC_MAX_FDP_INCREASE',
    label: 'Max FDP increase — non-augmented crew',
    value: '02:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(f)(1)(i)',
    directionality: 'MAX_LIMIT',
    sort_order: 40,
  },

  {
    category: 'extension',
    subcategory: 'commander_discretion',
    rule_code: 'CMD_DISC_MAX_FDP_INCREASE_AUG',
    label: 'Max FDP increase — augmented crew',
    value: '03:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(f)(1)(i)',
    directionality: 'MAX_LIMIT',
    sort_order: 41,
  },

  {
    category: 'extension',
    subcategory: 'commander_discretion',
    rule_code: 'CMD_DISC_MIN_REST_AFTER',
    label: 'Min rest after discretion-extended FDP',
    value: '10:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(f)(1)(iii)',
    directionality: 'MIN_LIMIT',
    sort_order: 42,
  },

  {
    category: 'extension',
    subcategory: 'commander_discretion',
    rule_code: 'CMD_DISC_REPORT_REQUIRED',
    label: 'Commander must report to operator',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(f)(4)',
    directionality: 'BOOLEAN',
    sort_order: 43,
  },

  {
    category: 'extension',
    subcategory: 'commander_discretion',
    rule_code: 'CMD_DISC_CAAV_REPORT_THRESHOLD',
    label: 'Report to CAAV when discretion exceeds',
    value: '01:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(f)(5)',
    directionality: 'MAX_LIMIT',
    sort_order: 44,
  },

  {
    category: 'extension',
    subcategory: 'commander_discretion',
    rule_code: 'CMD_DISC_CAAV_REPORT_DEADLINE',
    label: 'Days to send discretion report to CAAV',
    value: '28',
    value_type: 'integer',
    unit: 'days',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(f)(5)',
    directionality: 'MAX_LIMIT',
    sort_order: 45,
  },

  // Delayed reporting — Appendix 1 to §15.025(d)
  {
    category: 'extension',
    subcategory: 'delayed_reporting',
    rule_code: 'DELAYED_RPT_10H_COUNTS_AS_REST',
    label: 'Delay ≥10h with no disturbance counts as rest',
    value: '10:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.025(d)(1)(v)',
    directionality: 'MIN_LIMIT',
    sort_order: 50,
  },

  // ═══════════════════════════════════════════════
  // SPLIT DUTY — Appendix 2 to 15.031
  // ═══════════════════════════════════════════════

  {
    category: 'split_duty',
    subcategory: 'general',
    rule_code: 'SPLIT_DUTY_MIN_BREAK',
    label: 'Min break duration for split duty',
    value: '03:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.2 to 15.031(a)',
    directionality: 'MIN_LIMIT',
    sort_order: 60,
  },

  {
    category: 'split_duty',
    subcategory: 'general',
    rule_code: 'SPLIT_DUTY_FDP_CREDIT',
    label: 'FDP extension credit (% of break)',
    value: '50',
    value_type: 'integer',
    unit: '%',
    source: 'government',
    legal_reference: 'VAR 15 App.2 to 15.031(c)',
    sort_order: 61,
  },

  {
    category: 'split_duty',
    subcategory: 'general',
    rule_code: 'SPLIT_DUTY_ACCOM_THRESHOLD',
    label: 'Suitable accommodation required if break ≥',
    value: '06:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.2 to 15.031(d)',
    directionality: 'MAX_LIMIT',
    sort_order: 62,
  },

  {
    category: 'split_duty',
    subcategory: 'restrictions',
    rule_code: 'SPLIT_DUTY_NO_COMBINE_IFR',
    label: 'Split duty cannot combine with in-flight rest',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 App.2 to 15.031(f)',
    directionality: 'BOOLEAN',
    sort_order: 63,
  },

  {
    category: 'split_duty',
    subcategory: 'restrictions',
    rule_code: 'SPLIT_DUTY_NO_AFTER_REDUCED_REST',
    label: 'Split duty cannot follow reduced rest',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 §15.031(c)',
    directionality: 'BOOLEAN',
    sort_order: 64,
  },

  // ═══════════════════════════════════════════════
  // STANDBY — Appendix 1 to 15.033
  // ═══════════════════════════════════════════════

  {
    category: 'standby',
    subcategory: 'airport',
    rule_code: 'AIRPORT_STANDBY_FDP_REDUCTION',
    label: 'Airport standby: FDP reduced if standby exceeds',
    value: '04:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.033(a)(2)(i)',
    directionality: 'MAX_LIMIT',
    sort_order: 70,
  },

  {
    category: 'standby',
    subcategory: 'airport',
    rule_code: 'AIRPORT_STANDBY_MAX_COMBINED',
    label: 'Max combined airport standby + FDP',
    value: '16:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.033(a)(2)(ii)',
    directionality: 'MAX_LIMIT',
    sort_order: 71,
  },

  {
    category: 'standby',
    subcategory: 'home',
    rule_code: 'HOME_STANDBY_MAX_DURATION',
    label: 'Max home standby duration',
    value: '16:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.033(b)(1)',
    directionality: 'MAX_LIMIT',
    sort_order: 72,
  },

  {
    category: 'standby',
    subcategory: 'home',
    rule_code: 'HOME_STANDBY_MAX_AWAKE',
    label: 'Max awake time: standby + FDP',
    value: '18:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.033(b)(2)',
    directionality: 'MAX_LIMIT',
    sort_order: 73,
  },

  {
    category: 'standby',
    subcategory: 'home',
    rule_code: 'STANDBY_FDP_REDUCE_AFTER_6H',
    label: 'FDP reduced by home standby exceeding',
    value: '06:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.033(b)(7)',
    directionality: 'MAX_LIMIT',
    sort_order: 74,
  },

  {
    category: 'standby',
    subcategory: 'home',
    rule_code: 'STANDBY_IFR_SPLIT_EXTENDS_TO_8H',
    label: 'For IFR/split duty: 6h standby threshold extends to',
    value: '08:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.033(b)(8)',
    directionality: 'MAX_LIMIT',
    sort_order: 75,
  },

  {
    category: 'standby',
    subcategory: 'home',
    rule_code: 'STANDBY_NIGHT_PROTECTION',
    label: 'Standby 23:00–07:00 does not count until contacted',
    value: 'true',
    value_type: 'boolean',
    unit: '',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.033(b)(9)',
    directionality: 'BOOLEAN',
    sort_order: 76,
  },

  // ═══════════════════════════════════════════════
  // DISRUPTIVE SCHEDULES — Appendix 1 to 15.037(a)
  // ═══════════════════════════════════════════════

  {
    category: 'disruptive',
    subcategory: 'general',
    rule_code: 'DISRUPTIVE_LATE_TO_EARLY_REST',
    label: 'Late finish to early start: rest must include 1 local night',
    value: '1',
    value_type: 'integer',
    unit: 'nights',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.037(a)(1)',
    directionality: 'MIN_LIMIT',
    sort_order: 80,
  },

  {
    category: 'disruptive',
    subcategory: 'general',
    rule_code: 'DISRUPTIVE_4PLUS_EXTENDED_REST',
    label: '4+ night/early/late duties: extended recovery increases to',
    value: '60:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.037(a)(2)',
    directionality: 'MIN_LIMIT',
    sort_order: 81,
  },

  {
    category: 'disruptive',
    subcategory: 'time_zones',
    rule_code: 'TZ_AWAY_MIN_REST_GTE4H',
    label: 'Min rest away when FDP involves ≥4h time zone difference',
    value: '14:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.037(b)(3)(ii)',
    directionality: 'MIN_LIMIT',
    sort_order: 82,
  },

  {
    category: 'disruptive',
    subcategory: 'time_zones',
    rule_code: 'TZ_ALTERNATING_ROTATION_REST',
    label: 'E-W / W-E alternating: min local nights at home base',
    value: '3',
    value_type: 'integer',
    unit: 'nights',
    source: 'government',
    legal_reference: 'VAR 15 App.1 to 15.037(b)(4)',
    directionality: 'MIN_LIMIT',
    sort_order: 83,
  },

  // ═══════════════════════════════════════════════
  // DUTY RULES
  // ═══════════════════════════════════════════════

  {
    category: 'duty',
    subcategory: 'general',
    rule_code: 'FDP_EXCEEDED_33PCT_TRIGGER',
    label: 'Change schedule if FDP exceeded in >33% of duties in season',
    value: '33',
    value_type: 'integer',
    unit: '%',
    source: 'government',
    legal_reference: 'VAR 15 §15.007(j)',
    directionality: 'MAX_LIMIT',
    sort_order: 90,
  },

  {
    category: 'duty',
    subcategory: 'general',
    rule_code: 'NUTRITION_FDP_THRESHOLD',
    label: 'Meal/drink opportunity required when FDP exceeds',
    value: '06:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.039(a)',
    directionality: 'MAX_LIMIT',
    sort_order: 91,
  },

  {
    category: 'duty',
    subcategory: 'general',
    rule_code: 'RECORD_RETENTION_MONTHS',
    label: 'Record retention period',
    value: '24',
    value_type: 'integer',
    unit: 'months',
    source: 'government',
    legal_reference: 'VAR 15 §15.013(c)',
    directionality: 'MIN_LIMIT',
    sort_order: 92,
  },

  // ═══════════════════════════════════════════════
  // CABIN CREW SPECIFICS — §15.025(c)
  // ═══════════════════════════════════════════════

  {
    category: 'cabin_crew',
    subcategory: 'fdp',
    rule_code: 'CABIN_FDP_REPORTING_EXTENSION',
    label: 'Cabin FDP extension from reporting time difference (max)',
    value: '01:00',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(c)',
    directionality: 'MAX_LIMIT',
    sort_order: 100,
  },

  // ── Cruise time deductions for cabin crew in-flight rest calculation ────
  // Available cruise time = Block time − taxi out − taxi in − climb − descent
  // These are standard operational values used to determine how much flight time
  // is available for cabin crew rest rotation during augmented long-haul operations.

  {
    category: 'cabin_crew',
    subcategory: 'inflight_rest',
    rule_code: 'REST_TAXI_OUT_DEDUCTION',
    label: 'Taxi-out deduction for cruise time calculation',
    value: '0:10',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(c)(5)',
    directionality: 'MAX_LIMIT',
    sort_order: 101,
  },

  {
    category: 'cabin_crew',
    subcategory: 'inflight_rest',
    rule_code: 'REST_TAXI_IN_DEDUCTION',
    label: 'Taxi-in deduction for cruise time calculation',
    value: '0:10',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(c)(5)',
    directionality: 'MAX_LIMIT',
    sort_order: 102,
  },

  {
    category: 'cabin_crew',
    subcategory: 'inflight_rest',
    rule_code: 'REST_CLIMB_DEDUCTION',
    label: 'Climb phase deduction for cruise time calculation',
    value: '0:30',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(c)(5)',
    directionality: 'MAX_LIMIT',
    sort_order: 103,
  },

  {
    category: 'cabin_crew',
    subcategory: 'inflight_rest',
    rule_code: 'REST_DESCENT_DEDUCTION',
    label: 'Descent phase deduction for cruise time calculation',
    value: '0:30',
    value_type: 'duration',
    unit: 'hrs',
    source: 'government',
    legal_reference: 'VAR 15 §15.025(c)(5)',
    directionality: 'MAX_LIMIT',
    sort_order: 104,
  },

  // ═══════════════════════════════════════════════
  // MIXED OPS — §15.043
  // ═══════════════════════════════════════════════

  {
    category: 'mixed_ops',
    subcategory: 'simulator',
    rule_code: 'MIXED_SIM_TIME_MULTIPLIER',
    label: 'Simulator/training time multiplier for FDP calculation',
    value: '2',
    value_type: 'integer',
    unit: '×',
    source: 'government',
    legal_reference: 'VAR 15 §15.043(b)',
    directionality: 'MAX_LIMIT',
    sort_order: 110,
  },
]

export const CAAV_FDP_TABLES: FDPTableTemplate[] = [
  CAAV_TABLE_01,
  CAAV_TABLE_02,
  CAAV_TABLE_03,
  CAAV_TABLE_04,
  CAAV_TABLE_05,
  CAAV_TABLE_06,
  CAAV_TABLE_07,
]
