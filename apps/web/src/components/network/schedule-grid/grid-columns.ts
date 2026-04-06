// Network Scheduling XL — Column Definitions
// All 14 columns matching V1's Schedule Grid layout exactly.

export interface GridColumn {
  key: string
  label: string
  width: number
  editable: boolean
  type: 'text' | 'time' | 'date' | 'select' | 'frequency' | 'readonly'
  maxLength?: number
  align: 'left' | 'center' | 'right'
  mono?: boolean
}

export const GRID_COLUMNS: GridColumn[] = [
  { key: 'ac',              label: 'AC',        width: 80,  editable: false, type: 'readonly',  align: 'center', mono: true },
  { key: 'aircraftTypeIcao',label: 'TYPE',      width: 70,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 4 },
  { key: 'effectiveFrom',   label: 'FROM',      width: 100, editable: true,  type: 'date',      align: 'center', mono: true },
  { key: 'effectiveUntil',  label: 'TO',        width: 100, editable: true,  type: 'date',      align: 'center', mono: true },
  { key: 'depStation',      label: 'DEP',       width: 60,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 4 },
  { key: 'arrStation',      label: 'ARR',       width: 60,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 4 },
  { key: 'flightNumber',    label: 'FLIGHT',    width: 90,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 8 },
  { key: 'stdUtc',          label: 'STD',       width: 70,  editable: true,  type: 'time',      align: 'center', mono: true, maxLength: 5 },
  { key: 'staUtc',          label: 'STA',       width: 70,  editable: true,  type: 'time',      align: 'center', mono: true, maxLength: 5 },
  { key: 'serviceType',     label: 'SVC',       width: 50,  editable: true,  type: 'select',    align: 'center' },
  { key: 'daysOfWeek',      label: 'FREQUENCY', width: 90,  editable: true,  type: 'frequency', align: 'center', mono: true, maxLength: 7 },
  { key: 'blockMinutes',    label: 'BLOCK',     width: 70,  editable: false, type: 'readonly',  align: 'center', mono: true },
  { key: 'tat',             label: 'TAT',       width: 60,  editable: false, type: 'readonly',  align: 'center', mono: true },
  { key: 'status',          label: 'STATUS',    width: 80,  editable: false, type: 'readonly',  align: 'center' },
]

export const EDITABLE_COLUMNS = GRID_COLUMNS.filter(c => c.editable)

export const ROW_HEIGHT = 32
export const HEADER_HEIGHT = 36

/** Format minutes as H:MM */
export function fmtMinutes(min: number | null): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Calculate block minutes from STD and STA (HHMM strings) */
export function calcBlockMinutes(std: string, sta: string): number | null {
  if (!std || !sta || std.length < 4 || sta.length < 4) return null
  const stdMin = parseInt(std.slice(0, 2)) * 60 + parseInt(std.slice(2, 4))
  const staMin = parseInt(sta.slice(0, 2)) * 60 + parseInt(sta.slice(2, 4))
  let diff = staMin - stdMin
  if (diff < 0) diff += 1440
  return diff
}

/** Get the total width of all columns */
export const TOTAL_WIDTH = GRID_COLUMNS.reduce((s, c) => s + c.width, 0)
