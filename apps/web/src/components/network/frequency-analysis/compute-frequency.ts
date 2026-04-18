/**
 * Pure derivations for Frequency Analysis.
 *
 * No React, no DOM. Takes raw FrequencyFlightRow[] + filter state and returns
 * memoisable views. Expansion of ScheduledFlight patterns into per-date rows
 * also lives here so the shell stays a thin orchestrator.
 */

import type { AirportRef, ScheduledFlightRef } from '@skyhub/api'
import type {
  DayStats,
  DetailRoute,
  DowDistributionRow,
  FrequencyFilterState,
  FrequencyFlightRow,
  FrequencyKpis,
  PatternBucket,
  PatternKey,
  SortBy,
} from './frequency-analysis-types'

/* ── Date helpers ────────────────────────────────────────── */

export const DAY_MS = 86_400_000
export const DOW_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const
export const DOW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS)
}

export function diffDaysInclusive(a: string, b: string): number {
  return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / DAY_MS) + 1
}

/** ISO day of week: Mon=1 … Sun=7 */
export function getIsoDow(iso: string): number {
  const js = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return js === 0 ? 7 : js
}

export function fmtHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function formatDayTitle(iso: string): string {
  const d = parseIsoDate(iso)
  const dow = DOW_FULL[getIsoDow(iso) - 1]
  return `${dow}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Convert "HHMM" or "HH:MM" → canonical "HH:MM". Tolerates already-canonical input. */
export function normalizeHm(raw: string): string {
  if (!raw) return ''
  const s = raw.includes(':') ? raw : `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
  const [h, m] = s.split(':')
  return `${pad2(parseInt(h, 10) || 0)}:${pad2(parseInt(m, 10) || 0)}`
}

/* ── Frequency pattern classification ────────────────────── */

export function freqFromDow(dow: string): number {
  if (!dow) return 0
  // daysOfWeek is a string of digits "1"…"7"; any char matching 1-7 counts once.
  const seen = new Set<string>()
  for (const c of dow) if (c >= '1' && c <= '7') seen.add(c)
  return seen.size
}

export function getFreqPattern(dow: string): PatternKey {
  const set = new Set<string>()
  for (const c of dow) if (c >= '1' && c <= '7') set.add(c)
  const key = [...set].sort().join('')
  if (key === '1234567') return 'daily'
  if (key === '12345') return 'weekday'
  if (key === '67') return 'weekend'
  if (key === '1357') return 'odd'
  if (key === '246') return 'even'
  return 'other'
}

/* ── Pattern expansion (SF → per-date rows) ──────────────── */

interface ExpandContext {
  airports: AirportRef[]
}

function buildAirportCountryMap(airports: AirportRef[]): Map<string, string | null> {
  const m = new Map<string, string | null>()
  for (const a of airports) {
    const country = a.countryId ?? a.country ?? null
    if (a.iataCode) m.set(a.iataCode.toUpperCase(), country)
    if (a.icaoCode) m.set(a.icaoCode.toUpperCase(), country)
  }
  return m
}

/**
 * Expand ScheduledFlight patterns over [from, to] → one row per (sf, operating date)
 * where the date is within the SF's effective window AND the date's ISO DOW is
 * present in `daysOfWeek`.
 *
 * Mirrors the expansion in server/src/routes/flights.ts:178 but strips all
 * instance-level overlay; we only care about pattern frequency here.
 */
export function expandScheduledFlightsToRows(
  scheduledFlights: ScheduledFlightRef[],
  rangeFromIso: string,
  rangeToIso: string,
  ctx: ExpandContext,
): FrequencyFlightRow[] {
  const countryByStation = buildAirportCountryMap(ctx.airports)
  const fromMs = parseIsoDate(rangeFromIso).getTime()
  const toMs = parseIsoDate(rangeToIso).getTime()
  const out: FrequencyFlightRow[] = []

  for (const sf of scheduledFlights) {
    if (!sf.isActive || sf.status === 'cancelled') continue
    if (sf.scenarioId) continue // production only

    const effFromMs = parseIsoDate(sf.effectiveFrom).getTime()
    const effToMs = parseIsoDate(sf.effectiveUntil).getTime()
    const start = Math.max(effFromMs, fromMs)
    const end = Math.min(effToMs, toMs)
    if (start > end) continue

    const dep = sf.depStation?.toUpperCase() ?? ''
    const arr = sf.arrStation?.toUpperCase() ?? ''
    const depCountry = countryByStation.get(dep) ?? null
    const arrCountry = countryByStation.get(arr) ?? null
    const routeType: FrequencyFlightRow['routeType'] =
      depCountry && arrCountry ? (depCountry === arrCountry ? 'domestic' : 'international') : null

    for (let ms = start; ms <= end; ms += DAY_MS) {
      const iso = new Date(ms).toISOString().slice(0, 10)
      const dow = getIsoDow(iso)
      if (!sf.daysOfWeek.includes(String(dow))) continue

      out.push({
        id: sf._id,
        instanceDate: iso,
        flightNumber: sf.flightNumber,
        depStation: dep,
        arrStation: arr,
        stdUtc: normalizeHm(sf.stdUtc),
        staUtc: normalizeHm(sf.staUtc),
        blockMinutes: sf.blockMinutes ?? 0,
        icaoType: sf.aircraftTypeIcao ?? 'UNKN',
        serviceType: sf.serviceType || 'J',
        routeType,
        daysOfOperation: sf.daysOfWeek,
        periodStart: sf.effectiveFrom,
        periodEnd: sf.effectiveUntil,
      })
    }
  }

  return out
}

