import type { ScheduledFlightRef, AirportRef, AircraftTypeRef } from '@skyhub/api'

export type DirectionMode = 'both' | 'outbound' | 'return'

export interface TimetableFlight {
  id: string
  flightNumber: string
  airlineCode: string
  depStation: string
  arrStation: string
  depCity: string
  arrCity: string
  depCountry: string
  arrCountry: string
  depUtcOffset: number
  arrUtcOffset: number
  stdUtc: string
  staUtc: string
  stdLocal: string
  staLocal: string
  arrivalDayOffset: number
  blockMinutes: number
  aircraftTypeIcao: string
  aircraftName: string
  paxCapacity: number
  serviceType: string
  daysOfWeek: string
  effectiveFrom: string
  effectiveUntil: string
  direction: 'outbound' | 'return'
}

export interface RouteStats {
  flightsPerWeek: number
  dailyMin: number
  dailyMax: number
  avgBlockMinutes: number
  earliest: string
  latest: string
  dayFrequencies: [number, number, number, number, number, number, number]
}

const HHMM_RE = /^(\d{2}):?(\d{2})$/

function parseHhmm(t: string): { h: number; m: number } | null {
  const match = HHMM_RE.exec(t.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return { h, m }
}

function formatHhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function computeLocalTime(utcHhmm: string, offsetHours: number): { local: string; dayShift: number } {
  const parsed = parseHhmm(utcHhmm)
  if (!parsed) return { local: utcHhmm, dayShift: 0 }
  const totalMinutes = parsed.h * 60 + parsed.m + Math.round(offsetHours * 60)
  const dayShift = Math.floor(totalMinutes / 1440)
  const rem = ((totalMinutes % 1440) + 1440) % 1440
  return { local: formatHhmm(Math.floor(rem / 60), rem % 60), dayShift }
}

export function minutesBetween(stdHhmm: string, staHhmm: string): number {
  const a = parseHhmm(stdHhmm)
  const b = parseHhmm(staHhmm)
  if (!a || !b) return 0
  const start = a.h * 60 + a.m
  const end = b.h * 60 + b.m
  let diff = end - start
  if (diff < 0) diff += 1440
  return diff
}

export function countOperatingDays(daysOfWeek: string): number {
  let count = 0
  for (const ch of daysOfWeek) if (ch >= '1' && ch <= '7') count += 1
  return count
}

export function expandDowBitmap(daysOfWeek: string): boolean[] {
  const arr: boolean[] = [false, false, false, false, false, false, false]
  for (const ch of daysOfWeek) {
    const d = Number(ch)
    if (d >= 1 && d <= 7) arr[d - 1] = true
  }
  return arr
}

export function getFrequencyTags(daysOfWeek: string): string[] {
  const count = countOperatingDays(daysOfWeek)
  if (count === 7) return ['Daily']
  const sorted = Array.from(new Set(daysOfWeek.split('')))
    .filter((c) => c >= '1' && c <= '7')
    .sort()
  const key = sorted.join('')
  if (key === '12345') return ['Weekdays']
  if (key === '67') return ['Weekend']
  if (key === '567') return ['Fri-Sun']
  return []
}

function isoToDayOfWeek(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z')
  const js = d.getUTCDay()
  return js === 0 ? 7 : js
}

export function matchesEffectiveDate(
  sf: Pick<ScheduledFlightRef, 'daysOfWeek' | 'effectiveFrom' | 'effectiveUntil'>,
  isoDate: string,
): boolean {
  if (isoDate < sf.effectiveFrom || isoDate > sf.effectiveUntil) return false
  const dow = isoToDayOfWeek(isoDate)
  return sf.daysOfWeek.includes(String(dow))
}

export function overlapsRange(
  sf: Pick<ScheduledFlightRef, 'effectiveFrom' | 'effectiveUntil'>,
  rangeFrom: string,
  rangeTo: string,
): boolean {
  return sf.effectiveFrom <= rangeTo && sf.effectiveUntil >= rangeFrom
}

export function buildTimetableFlight(
  sf: ScheduledFlightRef,
  airports: Map<string, AirportRef>,
  aircraftTypes: Map<string, AircraftTypeRef>,
  direction: 'outbound' | 'return',
): TimetableFlight {
  const depAirport = airports.get(sf.depStation.toUpperCase())
  const arrAirport = airports.get(sf.arrStation.toUpperCase())
  const depUtcOffset = depAirport?.utcOffsetHours ?? 0
  const arrUtcOffset = arrAirport?.utcOffsetHours ?? 0

  const dep = computeLocalTime(sf.stdUtc, depUtcOffset)
  const arr = computeLocalTime(sf.staUtc, arrUtcOffset)
  const baseArrivalDay = sf.arrivalDayOffset ?? 0
  const arrivalDayOffset = baseArrivalDay + (arr.dayShift - dep.dayShift)

  const block = sf.blockMinutes && sf.blockMinutes > 0 ? sf.blockMinutes : minutesBetween(sf.stdUtc, sf.staUtc)

  const acType = sf.aircraftTypeIcao ? aircraftTypes.get(sf.aircraftTypeIcao.toUpperCase()) : undefined

  return {
    id: sf._id,
    flightNumber: `${sf.airlineCode}${sf.flightNumber}`,
    airlineCode: sf.airlineCode,
    depStation: sf.depStation,
    arrStation: sf.arrStation,
    depCity: depAirport?.city ?? sf.depStation,
    arrCity: arrAirport?.city ?? sf.arrStation,
    depCountry: depAirport?.countryName ?? '',
    arrCountry: arrAirport?.countryName ?? '',
    depUtcOffset,
    arrUtcOffset,
    stdUtc: sf.stdUtc,
    staUtc: sf.staUtc,
    stdLocal: dep.local,
    staLocal: arr.local,
    arrivalDayOffset,
    blockMinutes: block,
    aircraftTypeIcao: sf.aircraftTypeIcao ?? '',
    aircraftName: acType?.name ?? sf.aircraftTypeIcao ?? '',
    paxCapacity: acType?.paxCapacity ?? 0,
    serviceType: sf.serviceType || 'J',
    daysOfWeek: sf.daysOfWeek,
    effectiveFrom: sf.effectiveFrom,
    effectiveUntil: sf.effectiveUntil,
    direction,
  }
}

export interface FilterInput {
  from: string
  to: string
  direction: DirectionMode
  dateFrom: string
  dateTo: string
  effectiveDate?: string
}

export function filterScheduledFlights(
  patterns: ScheduledFlightRef[],
  filters: FilterInput,
): { outbound: ScheduledFlightRef[]; return: ScheduledFlightRef[] } {
  const from = filters.from.toUpperCase()
  const to = filters.to.toUpperCase()
  const outbound: ScheduledFlightRef[] = []
  const returnLeg: ScheduledFlightRef[] = []

  for (const sf of patterns) {
    if (sf.status !== 'active') continue
    if (sf.scenarioId) continue
    if (!overlapsRange(sf, filters.dateFrom, filters.dateTo)) continue
    if (filters.effectiveDate && !matchesEffectiveDate(sf, filters.effectiveDate)) continue

    const dep = sf.depStation.toUpperCase()
    const arr = sf.arrStation.toUpperCase()
    if (dep === from && arr === to) outbound.push(sf)
    else if (dep === to && arr === from) returnLeg.push(sf)
  }

  if (filters.direction === 'outbound') return { outbound, return: [] }
  if (filters.direction === 'return') return { outbound: [], return: returnLeg }
  return { outbound, return: returnLeg }
}

export function aggregateRouteStats(flights: TimetableFlight[]): RouteStats {
  if (flights.length === 0) {
    return {
      flightsPerWeek: 0,
      dailyMin: 0,
      dailyMax: 0,
      avgBlockMinutes: 0,
      earliest: '--:--',
      latest: '--:--',
      dayFrequencies: [0, 0, 0, 0, 0, 0, 0],
    }
  }

  const dayFreq: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0]
  let totalBlock = 0
  let earliestMin = Infinity
  let latestMin = -Infinity

  for (const f of flights) {
    const dows = expandDowBitmap(f.daysOfWeek)
    for (let i = 0; i < 7; i += 1) if (dows[i]) dayFreq[i] += 1
    totalBlock += f.blockMinutes

    const dep = parseHhmm(f.stdLocal)
    if (dep) {
      const mins = dep.h * 60 + dep.m
      if (mins < earliestMin) earliestMin = mins
      if (mins > latestMin) latestMin = mins
    }
  }

  const flightsPerWeek = dayFreq.reduce((a, b) => a + b, 0)
  const dailyMin = Math.min(...dayFreq)
  const dailyMax = Math.max(...dayFreq)

  const earliest = earliestMin === Infinity ? '--:--' : formatHhmm(Math.floor(earliestMin / 60), earliestMin % 60)
  const latest = latestMin === -Infinity ? '--:--' : formatHhmm(Math.floor(latestMin / 60), latestMin % 60)

  return {
    flightsPerWeek,
    dailyMin,
    dailyMax,
    avgBlockMinutes: Math.round(totalBlock / flights.length),
    earliest,
    latest,
    dayFrequencies: dayFreq,
  }
}

export function formatDurationHm(mins: number): string {
  if (!mins || mins < 0) return '--'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}
