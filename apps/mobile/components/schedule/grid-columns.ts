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
  { key: 'rotationLabel',      label: 'AC',       width: 50,  editable: false, type: 'readonly',  align: 'center', mono: true },
  { key: 'aircraftTypeIcao',   label: 'AC TYPE',  width: 65,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 4 },
  { key: 'effectiveFrom',      label: 'FROM',     width: 90,  editable: true,  type: 'date',      align: 'center', mono: true },
  { key: 'effectiveUntil',     label: 'TO',       width: 90,  editable: true,  type: 'date',      align: 'center', mono: true },
  { key: 'depStation',         label: 'DEP',      width: 55,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 4 },
  { key: 'arrStation',         label: 'ARR',      width: 55,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 4 },
  { key: 'flightNumber',       label: 'FLIGHT',   width: 80,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 8 },
  { key: 'stdUtc',             label: 'STD',      width: 60,  editable: true,  type: 'time',      align: 'center', mono: true, maxLength: 5 },
  { key: 'staUtc',             label: 'STA',      width: 60,  editable: true,  type: 'time',      align: 'center', mono: true, maxLength: 5 },
  { key: 'departureDayOffset', label: 'OFFSET',   width: 45,  editable: true,  type: 'text',      align: 'center', mono: true, maxLength: 1 },
  { key: 'serviceType',        label: 'SVC',      width: 45,  editable: true,  type: 'select',    align: 'center' },
  { key: 'daysOfWeek',         label: 'FREQ',     width: 140, editable: true,  type: 'frequency', align: 'center', mono: true, maxLength: 7 },
  { key: 'blockMinutes',       label: 'BLOCK',    width: 60,  editable: false, type: 'readonly',  align: 'center', mono: true },
  { key: 'tat',                label: 'TAT',      width: 55,  editable: false, type: 'readonly',  align: 'center', mono: true },
  { key: 'status',             label: 'STATUS',   width: 80,  editable: false, type: 'readonly',  align: 'center' },
]

export const EDITABLE_COLUMNS = GRID_COLUMNS.filter(c => c.editable)
export const TOTAL_WIDTH = GRID_COLUMNS.reduce((s, c) => s + c.width, 0)

export const ROW_HEIGHT = 44
export const HEADER_HEIGHT = 38

/** Format minutes as H:MM */
export function fmtMinutes(min: number | null): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Calculate block minutes from STD and STA (HH:MM strings) */
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
