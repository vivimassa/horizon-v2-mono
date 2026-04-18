import type { Flight, AircraftTypeRef, AircraftRegistrationRef, CityPairRef } from '@skyhub/api'

export type FlightTypeFilter = 'all' | 'dom' | 'int'

export interface ScheduleSummaryFilters {
  dateFrom: string
  dateTo: string
  acType: string
  serviceType: string
  flightType: FlightTypeFilter
}

export interface LoadedDataset {
  flights: Flight[]
  aircraftTypes: AircraftTypeRef[]
  registrations: AircraftRegistrationRef[]
  cityPairs: CityPairRef[]
  committed: ScheduleSummaryFilters
}

export interface Kpis {
  weeklyFlights: number
  dailyAvgFlights: number
  uniqueRoutes: number
  domRoutes: number
  intRoutes: number
  weeklyBlockHours: number
  dailyAvgBlockHours: number
  weeklySeats: number
  dailyAvgSeats: number
  weeklyAsk: number
  aircraftDeployed: number
  aircraftByType: { icaoType: string; count: number }[]
  totalInstances: number
}

export interface NetworkSplit {
  domFlights: number
  intFlights: number
  total: number
  domPct: number
  intPct: number
}

export interface FleetRow {
  icaoType: string
  aircraft: number
  wkFlights: number
  wkHours: number
  wkSeats: number
  capPct: number
  color: string
}

export interface TrendPoint {
  label: string
  weekNum: number
  flights: number
  seats: number
}

export interface RouteRow {
  route: string
  depIata: string
  arrIata: string
  distanceKm: number
  blockMinutes: number
  weeklyFreq: number
  types: string[]
  weeklySeats: number
  weeklyAsk: number
  weeklyBlockHrs: number
  sharePct: number
}

export interface StationRow {
  station: string
  weeklyDeps: number
  pct: number
  isHub: boolean
  color: string
}

export interface ComputedSummary {
  kpis: Kpis | null
  networkSplit: NetworkSplit | null
  fleet: FleetRow[]
  trend: TrendPoint[]
  routes: RouteRow[]
  stations: StationRow[]
  acTypeColors: Map<string, string>
  uniqueAcTypes: string[]
  uniqueServiceTypes: string[]
  periodDays: number
}
