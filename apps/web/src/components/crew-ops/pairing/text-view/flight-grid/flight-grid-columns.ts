// Flight Pool grid — column definitions (4.1.5.1)
// Adapted from apps/web/src/components/network/schedule-grid/grid-columns.ts
// All columns are READ-ONLY for pairing — editing belongs to Scheduling XL.

export interface FlightGridColumn {
  key: FlightGridColumnKey
  label: string
  width: string // percentage e.g. '5%'
  align: 'left' | 'center' | 'right'
  mono?: boolean
}

export type FlightGridColumnKey =
  | 'ac'
  | 'aircraftTypeIcao'
  | 'tailNumber'
  | 'effectiveFrom'
  | 'effectiveUntil'
  | 'depStation'
  | 'arrStation'
  | 'flightNumber'
  | 'stdUtc'
  | 'staUtc'
  | 'departureDayOffset'
  | 'serviceType'
  | 'daysOfWeek'
  | 'blockMinutes'
  | 'tat'
  | 'status'
  | 'pairingCode'

export const FLIGHT_GRID_COLUMNS: FlightGridColumn[] = [
  { key: 'ac', label: 'AC', width: '5%', align: 'center', mono: true },
  { key: 'aircraftTypeIcao', label: 'AC TYPE', width: '4.5%', align: 'center', mono: true },
  { key: 'tailNumber', label: 'TAIL', width: '6.5%', align: 'center', mono: true },
  { key: 'effectiveFrom', label: 'FROM', width: '6%', align: 'center', mono: true },
  { key: 'effectiveUntil', label: 'TO', width: '6%', align: 'center', mono: true },
  { key: 'depStation', label: 'DEP', width: '4%', align: 'center', mono: true },
  { key: 'arrStation', label: 'ARR', width: '4%', align: 'center', mono: true },
  { key: 'flightNumber', label: 'FLIGHT', width: '5.5%', align: 'center', mono: true },
  { key: 'stdUtc', label: 'STD', width: '5%', align: 'center', mono: true },
  { key: 'staUtc', label: 'STA', width: '5%', align: 'center', mono: true },
  { key: 'departureDayOffset', label: 'OFFSET', width: '3.5%', align: 'center', mono: true },
  { key: 'serviceType', label: 'SVC', width: '4%', align: 'center', mono: true },
  { key: 'daysOfWeek', label: 'FREQUENCY', width: '7%', align: 'center', mono: true },
  { key: 'blockMinutes', label: 'BLOCK', width: '5%', align: 'center', mono: true },
  { key: 'tat', label: 'TAT', width: '4.5%', align: 'center', mono: true },
  { key: 'status', label: 'STATUS', width: '5%', align: 'center' },
  { key: 'pairingCode', label: 'PAIRING', width: '6%', align: 'center', mono: true },
]

/** Width of the left-most row-number column (like Excel's row gutter). */
export const ROW_NUMBER_WIDTH = '3%'

/** Total row height (px). */
export const ROW_HEIGHT = 28

/** Header height (px). Matches Scheduling XL's header look. */
export const HEADER_HEIGHT = 32

export function cellBorder(isDark: boolean): string {
  return `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`
}

/** Excel-green outline on the focused cell. */
export const SELECTION_COLOR = '#217346'
/** Soft accent-tinted wash behind range-selected cells. */
export function rangeBg(isDark: boolean): string {
  return isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.10)'
}
/** Covered-flight (already in a pairing) row wash. */
export function coveredBg(isDark: boolean): string {
  return isDark ? 'rgba(140,140,155,0.14)' : 'rgba(100,116,139,0.10)'
}
/** Column highlight when an entire column is selected. */
export function columnHighlightBg(isDark: boolean): string {
  return isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.05)'
}
