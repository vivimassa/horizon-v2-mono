import type { Flight, AircraftTypeRef, AircraftRegistrationRef, CityPairRef } from '@skyhub/api'
import type {
  ComputedSummary,
  FleetRow,
  Kpis,
  LoadedDataset,
  NetworkSplit,
  RouteRow,
  ScheduleSummaryFilters,
  StationRow,
  TrendPoint,
} from './schedule-summary-types'

const AC_FALLBACK_PALETTE = [
  '#0063F7',
  '#06C270',
  '#FF8800',
  '#AC5DD9',
  '#00A6FB',
  '#E63535',
  '#FFCC00',
  '#6600CC',
  '#00CFDE',
  '#FF3B3B',
  '#3E7BFA',
  '#00CFDE',
  '#FDDD48',
  '#73DFE7',
  '#be185d',
]

const STATION_COLORS = ['var(--module-accent, #1e40af)', '#AC5DD9', '#FF8800', '#06C270']

export function parseIsoDateUtc(s: string): number {
  return Date.UTC(parseInt(s.slice(0, 4), 10), parseInt(s.slice(5, 7), 10) - 1, parseInt(s.slice(8, 10), 10))
}

export function formatBlockTime(minutes: number): string {
  if (!minutes || minutes <= 0) return '0:00'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function formatLargeNumber(n: number): string {
  if (!isFinite(n) || n <= 0) return '0'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString()
}

export function getIsoWeek(utcMs: number): { year: number; week: number } {
  const d = new Date(utcMs)
  const day = (d.getUTCDay() + 6) % 7
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3))
  const year = thursday.getUTCFullYear()
  const week1 = Date.UTC(year, 0, 4)
  const week = 1 + Math.round((thursday.getTime() - week1) / 86400000 / 7)
  return { year, week }
}

function buildAcTypeColorMap(types: string[], aircraftTypes: AircraftTypeRef[]): Map<string, string> {
  const dbColors = new Map<string, string>()
  for (const t of aircraftTypes) {
    if (t.color) dbColors.set(t.icaoType, t.color)
  }
  const map = new Map<string, string>()
  const sorted = [...types].sort()
  sorted.forEach((t, i) => {
    map.set(t, dbColors.get(t) ?? AC_FALLBACK_PALETTE[i % AC_FALLBACK_PALETTE.length])
  })
  return map
}

interface EnrichedFlight {
  flight: Flight
  icaoType: string
  paxCapacity: number
  blockMinutes: number
  depCode: string
  arrCode: string
  routeKey: string
  distanceKm: number
  isDomestic: boolean
  isInternational: boolean
  operatingMs: number
}

function enrichFlights(data: LoadedDataset): EnrichedFlight[] {
  const regToType = new Map<string, string>()
  for (const r of data.registrations) {
    const t = data.aircraftTypes.find((ac) => ac._id === r.aircraftTypeId)
    if (t && r.registration) regToType.set(r.registration, t.icaoType)
  }
  const typeById = new Map(data.aircraftTypes.map((t) => [t.icaoType, t] as const))
  const cityPairByKey = new Map<string, CityPairRef>()
  for (const cp of data.cityPairs) {
    cityPairByKey.set(`${cp.station1Icao}|${cp.station2Icao}`, cp)
    cityPairByKey.set(`${cp.station2Icao}|${cp.station1Icao}`, cp)
  }

  const enriched: EnrichedFlight[] = []
  for (const f of data.flights) {
    const icaoType = f.tail.icaoType || (f.tail.registration ? regToType.get(f.tail.registration) : null) || ''
    if (!icaoType) continue
    const type = typeById.get(icaoType)
    const paxCapacity = f.lopa?.totalSeats ?? type?.paxCapacity ?? 0
    if (!f.schedule.stdUtc || !f.schedule.staUtc) continue
    const blockMinutes = Math.max(0, Math.round((f.schedule.staUtc - f.schedule.stdUtc) / 60000))
    const depCode = f.dep.iata || f.dep.icao
    const arrCode = f.arr.iata || f.arr.icao
    const cp = cityPairByKey.get(`${f.dep.icao}|${f.arr.icao}`)
    const distanceKm = cp?.distanceKm ?? 0
    let isDomestic = false
    let isInternational = false
    if (cp?.routeType) {
      isDomestic = cp.routeType === 'domestic'
      isInternational = cp.routeType === 'international'
    } else if (cp?.station1CountryIso2 && cp?.station2CountryIso2) {
      isDomestic = cp.station1CountryIso2 === cp.station2CountryIso2
      isInternational = !isDomestic
    }
    enriched.push({
      flight: f,
      icaoType,
      paxCapacity,
      blockMinutes,
      depCode,
      arrCode,
      routeKey: `${depCode}-${arrCode}`,
      distanceKm,
      isDomestic,
      isInternational,
      operatingMs: parseIsoDateUtc(f.operatingDate),
    })
  }
  return enriched
}

