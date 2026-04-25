// Pure helpers for the Gantt detail sheet tabs. No React, no Skia — usable
// from any tab to compute aggregates, format times/durations, and find
// related flights from the store data.

import type { GanttFlight } from '@skyhub/types'
import { getDisplayTimes } from '@skyhub/logic'

const HOUR_MS = 3_600_000

export function fmtUtcTime(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function fmtUtcDateTime(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const d = new Date(ms)
  return `${d.toISOString().slice(0, 10)} ${fmtUtcTime(ms)}Z`
}

export function fmtDuration(ms: number): string {
  if (ms < 0) return `-${fmtDuration(-ms)}`
  const totalMin = Math.round(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function fmtBlock(minutes: number): string {
  return fmtDuration(minutes * 60_000)
}

/** Total block hours for a flight set. */
export function totalBlockHours(flights: GanttFlight[]): number {
  return flights.reduce((s, f) => s + f.blockMinutes, 0) / 60
}

/** Flights belonging to a rotation (sorted by sequence then time). */
export function rotationFlights(flights: GanttFlight[], rotationId: string): GanttFlight[] {
  return flights
    .filter((f) => f.rotationId === rotationId)
    .sort((a, b) => (a.rotationSequence ?? 0) - (b.rotationSequence ?? 0) || a.stdUtc - b.stdUtc)
}

/** TAT (turnaround) ms between consecutive arrivals → departures in a rotation. */
export function tatBetween(prev: GanttFlight, next: GanttFlight): number {
  const prevArr = getDisplayTimes(prev).arrMs
  const nextDep = getDisplayTimes(next).depMs
  return nextDep - prevArr
}

/** Flights for a single registration over the whole period. */
export function aircraftFlights(flights: GanttFlight[], registration: string): GanttFlight[] {
  return flights.filter((f) => f.aircraftReg === registration).sort((a, b) => a.stdUtc - b.stdUtc)
}

/** Build the chain of overnight stations for one aircraft. */
export function overnightStations(flights: GanttFlight[]): { date: string; station: string }[] {
  const byDate = new Map<string, GanttFlight[]>()
  for (const f of flights) {
    const list = byDate.get(f.operatingDate) ?? []
    list.push(f)
    byDate.set(f.operatingDate, list)
  }
  const out: { date: string; station: string }[] = []
  for (const [date, list] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    list.sort((a, b) => a.stdUtc - b.stdUtc)
    out.push({ date, station: list[list.length - 1].arrStation })
  }
  return out
}

/** Aircraft daily utilization for the selected flight's date. */
export function aircraftDailyUtil(
  flights: GanttFlight[],
  registration: string,
  date: string,
): { count: number; blockHours: number; utilizationPct: number } {
  const same = flights.filter((f) => f.aircraftReg === registration && f.operatingDate === date)
  const blockHours = totalBlockHours(same)
  // 24-hour day basis — utilization is block hours / 24h.
  const utilizationPct = Math.round((blockHours / 24) * 100)
  return { count: same.length, blockHours, utilizationPct }
}

/** Day breakdown by AC type. */
export function dayAcTypeBreakdown(
  flights: GanttFlight[],
  date: string,
): { type: string; count: number; blockHours: number }[] {
  const same = flights.filter((f) => f.operatingDate === date)
  const map = new Map<string, GanttFlight[]>()
  for (const f of same) {
    const k = f.aircraftTypeIcao ?? 'UNKN'
    const list = map.get(k) ?? []
    list.push(f)
    map.set(k, list)
  }
  return [...map.entries()]
    .map(([type, list]) => ({ type, count: list.length, blockHours: totalBlockHours(list) }))
    .sort((a, b) => b.count - a.count)
}

/** Period summary for one aircraft. */
export function aircraftPeriodSummary(
  flights: GanttFlight[],
  registration: string,
): { count: number; blockHours: number; days: number; avgPerDay: number } {
  const same = aircraftFlights(flights, registration)
  const days = new Set(same.map((f) => f.operatingDate)).size || 1
  const blockHours = totalBlockHours(same)
  return { count: same.length, blockHours, days, avgPerDay: blockHours / days }
}
