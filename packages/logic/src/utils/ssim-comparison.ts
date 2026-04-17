/**
 * SSIM Comparison — pure analytics for module 1.2.3.
 *
 * Given two parsed SSIM files and a UTC date range, expand each file into
 * dated legs (concrete instances of each SSIM carrier record), aggregate
 * stats per aircraft type / route / day / station, and diff the two sets
 * at the flight-number level.
 *
 * No I/O, no dates-as-objects-across-tz; everything keyed to UTC epoch
 * days so two files parsed in different timezones produce identical
 * results. Consumers (web/server) supply airport coordinates for ASK.
 */

import { calculateGreatCircleDistance } from './geo'
import type { SSIMFlightLeg, SSIMParseResult } from './ssim-parser'

// ---- Types ------------------------------------------------------------------

export interface DatedLeg {
  /** UTC date the leg departs (YYYY-MM-DD). Overnight arrival may fall on date+1. */
  date: string
  epochDay: number
  dep: string
  arr: string
  aircraftType: string
  airlineCode: string
  flightNumber: number
  suffix: string
  serviceType: string
  /** Minutes-of-day UTC at departure (0..1439). */
  stdUtcMin: number
  /** Minutes-of-day UTC at arrival; may exceed 1440 when the leg crosses midnight. */
  staUtcMin: number
  blockMinutes: number
  totalCapacity: number
  seatConfig: Record<string, number>
}

export interface AirportCoord {
  iata: string
  latitude: number
  longitude: number
}

export interface AircraftTypeStat {
  aircraftType: string
  flights: number
  blockHours: number
  seatsOffered: number
  askKm: number
  peakTails: number
  utilizationBhPerAcPerDay: number
}

export interface RouteStat {
  dep: string
  arr: string
  frequency: number
  blockHours: number
  seatsOffered: number
  distanceKm: number | null
}

export interface StationStat {
  station: string
  departures: number
  arrivals: number
}

export interface DailyCount {
  date: string
  flights: number
  blockHours: number
  seatsOffered: number
}

export interface SsimAggregate {
  flights: number
  blockHours: number
  seatsOffered: number
  /** Available seat-km. Partial when `missingAirports` is non-empty. */
  askKm: number
  /** Sum of peak-concurrent tails across aircraft types (tails of different types aren't interchangeable). */
  totalPeakTails: number
  utilizationBhPerAcPerDay: number
  avgStageHours: number
  byAircraftType: AircraftTypeStat[]
  byRoute: RouteStat[]
  byStation: StationStat[]
  byDay: DailyCount[]
  askIncomplete: boolean
  missingAirports: string[]
}

export interface FlightChange {
  airlineCode: string
  flightNumber: number
  dep: string
  arr: string
  periodStart: string
  changedFields: Array<keyof SSIMFlightLeg>
  before: SSIMFlightLeg
  after: SSIMFlightLeg
}

export interface FlightDiff {
  removed: SSIMFlightLeg[]
  added: SSIMFlightLeg[]
  changed: FlightChange[]
}

export interface CompareOpts {
  /** Inclusive UTC start date, ISO YYYY-MM-DD. */
  from: string
  /** Inclusive UTC end date, ISO YYYY-MM-DD. */
  to: string
  aircraftTypeFilter?: string[]
  airports?: AirportCoord[]
}

export interface SsimComparisonReport {
  range: { from: string; to: string; days: number }
  a: SsimAggregate
  b: SsimAggregate
  diff: FlightDiff
  notes: string[]
}

// ---- Date / time helpers (UTC only) ----------------------------------------

const MS_PER_DAY = 86_400_000

/** YYYY-MM-DD → epoch-day (days since 1970-01-01 UTC). Returns NaN on invalid input. */
export function isoToEpochDay(iso: string): number {
  if (!iso || iso.length < 10) return NaN
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN
  const ms = Date.UTC(y, m - 1, d)
  return Math.floor(ms / MS_PER_DAY)
}

