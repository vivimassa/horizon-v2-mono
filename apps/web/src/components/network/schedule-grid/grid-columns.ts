// Network Scheduling XL — Column Definitions
// Percentage-based widths matching V1 exactly.

export interface GridColumn {
  key: string
  label: string
  width: string // percentage (e.g. "5%")
  editable: boolean
  type: 'text' | 'time' | 'date' | 'select' | 'frequency' | 'readonly'
  maxLength?: number
  align: 'left' | 'center' | 'right'
  mono?: boolean
}

export const GRID_COLUMNS: GridColumn[] = [
  { key: 'ac', label: 'AC', width: '5%', editable: false, type: 'readonly', align: 'center', mono: true },
  {
    key: 'aircraftTypeIcao',
    label: 'AC TYPE',
    width: '5%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 4,
  },
  { key: 'effectiveFrom', label: 'FROM', width: '6%', editable: true, type: 'date', align: 'center', mono: true },
  { key: 'effectiveUntil', label: 'TO', width: '6%', editable: true, type: 'date', align: 'center', mono: true },
  {
    key: 'depStation',
    label: 'DEP',
    width: '4%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 4,
  },
  {
    key: 'arrStation',
    label: 'ARR',
    width: '4%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 4,
  },
  {
    key: 'flightNumber',
    label: 'FLIGHT',
    width: '5%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 8,
  },
  { key: 'stdUtc', label: 'STD', width: '5%', editable: true, type: 'time', align: 'center', mono: true, maxLength: 5 },
  { key: 'staUtc', label: 'STA', width: '5%', editable: true, type: 'time', align: 'center', mono: true, maxLength: 5 },
  {
    key: 'departureDayOffset',
    label: 'OFFSET',
    width: '3.5%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 1,
  },
  { key: 'serviceType', label: 'SVC', width: '4%', editable: true, type: 'select', align: 'center' },
  {
    key: 'daysOfWeek',
    label: 'FREQUENCY',
    width: '7%',
    editable: true,
    type: 'frequency',
    align: 'center',
    mono: true,
    maxLength: 7,
  },
  {
    key: 'blockMinutes',
    label: 'BLOCK',
    width: '5.5%',
    editable: false,
    type: 'readonly',
    align: 'center',
    mono: true,
  },
  { key: 'tat', label: 'TAT', width: '4.5%', editable: false, type: 'readonly', align: 'center', mono: true },
  { key: 'status', label: 'STATUS', width: '5%', editable: false, type: 'readonly', align: 'center' },
]

export const EDITABLE_COLUMNS = GRID_COLUMNS.filter((c) => c.editable)

/** Mini grid columns for Gantt Add Flight dialog — excludes AC, BLOCK, TAT, tighter widths */
export const MINI_GRID_COLUMNS: GridColumn[] = [
  {
    key: 'aircraftTypeIcao',
    label: 'AC TYPE',
    width: '7%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 4,
  },
  { key: 'effectiveFrom', label: 'FROM', width: '8%', editable: true, type: 'date', align: 'center', mono: true },
  { key: 'effectiveUntil', label: 'TO', width: '8%', editable: true, type: 'date', align: 'center', mono: true },
  {
    key: 'depStation',
    label: 'DEP',
    width: '6%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 4,
  },
  {
    key: 'arrStation',
    label: 'ARR',
    width: '6%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 4,
  },
  {
    key: 'flightNumber',
    label: 'FLIGHT',
    width: '8%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 8,
  },
  { key: 'stdUtc', label: 'STD', width: '7%', editable: true, type: 'time', align: 'center', mono: true, maxLength: 5 },
  { key: 'staUtc', label: 'STA', width: '7%', editable: true, type: 'time', align: 'center', mono: true, maxLength: 5 },
  {
    key: 'departureDayOffset',
    label: 'OFFSET',
    width: '5%',
    editable: true,
    type: 'text',
    align: 'center',
    mono: true,
    maxLength: 1,
  },
  { key: 'serviceType', label: 'SVC', width: '5%', editable: true, type: 'select', align: 'center' },
  {
    key: 'daysOfWeek',
    label: 'FREQUENCY',
    width: '9%',
    editable: true,
    type: 'frequency',
    align: 'center',
    mono: true,
    maxLength: 7,
  },
  { key: 'status', label: 'STATUS', width: '7%', editable: false, type: 'readonly', align: 'center' },
]

export const ROW_HEIGHT = 32
export const HEADER_HEIGHT = 32

/** Border style for grid cells — matching V1's 8% opacity */
export const CELL_BORDER = '1px solid rgba(0,0,0,0.08)'
export const CELL_BORDER_DARK = '1px solid rgba(255,255,255,0.08)'

/** Selection outline color — Excel green */
export const SELECTION_COLOR = '#217346'

/** Format minutes as H:MM */
export function fmtMinutes(min: number | null): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Calculate block minutes from STD and STA (HH:MM or HHMM strings) */
export function calcBlockMinutes(std: string, sta: string): number | null {
  if (!std || !sta) return null
  const stdClean = std.replace(':', '')
  const staClean = sta.replace(':', '')
  if (stdClean.length < 4 || staClean.length < 4) return null
  const stdMin = parseInt(stdClean.slice(0, 2)) * 60 + parseInt(stdClean.slice(2, 4))
  const staMin = parseInt(staClean.slice(0, 2)) * 60 + parseInt(staClean.slice(2, 4))
  let diff = staMin - stdMin
  if (diff < 0) diff += 1440
  return diff
}