/* ── Filtering + dedup ───────────────────────────────────── */

export function applyFilters(rows: FrequencyFlightRow[], f: FrequencyFilterState): FrequencyFlightRow[] {
  const q = f.searchQuery.trim().toLowerCase()
  const typeSet = f.selectedTypes
  const station = f.selectedStation.toUpperCase()
  const route = f.selectedRoute.toUpperCase()
  const svc = f.selectedServiceType

  return rows.filter((r) => {
    if (typeSet.size > 0 && !typeSet.has(r.icaoType)) return false
    if (station && r.depStation !== station && r.arrStation !== station) return false
    if (route) {
      const parts = route.split('-')
      if (parts.length === 2 && (r.depStation !== parts[0] || r.arrStation !== parts[1])) return false
    }
    if (f.selectedRouteType !== 'all' && r.routeType !== f.selectedRouteType) return false
    if (svc && r.serviceType !== svc) return false
    if (q) {
      const hay = `${r.flightNumber} ${r.depStation} ${r.arrStation} ${r.icaoType}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Dedup to one row per scheduled-flight id. Keeps the first occurrence. */
export function dedupFlights(rows: FrequencyFlightRow[]): FrequencyFlightRow[] {
  const seen = new Set<string>()
  const out: FrequencyFlightRow[] = []
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}

/* ── Derived views ───────────────────────────────────────── */

export function buildDayStats(
  instances: FrequencyFlightRow[],
  dateFrom: string,
  dateTo: string,
): { byDate: Map<string, DayStats>; dates: string[] } {
  const byDate = new Map<string, DayStats>()
  const dates: string[] = []
  const startMs = parseIsoDate(dateFrom).getTime()
  const endMs = parseIsoDate(dateTo).getTime()
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const iso = new Date(ms).toISOString().slice(0, 10)
    const dow = getIsoDow(iso)
    const d = new Date(`${iso}T00:00:00Z`)
    byDate.set(iso, {
      date: iso,
      dow,
      dowLabel: DOW_SHORT[dow - 1],
      dateNum: d.getUTCDate(),
      total: 0,
      byType: new Map(),
      byRoute: new Map(),
      blockMinutes: 0,
    })
    dates.push(iso)
  }

  for (const r of instances) {
    const entry = byDate.get(r.instanceDate)
    if (!entry) continue
    entry.total += 1
    entry.byType.set(r.icaoType, (entry.byType.get(r.icaoType) ?? 0) + 1)
    const routeKey = `${r.depStation}-${r.arrStation}`
    entry.byRoute.set(routeKey, (entry.byRoute.get(routeKey) ?? 0) + 1)
    entry.blockMinutes += r.blockMinutes
  }

  return { byDate, dates }
}

export function computeKpis(
  flights: FrequencyFlightRow[],
  instances: FrequencyFlightRow[],
  dayStats: Map<string, DayStats>,
): FrequencyKpis {
  const uniqueFlights = flights.length

  let weeklyDeps = 0
  let weeklyBlockMin = 0
  const routeSet = new Set<string>()
  for (const f of flights) {
    const freq = freqFromDow(f.daysOfOperation)
    weeklyDeps += freq
    weeklyBlockMin += freq * f.blockMinutes
    routeSet.add(`${f.depStation}-${f.arrStation}`)
  }

  let peakCount = 0
  let peakDow = ''
  let daysWithFlights = 0
  let totalInstances = 0
  dayStats.forEach((s) => {
    totalInstances += s.total
    if (s.total > 0) daysWithFlights += 1
    if (s.total > peakCount) {
      peakCount = s.total
      peakDow = DOW_FULL[s.dow - 1]
    }
  })
  const avgDaily = daysWithFlights > 0 ? Math.round(totalInstances / daysWithFlights) : 0

  return {
    uniqueFlights,
    weeklyDeps,
    avgDaily,
    peakCount,
    peakDow,
    weeklyBlockMin,
    routeCount: routeSet.size,
  }
}

export function bucketByPattern(flights: FrequencyFlightRow[]): PatternBucket {
  const buckets: PatternBucket = {
    total: flights.length,
    daily: [],
    weekday: [],
    weekend: [],
    odd: [],
    even: [],
    other: [],
    uniqueOther: 0,
  }
  const otherKeys = new Set<string>()
  for (const f of flights) {
    const key = getFreqPattern(f.daysOfOperation)
    buckets[key].push(f)
    if (key === 'other') otherKeys.add(f.daysOfOperation)
  }
  buckets.uniqueOther = otherKeys.size
  return buckets
}

export function computeDowDistribution(instances: FrequencyFlightRow[]): DowDistributionRow[] {
  const rows: DowDistributionRow[] = DOW_SHORT.map((label, i) => ({
    dow: i + 1,
    label,
    byType: new Map(),
    total: 0,
  }))
  for (const inst of instances) {
    const dow = getIsoDow(inst.instanceDate)
    const row = rows[dow - 1]
    row.total += 1
    row.byType.set(inst.icaoType, (row.byType.get(inst.icaoType) ?? 0) + 1)
  }
  return rows
}

export function computeHeatmapMax(dayStats: Map<string, DayStats>): {
  total: number
  byType: Map<string, number>
} {
  let total = 0
  const byType = new Map<string, number>()
  dayStats.forEach((s) => {
    if (s.total > total) total = s.total
    s.byType.forEach((v, k) => {
      if (v > (byType.get(k) ?? 0)) byType.set(k, v)
    })
  })
  return { total, byType }
}

export function computeDetailRoutes(
  flights: FrequencyFlightRow[],
  instances: FrequencyFlightRow[],
  sortBy: SortBy,
): DetailRoute[] {
  const instCountByFlight = new Map<string, number>()
  for (const i of instances) instCountByFlight.set(i.id, (instCountByFlight.get(i.id) ?? 0) + 1)

  const grouped = new Map<string, FrequencyFlightRow[]>()
  for (const f of flights) {
    const key = `${f.depStation}-${f.arrStation}`
    const arr = grouped.get(key)
    if (arr) arr.push(f)
    else grouped.set(key, [f])
  }

  const routes: DetailRoute[] = []
  grouped.forEach((rs, route) => {
    let weeklyFreq = 0
    let weeklyBlockMin = 0
    let totalDeps = 0
    const typeSet = new Set<string>()
    for (const f of rs) {
      const freq = freqFromDow(f.daysOfOperation)
      weeklyFreq += freq
      weeklyBlockMin += freq * f.blockMinutes
      typeSet.add(f.icaoType)
      totalDeps += instCountByFlight.get(f.id) ?? 0
    }
    routes.push({
      route,
      flights: rs.slice().sort(sortFlights(sortBy)),
      weeklyFreq,
      weeklyBlockMin,
      types: [...typeSet].sort(),
      totalDeps,
    })
  })

  return routes.sort((a, b) => {
    if (sortBy === 'block') return b.weeklyBlockMin - a.weeklyBlockMin
    if (sortBy === 'flight') return a.route.localeCompare(b.route)
    return b.weeklyFreq - a.weeklyFreq
  })
}

function sortFlights(sortBy: SortBy) {
  return (a: FrequencyFlightRow, b: FrequencyFlightRow): number => {
    if (sortBy === 'block') return b.blockMinutes - a.blockMinutes
    if (sortBy === 'flight') return a.flightNumber.localeCompare(b.flightNumber)
    return freqFromDow(b.daysOfOperation) - freqFromDow(a.daysOfOperation)
  }
}

/* ── Filter option builders ──────────────────────────────── */

export function uniqueStationOptions(rows: FrequencyFlightRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) {
    if (r.depStation) set.add(r.depStation)
    if (r.arrStation) set.add(r.arrStation)
  }
  return [...set].sort()
}

export function uniqueRouteOptions(rows: FrequencyFlightRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) set.add(`${r.depStation}-${r.arrStation}`)
  return [...set].sort()
}

export function uniqueServiceTypes(rows: FrequencyFlightRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) if (r.serviceType) set.add(r.serviceType)
  return [...set].sort()
}

export function uniqueAircraftTypes(rows: FrequencyFlightRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) if (r.icaoType) set.add(r.icaoType)
  return [...set].sort()
}

/* ── Default + empty helpers ─────────────────────────────── */

export function emptyKpis(): FrequencyKpis {
  return {
    uniqueFlights: 0,
    weeklyDeps: 0,
    avgDaily: 0,
    peakCount: 0,
    peakDow: '',
    weeklyBlockMin: 0,
    routeCount: 0,
  }
}

export function defaultFilterState(): FrequencyFilterState {
  const today = new Date()
  const from = formatIso(today)
  const to = formatIso(addDays(today, 29))
  return {
    dateFrom: from,
    dateTo: to,
    selectedTypes: new Set(),
    selectedStation: '',
    selectedRoute: '',
    selectedRouteType: 'all',
    selectedServiceType: '',
    searchQuery: '',
    sortBy: 'freq',
  }
}
