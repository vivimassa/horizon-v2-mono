/**
 * Frequency Analysis — shared types.
 *
 * Shape mirrors V1's `FrequencyFlightRow`: one row per (scheduledFlight × instanceDate).
 * Client-side expansion of ScheduledFlight patterns produces this shape, so downstream
 * derivations (KPIs / pattern chart / heatmap / route table) stay pure and reusable.
 */

export interface FrequencyFlightRow {
  /** scheduled_flight id (stable across date expansion) */
  id: string
  /** ISO YYYY-MM-DD */
  instanceDate: string
  flightNumber: string
  depStation: string
  arrStation: string
  /** HH:MM UTC */
  stdUtc: string
  staUtc: string
  blockMinutes: number
  icaoType: string
  serviceType: string
  routeType: 'domestic' | 'international' | null
  /** SSIM-style digits, e.g. "12345" */
  daysOfOperation: string
  /** ISO YYYY-MM-DD */
  periodStart: string
  /** ISO YYYY-MM-DD */
  periodEnd: string
}

export type SortBy = 'flight' | 'freq' | 'block'

export type PatternKey = 'daily' | 'weekday' | 'weekend' | 'odd' | 'even' | 'other'

export interface FrequencyFilterState {
  dateFrom: string
  dateTo: string
  /** ICAO AC type codes; empty set = all types */
  selectedTypes: Set<string>
  /** IATA/ICAO code or '' for all */
  selectedStation: string
  /** "DEP-ARR" or '' for all */
  selectedRoute: string
  selectedRouteType: 'all' | 'domestic' | 'international'
  /** Service type code or '' for all */
  selectedServiceType: string
  searchQuery: string
  sortBy: SortBy
}

export interface DayStats {
  date: string
  dow: number
  dowLabel: string
  dateNum: number
  total: number
  byType: Map<string, number>
  byRoute: Map<string, number>
  blockMinutes: number
}

export interface FrequencyKpis {
  uniqueFlights: number
  weeklyDeps: number
  avgDaily: number
  peakCount: number
  peakDow: string
  weeklyBlockMin: number
  routeCount: number
}

export interface PatternBucket {
  total: number
  daily: FrequencyFlightRow[]
  weekday: FrequencyFlightRow[]
  weekend: FrequencyFlightRow[]
  odd: FrequencyFlightRow[]
  even: FrequencyFlightRow[]
  other: FrequencyFlightRow[]
  uniqueOther: number
}

export interface DowDistributionRow {
  dow: number
  label: string
  byType: Map<string, number>
  total: number
}

export interface DetailRoute {
  route: string
  flights: FrequencyFlightRow[]
  weeklyFreq: number
  weeklyBlockMin: number
  types: string[]
  totalDeps: number
}