/** Epoch-day → ISO YYYY-MM-DD. */
export function epochDayToIso(ed: number): string {
  const d = new Date(ed * MS_PER_DAY)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const da = d.getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(da).padStart(2, '0')}`
}

/** Epoch-day → SSIM DOW position (0=Mon … 6=Sun). */
export function epochDayToSsimDow(ed: number): number {
  // 1970-01-01 (epochDay 0) is a Thursday. JS getUTCDay = 4.
  // SSIM: 0=Mon. (jsDow + 6) % 7 maps Sun(0)→6, Mon(1)→0, … Sat(6)→5.
  const d = new Date(ed * MS_PER_DAY)
  return (d.getUTCDay() + 6) % 7
}

/** HHMM string → minutes-of-day (returns NaN on invalid). */
function hhmmToMin(hhmm: string): number {
  if (!hhmm || hhmm.length < 4) return NaN
  const h = Number(hhmm.slice(0, 2))
  const m = Number(hhmm.slice(2, 4))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN
  return h * 60 + m
}

// ---- Leg expansion ---------------------------------------------------------

/**
 * Expand an array of SSIM carrier records into concrete dated legs within
 * the inclusive [fromIso, toIso] UTC range. Each record produces one leg
 * per operating day where the DOW pattern matches.
 */
export function expandSsimToDatedLegs(flights: SSIMFlightLeg[], fromIso: string, toIso: string): DatedLeg[] {
  const rangeStart = isoToEpochDay(fromIso)
  const rangeEnd = isoToEpochDay(toIso)
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd < rangeStart) return []

  const out: DatedLeg[] = []

  for (const f of flights) {
    const pStart = isoToEpochDay(f.periodStart)
    const pEnd = isoToEpochDay(f.periodEnd)
    if (!Number.isFinite(pStart) || !Number.isFinite(pEnd)) continue

    const overlapStart = Math.max(pStart, rangeStart)
    const overlapEnd = Math.min(pEnd, rangeEnd)
    if (overlapEnd < overlapStart) continue

    const stdMin = hhmmToMin(f.stdUtc)
    let staMin = hhmmToMin(f.staUtc)
    if (!Number.isFinite(stdMin) || !Number.isFinite(staMin)) continue
    if (staMin <= stdMin) staMin += 1440

    const dow = f.daysOfOperation || ''

    for (let ed = overlapStart; ed <= overlapEnd; ed++) {
      const pos = epochDayToSsimDow(ed)
      const marker = dow[pos]
      if (!marker || marker === ' ') continue

      out.push({
        date: epochDayToIso(ed),
        epochDay: ed,
        dep: f.depStation,
        arr: f.arrStation,
        aircraftType: f.aircraftType,
        airlineCode: f.airlineCode,
        flightNumber: f.flightNumber,
        suffix: f.suffix,
        serviceType: f.serviceType,
        stdUtcMin: stdMin,
        staUtcMin: staMin,
        blockMinutes: f.blockMinutes || staMin - stdMin,
        totalCapacity: f.totalCapacity,
        seatConfig: f.seatConfig,
      })
    }
  }

  return out
}

// ---- Aggregation -----------------------------------------------------------

const NM_TO_KM = 1.852

interface AggregateCtx {
  airports: Map<string, AirportCoord>
  daysInRange: number
  aircraftTypeFilter: Set<string> | null
}

function buildCtx(opts: CompareOpts): AggregateCtx {
  const airports = new Map<string, AirportCoord>()
  for (const a of opts.airports ?? []) {
    if (a.iata) airports.set(a.iata.toUpperCase(), a)
  }
  const filter =
    opts.aircraftTypeFilter && opts.aircraftTypeFilter.length > 0
      ? new Set(opts.aircraftTypeFilter.map((s) => s.toUpperCase()))
      : null
  const days = isoToEpochDay(opts.to) - isoToEpochDay(opts.from) + 1
  return { airports, aircraftTypeFilter: filter, daysInRange: Math.max(1, days) }
}

function routeDistanceKm(dep: string, arr: string, airports: Map<string, AirportCoord>): number | null {
  const a = airports.get(dep.toUpperCase())
  const b = airports.get(arr.toUpperCase())
  if (!a || !b) return null
  const nm = calculateGreatCircleDistance(a.latitude, a.longitude, b.latitude, b.longitude)
  return nm * NM_TO_KM
}

/** Peak-concurrency sweep across legs of a single aircraft type. */
function peakConcurrentTails(legs: DatedLeg[]): number {
  if (legs.length === 0) return 0
  const events: Array<[number, number]> = []
  for (const l of legs) {
    const dep = l.epochDay * 1440 + l.stdUtcMin
    const arr = l.epochDay * 1440 + l.staUtcMin
    events.push([dep, +1])
    events.push([arr, -1])
  }
  // Sort by time; within the same instant, process arrivals (-1) before
  // departures (+1) so that back-to-back legs on one airframe don't
  // double-count — this yields the *minimum* concurrent tails, which is
  // what we want for a utilization-upper-bound metric.
  events.sort((x, y) => (x[0] !== y[0] ? x[0] - y[0] : x[1] - y[1]))
  let cur = 0
  let peak = 0
  for (const [, delta] of events) {
    cur += delta
    if (cur > peak) peak = cur
  }
  return peak
}

/**
 * Aggregate dated legs into one SsimAggregate. Pass only legs you want
 * counted (i.e. already date- and type-filtered).
 */
export function aggregateSsim(legs: DatedLeg[], ctx: AggregateCtx): SsimAggregate {
  let flights = 0
  let blockMinutes = 0
  let seatsOffered = 0
  let askKm = 0
  const missingAirports = new Set<string>()

  const byTypeMap = new Map<string, DatedLeg[]>()
  const byRouteMap = new Map<string, { dep: string; arr: string; freq: number; block: number; seats: number }>()
  const byStationMap = new Map<string, { station: string; departures: number; arrivals: number }>()
  const byDayMap = new Map<string, { flights: number; blockMinutes: number; seats: number }>()

  for (const leg of legs) {
    flights += 1
    blockMinutes += leg.blockMinutes
    seatsOffered += leg.totalCapacity

    const dist = routeDistanceKm(leg.dep, leg.arr, ctx.airports)
    if (dist == null) {
      if (!ctx.airports.has(leg.dep.toUpperCase())) missingAirports.add(leg.dep)
      if (!ctx.airports.has(leg.arr.toUpperCase())) missingAirports.add(leg.arr)
    } else {
      askKm += leg.totalCapacity * dist
    }

    // By type
    const bucket = byTypeMap.get(leg.aircraftType)
    if (bucket) bucket.push(leg)
    else byTypeMap.set(leg.aircraftType, [leg])

    // By route
    const routeKey = `${leg.dep}-${leg.arr}`
    const route = byRouteMap.get(routeKey)
    if (route) {
      route.freq += 1
      route.block += leg.blockMinutes
      route.seats += leg.totalCapacity
    } else {
      byRouteMap.set(routeKey, {
        dep: leg.dep,
        arr: leg.arr,
        freq: 1,
        block: leg.blockMinutes,
        seats: leg.totalCapacity,
      })
    }

    // By station
    const dep = byStationMap.get(leg.dep) ?? { station: leg.dep, departures: 0, arrivals: 0 }
    dep.departures += 1
    byStationMap.set(leg.dep, dep)
    const arr = byStationMap.get(leg.arr) ?? { station: leg.arr, departures: 0, arrivals: 0 }
    arr.arrivals += 1
    byStationMap.set(leg.arr, arr)

    // By day
    const day = byDayMap.get(leg.date) ?? { flights: 0, blockMinutes: 0, seats: 0 }
    day.flights += 1
    day.blockMinutes += leg.blockMinutes
    day.seats += leg.totalCapacity
    byDayMap.set(leg.date, day)
  }

  // Finalize by-type
  const byAircraftType: AircraftTypeStat[] = []
  let totalPeakTails = 0
  for (const [aircraftType, typeLegs] of byTypeMap) {
    const typeBlockMin = typeLegs.reduce((s, l) => s + l.blockMinutes, 0)
    const typeSeats = typeLegs.reduce((s, l) => s + l.totalCapacity, 0)
    const typeAsk = typeLegs.reduce((s, l) => {
      const dist = routeDistanceKm(l.dep, l.arr, ctx.airports)
      return dist == null ? s : s + l.totalCapacity * dist
    }, 0)
    const peak = peakConcurrentTails(typeLegs)
    totalPeakTails += peak
    byAircraftType.push({
      aircraftType,
      flights: typeLegs.length,
      blockHours: round1(typeBlockMin / 60),
      seatsOffered: typeSeats,
      askKm: Math.round(typeAsk),
      peakTails: peak,
      utilizationBhPerAcPerDay:
        peak > 0 && ctx.daysInRange > 0 ? round2(typeBlockMin / 60 / peak / ctx.daysInRange) : 0,
    })
  }
  byAircraftType.sort((a, b) => b.flights - a.flights)

  // Finalize routes
  const byRoute: RouteStat[] = []
  for (const r of byRouteMap.values()) {
    byRoute.push({
      dep: r.dep,
      arr: r.arr,
      frequency: r.freq,
      blockHours: round1(r.block / 60),
      seatsOffered: r.seats,
      distanceKm: routeDistanceKm(r.dep, r.arr, ctx.airports),
    })
  }
  byRoute.sort((a, b) => b.frequency - a.frequency)

  // Finalize stations
  const byStation: StationStat[] = [...byStationMap.values()].sort(
    (a, b) => b.departures + b.arrivals - (a.departures + a.arrivals),
  )

  // Finalize days — fill gaps so the chart renders a continuous axis
  const byDay: DailyCount[] = [...byDayMap.entries()]
    .map(([date, d]) => ({
      date,
      flights: d.flights,
      blockHours: round1(d.blockMinutes / 60),
      seatsOffered: d.seats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const blockHours = blockMinutes / 60
  return {
    flights,
    blockHours: round1(blockHours),
    seatsOffered,
    askKm: Math.round(askKm),
    totalPeakTails,
    utilizationBhPerAcPerDay:
      totalPeakTails > 0 && ctx.daysInRange > 0 ? round2(blockHours / totalPeakTails / ctx.daysInRange) : 0,
    avgStageHours: flights > 0 ? round2(blockHours / flights) : 0,
    byAircraftType,
    byRoute,
    byStation,
    byDay,
    askIncomplete: missingAirports.size > 0,
    missingAirports: [...missingAirports].sort(),
  }
}

// ---- Flight diff -----------------------------------------------------------

/** Match key at the flight-number / OD / season level. */
function flightKey(f: SSIMFlightLeg): string {
  return `${f.airlineCode}|${f.flightNumber}|${f.depStation}|${f.arrStation}|${f.periodStart}`
}

/** Fields we report as "changed" when two matched records differ. */
const CHANGE_FIELDS: Array<keyof SSIMFlightLeg> = [
  'periodEnd',
  'daysOfOperation',
  'stdUtc',
  'staUtc',
  'aircraftType',
  'totalCapacity',
  'serviceType',
]

function detectChanges(before: SSIMFlightLeg, after: SSIMFlightLeg): Array<keyof SSIMFlightLeg> {
  const diffs: Array<keyof SSIMFlightLeg> = []
  for (const k of CHANGE_FIELDS) {
    if (before[k] !== after[k]) diffs.push(k)
  }
  return diffs
}

export function diffSsimFlights(a: SSIMFlightLeg[], b: SSIMFlightLeg[]): FlightDiff {
  const aMap = new Map<string, SSIMFlightLeg>()
  const bMap = new Map<string, SSIMFlightLeg>()
  for (const f of a) aMap.set(flightKey(f), f)
  for (const f of b) bMap.set(flightKey(f), f)

  const removed: SSIMFlightLeg[] = []
  const added: SSIMFlightLeg[] = []
  const changed: FlightChange[] = []

  for (const [key, before] of aMap) {
    const after = bMap.get(key)
    if (!after) {
      removed.push(before)
      continue
    }
    const changedFields = detectChanges(before, after)
    if (changedFields.length > 0) {
      changed.push({
        airlineCode: before.airlineCode,
        flightNumber: before.flightNumber,
        dep: before.depStation,
        arr: before.arrStation,
        periodStart: before.periodStart,
        changedFields,
        before,
        after,
      })
    }
  }

  for (const [key, after] of bMap) {
    if (!aMap.has(key)) added.push(after)
  }

  return { removed, added, changed }
}

// ---- Top-level compare -----------------------------------------------------

export function compareSsim(a: SSIMParseResult, b: SSIMParseResult, opts: CompareOpts): SsimComparisonReport {
  const ctx = buildCtx(opts)
  const filter = ctx.aircraftTypeFilter

  const legsA = expandSsimToDatedLegs(a.flights, opts.from, opts.to).filter(
    (l) => !filter || filter.has(l.aircraftType.toUpperCase()),
  )
  const legsB = expandSsimToDatedLegs(b.flights, opts.from, opts.to).filter(
    (l) => !filter || filter.has(l.aircraftType.toUpperCase()),
  )

  const aggA = aggregateSsim(legsA, ctx)
  const aggB = aggregateSsim(legsB, ctx)

  // Diff raw SSIM records (not dated legs) so periods / DOW show up as
  // "changed" rather than as a flood of added/removed individual days.
  const aFlights = filter ? a.flights.filter((f) => filter.has(f.aircraftType.toUpperCase())) : a.flights
  const bFlights = filter ? b.flights.filter((f) => filter.has(f.aircraftType.toUpperCase())) : b.flights
  const diff = diffSsimFlights(aFlights, bFlights)

  const notes: string[] = []
  const missing = new Set<string>([...aggA.missingAirports, ...aggB.missingAirports])
  if (missing.size > 0) {
    notes.push(
      `ASK is partial — ${missing.size} airport coord${missing.size === 1 ? '' : 's'} missing: ${[...missing].sort().join(', ')}`,
    )
  }

  return {
    range: { from: opts.from, to: opts.to, days: ctx.daysInRange },
    a: aggA,
    b: aggB,
    diff,
    notes,
  }
}

// ---- Small utilities -------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