function applyFilters(flights: EnrichedFlight[], f: ScheduleSummaryFilters): EnrichedFlight[] {
  return flights.filter((x) => {
    if (f.acType !== 'all' && x.icaoType !== f.acType) return false
    if (f.flightType === 'dom' && !x.isDomestic) return false
    if (f.flightType === 'int' && !x.isInternational) return false
    return true
  })
}

export function computeSummary(data: LoadedDataset): ComputedSummary {
  const { committed } = data
  const periodStart = parseIsoDateUtc(committed.dateFrom)
  const periodEnd = parseIsoDateUtc(committed.dateTo)
  const periodDays = Math.round((periodEnd - periodStart) / 86400000) + 1
  const periodWeeks = periodDays > 0 ? periodDays / 7 : 0

  const enrichedAll = enrichFlights(data)
  const enriched = applyFilters(enrichedAll, committed)

  const uniqueAcTypes = Array.from(new Set(enrichedAll.map((x) => x.icaoType))).sort()
  const acTypeColors = buildAcTypeColorMap(uniqueAcTypes, data.aircraftTypes)
  const uniqueServiceTypes: string[] = []

  if (enriched.length === 0 || periodWeeks <= 0) {
    return {
      kpis: null,
      networkSplit: null,
      fleet: [],
      trend: [],
      routes: [],
      stations: [],
      acTypeColors,
      uniqueAcTypes,
      uniqueServiceTypes,
      periodDays,
    }
  }

  let totalInstances = 0
  let totalBlockMinutes = 0
  let totalSeats = 0
  let totalAsk = 0
  let domFlights = 0
  let intFlights = 0
  const routeSet = new Set<string>()
  const domRoutes = new Set<string>()
  const intRoutes = new Set<string>()
  const regsUsed = new Set<string>()

  for (const x of enriched) {
    totalInstances += 1
    totalBlockMinutes += x.blockMinutes
    totalSeats += x.paxCapacity
    totalAsk += x.paxCapacity * x.distanceKm
    if (x.isDomestic) {
      domFlights += 1
      domRoutes.add(x.routeKey)
    } else if (x.isInternational) {
      intFlights += 1
      intRoutes.add(x.routeKey)
    }
    routeSet.add(x.routeKey)
    if (x.flight.tail.registration) regsUsed.add(x.flight.tail.registration)
  }

  const aircraftByType = new Map<string, number>()
  for (const reg of data.registrations) {
    if (!reg.isActive) continue
    if (!regsUsed.has(reg.registration)) continue
    const t = data.aircraftTypes.find((ac) => ac._id === reg.aircraftTypeId)
    if (!t) continue
    if (committed.acType !== 'all' && t.icaoType !== committed.acType) continue
    aircraftByType.set(t.icaoType, (aircraftByType.get(t.icaoType) ?? 0) + 1)
  }
  const aircraftDeployed = Array.from(aircraftByType.values()).reduce((s, v) => s + v, 0)

  const kpis: Kpis = {
    weeklyFlights: Math.round(totalInstances / periodWeeks),
    dailyAvgFlights: Math.round(totalInstances / periodDays),
    uniqueRoutes: routeSet.size,
    domRoutes: domRoutes.size,
    intRoutes: intRoutes.size,
    weeklyBlockHours: Math.round(totalBlockMinutes / periodWeeks / 60),
    dailyAvgBlockHours: Math.round(totalBlockMinutes / periodDays / 60),
    weeklySeats: Math.round(totalSeats / periodWeeks),
    dailyAvgSeats: Math.round(totalSeats / periodDays),
    weeklyAsk: Math.round(totalAsk / periodWeeks),
    aircraftDeployed,
    aircraftByType: Array.from(aircraftByType.entries())
      .map(([icaoType, count]) => ({ icaoType, count }))
      .sort((a, b) => b.count - a.count),
    totalInstances,
  }

  const totalDomInt = domFlights + intFlights
  const networkSplit: NetworkSplit = {
    domFlights,
    intFlights,
    total: totalDomInt,
    domPct: totalDomInt > 0 ? Math.round((domFlights / totalDomInt) * 100) : 0,
    intPct: totalDomInt > 0 ? Math.round((intFlights / totalDomInt) * 100) : 0,
  }

  const fleetMap = new Map<string, { flights: number; blockMin: number; seats: number }>()
  for (const x of enriched) {
    const e = fleetMap.get(x.icaoType) ?? { flights: 0, blockMin: 0, seats: 0 }
    e.flights += 1
    e.blockMin += x.blockMinutes
    e.seats += x.paxCapacity
    fleetMap.set(x.icaoType, e)
  }
  const fleetSeatsTotal = Array.from(fleetMap.values()).reduce((s, v) => s + v.seats, 0)
  const fleet: FleetRow[] = Array.from(fleetMap.entries())
    .map(([icaoType, e]) => ({
      icaoType,
      aircraft: aircraftByType.get(icaoType) ?? 0,
      wkFlights: Math.round(e.flights / periodWeeks),
      wkHours: Math.round(e.blockMin / periodWeeks / 60),
      wkSeats: Math.round(e.seats / periodWeeks),
      capPct: fleetSeatsTotal > 0 ? (e.seats / fleetSeatsTotal) * 100 : 0,
      color: acTypeColors.get(icaoType) ?? '#8E8E93',
    }))
    .sort((a, b) => b.wkSeats - a.wkSeats)

  const weekMap = new Map<string, TrendPoint>()
  for (const x of enriched) {
    const { year, week } = getIsoWeek(x.operatingMs)
    const key = `${year}-${String(week).padStart(2, '0')}`
    const e = weekMap.get(key) ?? { label: `W${week}`, weekNum: week, flights: 0, seats: 0 }
    e.flights += 1
    e.seats += x.paxCapacity
    weekMap.set(key, e)
  }
  const trend: TrendPoint[] =
    periodDays >= 14
      ? Array.from(weekMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, v]) => v)
      : []

  const routeMap = new Map<
    string,
    {
      depIata: string
      arrIata: string
      distanceKm: number
      instances: number
      seats: number
      blockMin: number
      types: Set<string>
      blockCounts: Map<number, number>
    }
  >()
  for (const x of enriched) {
    const e = routeMap.get(x.routeKey) ?? {
      depIata: x.depCode,
      arrIata: x.arrCode,
      distanceKm: x.distanceKm,
      instances: 0,
      seats: 0,
      blockMin: 0,
      types: new Set<string>(),
      blockCounts: new Map<number, number>(),
    }
    e.instances += 1
    e.seats += x.paxCapacity
    e.blockMin += x.blockMinutes
    e.types.add(x.icaoType)
    e.blockCounts.set(x.blockMinutes, (e.blockCounts.get(x.blockMinutes) ?? 0) + 1)
    routeMap.set(x.routeKey, e)
  }
  const routeSeatsTotal = Array.from(routeMap.values()).reduce((s, v) => s + v.seats, 0)
  const routes: RouteRow[] = Array.from(routeMap.entries())
    .map(([route, e]) => {
      let modalBlock = 0
      let modalCount = 0
      for (const [bm, cnt] of e.blockCounts) {
        if (cnt > modalCount) {
          modalBlock = bm
          modalCount = cnt
        }
      }
      return {
        route,
        depIata: e.depIata,
        arrIata: e.arrIata,
        distanceKm: e.distanceKm,
        blockMinutes: modalBlock,
        weeklyFreq: Math.round(e.instances / periodWeeks),
        types: Array.from(e.types).sort(),
        weeklySeats: Math.round(e.seats / periodWeeks),
        weeklyAsk: Math.round((e.seats * e.distanceKm) / periodWeeks),
        weeklyBlockHrs: Math.round((e.blockMin / periodWeeks / 60) * 10) / 10,
        sharePct: routeSeatsTotal > 0 ? Math.round((e.seats / routeSeatsTotal) * 1000) / 10 : 0,
      }
    })
    .sort((a, b) => b.weeklySeats - a.weeklySeats)

  const stationMap = new Map<string, number>()
  for (const x of enriched) {
    stationMap.set(x.depCode, (stationMap.get(x.depCode) ?? 0) + 1)
  }
  const stationTotal = Array.from(stationMap.values()).reduce((s, v) => s + v, 0)
  const stations: StationRow[] = Array.from(stationMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([station, deps], i) => ({
      station,
      weeklyDeps: Math.round(deps / periodWeeks),
      pct: stationTotal > 0 ? Math.round((deps / stationTotal) * 1000) / 10 : 0,
      isHub: stationTotal > 0 && deps / stationTotal > 0.25,
      color: STATION_COLORS[i % STATION_COLORS.length],
    }))

  return {
    kpis,
    networkSplit,
    fleet,
    trend,
    routes,
    stations,
    acTypeColors,
    uniqueAcTypes,
    uniqueServiceTypes,
    periodDays,
  }
}
