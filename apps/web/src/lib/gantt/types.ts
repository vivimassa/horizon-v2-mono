// ── API Response Types (mirror server response) ──

export interface GanttFlight {
  id: string
  scheduledFlightId: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdUtc: number
  staUtc: number
  blockMinutes: number
  operatingDate: string
  aircraftTypeIcao: string | null
  aircraftReg: string | null
  status: string
  serviceType: string
  scenarioId: string | null
  rotationId: string | null
  rotationSequence: number | null
  rotationLabel: string | null
}

export interface GanttAircraft {
  id: string
  registration: string
  aircraftTypeId: string
  aircraftTypeIcao: string | null
  aircraftTypeName: string | null
  status: string
  homeBaseIcao: string | null
  color: string | null
}

export interface GanttAircraftType {
  id: string
  icaoType: string
  name: string
  category: string
  color: string | null
  tatDefaultMinutes: number | null
}

export interface GanttMeta {
  from: string
  to: string
  totalFlights: number
  totalAircraft: number
  expandedAt: number
}

export interface GanttApiResponse {
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  meta: GanttMeta
}

// ── View State Types ──

export type ZoomLevel = '1D' | '2D' | '3D' | '4D' | '5D' | '6D' | '7D' | '14D' | '21D' | '28D'
export type ColorMode = 'status' | 'ac_type' | 'service_type' | 'route_type'
export type BarLabelMode = 'flightNo' | 'sector'

export const ZOOM_CONFIG: Record<ZoomLevel, { days: number; hoursPerTick: number }> = {
  '1D':  { days: 1,  hoursPerTick: 1 },
  '2D':  { days: 2,  hoursPerTick: 2 },
  '3D':  { days: 3,  hoursPerTick: 2 },
  '4D':  { days: 4,  hoursPerTick: 3 },
  '5D':  { days: 5,  hoursPerTick: 4 },
  '6D':  { days: 6,  hoursPerTick: 4 },
  '7D':  { days: 7,  hoursPerTick: 6 },
  '14D': { days: 14, hoursPerTick: 12 },
  '21D': { days: 21, hoursPerTick: 24 },
  '28D': { days: 28, hoursPerTick: 24 },
}

export const ROW_HEIGHT_LEVELS = [
  { label: 'compact', rowH: 32, barH: 22, fontSize: 10 },
  { label: 'default', rowH: 44, barH: 28, fontSize: 11 },
  { label: 'large',   rowH: 56, barH: 36, fontSize: 12 },
  { label: 'xlarge',  rowH: 72, barH: 48, fontSize: 13 },
] as const

// ── Layout Types (output of layout engine, used by canvas renderer) ──

export interface BarLayout {
  flightId: string
  x: number
  y: number
  width: number
  height: number
  color: string
  textColor: string
  label: string
  row: number
  flight: GanttFlight
}

export interface RowLayout {
  type: 'group_header' | 'aircraft' | 'unassigned'
  registration?: string
  aircraftTypeIcao?: string
  aircraftTypeName?: string
  label: string
  y: number
  height: number
  color?: string
  aircraftCount?: number
}

export interface TickMark {
  x: number
  label: string
  isMajor: boolean
  /** ISO date string (YYYY-MM-DD) for major (day boundary) ticks */
  date?: string
}

export interface LayoutResult {
  rows: RowLayout[]
  bars: BarLayout[]
  ticks: TickMark[]
  totalWidth: number
  totalHeight: number
}
