'use client'

import { create } from 'zustand'
import type { Flight, AirportRef, AircraftRegistrationRef, AircraftTypeRef } from '@skyhub/api'

/* ── Types ── */

export type TimeMode = 'utc' | 'localBase' | 'localStation'
export type SortSequence = 'date-std' | 'date-reg-std' | 'reg-date-std' | 'flt-date'

export const COLUMN_DEFS = [
  { id: 'date', label: 'Date', flex: 1 },
  { id: 'dow', label: 'Weekday', flex: 0.8 },
  { id: 'acType', label: 'AC Type', flex: 0.8 },
  { id: 'acReg', label: 'AC Reg', flex: 1 },
  { id: 'flt', label: 'Flight No.', flex: 1 },
  { id: 'dep', label: 'DEP', flex: 0.6 },
  { id: 'arr', label: 'ARR', flex: 0.6 },
  { id: 'std', label: 'STD', flex: 0.8 },
  { id: 'sta', label: 'STA', flex: 0.8 },
  { id: 'svc', label: 'Flight Service Type', flex: 1.3 },
  { id: 'block', label: 'Block', flex: 0.7 },
  { id: 'route', label: 'Route', flex: 0.7 },
] as const

export type ColumnId = (typeof COLUMN_DEFS)[number]['id']

/** Snapshot of filter values at the time Go was clicked */
export interface CommittedFilters {
  timeFrom: string
  timeTo: string
  acTypes: Set<string> | null
  acRegs: Set<string> | null
  domInt: 'all' | 'dom' | 'int'
  statuses: Set<string> | null
  showCancelled: boolean
}

export interface DailyScheduleState {
  /* ── Data ── */
  flights: Flight[]
  airportMap: Record<string, { utcOffset: number; countryId: string | null }>
  regToTypeMap: Record<string, string>
  homeBaseOffset: number

  /* ── Filter state (UI — user is editing these before clicking Go) ── */
  dateFrom: string
  dateTo: string
  timeFrom: string
  timeTo: string
  acTypes: Set<string> | null
  acRegs: Set<string> | null
  domInt: 'all' | 'dom' | 'int'
  statuses: Set<string> | null
  showCancelled: boolean

  /* ── Committed filter snapshot (applied to data) ── */
  committed: CommittedFilters | null

  /* ── Display ── */
  timeModes: Set<TimeMode>
  sortSequence: SortSequence
  columnOrder: ColumnId[]
  hiddenColumns: Set<ColumnId>
  compactMode: boolean

  /* ── Actions ── */
  setFlights: (
    flights: Flight[],
    airports: AirportRef[],
    regs?: AircraftRegistrationRef[],
    acTypes?: AircraftTypeRef[],
  ) => void
  commitFilters: () => void
  setDateRange: (from: string, to: string) => void
  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  setTimeRange: (from: string, to: string) => void
  setAcTypes: (v: Set<string> | null) => void
  setAcRegs: (v: Set<string> | null) => void
  setDomInt: (v: 'all' | 'dom' | 'int') => void
  setStatuses: (v: Set<string> | null) => void
  setShowCancelled: (v: boolean) => void
  toggleTimeMode: (mode: TimeMode) => void
  setSortSequence: (v: SortSequence) => void
  setColumnOrder: (order: ColumnId[]) => void
  toggleColumn: (col: ColumnId) => void
  setCompactMode: (v: boolean) => void
  reset: () => void
}

/* ── Helpers ── */

function deriveHomeBaseOffset(flights: Flight[], airportMap: Record<string, { utcOffset: number }>): number {
  const counts = new Map<number, number>()
  for (const f of flights) {
    const offset = airportMap[f.dep.icao]?.utcOffset
    if (offset != null) counts.set(offset, (counts.get(offset) ?? 0) + 1)
  }
  let best = 7
  let bestCount = 0
  counts.forEach((c, o) => {
    if (c > bestCount) {
      best = o
      bestCount = c
    }
  })
  return best
}

function buildAirportMap(airports: AirportRef[]): Record<string, { utcOffset: number; countryId: string | null }> {
  const map: Record<string, { utcOffset: number; countryId: string | null }> = {}
  for (const a of airports) {
    if (a.icaoCode) map[a.icaoCode] = { utcOffset: a.utcOffsetHours ?? 0, countryId: a.countryId ?? null }
  }
  return map
}

const DEFAULT_COLUMN_ORDER: ColumnId[] = COLUMN_DEFS.map((c) => c.id)

/* ── Store ── */

export const useDailyScheduleStore = create<DailyScheduleState>((set, get) => ({
  flights: [],
  airportMap: {},
  regToTypeMap: {},
  homeBaseOffset: 7,

  dateFrom: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
  acTypes: null,
  acRegs: null,
  domInt: 'all',
  statuses: null,
  showCancelled: false,

  committed: null,

  timeModes: new Set<TimeMode>(['utc']),
  sortSequence: 'date-reg-std',
  columnOrder: [...DEFAULT_COLUMN_ORDER],
  hiddenColumns: new Set<ColumnId>(['dow']),
  compactMode: false,

  setFlights: (flights, airports, regs, acTypes) => {
    const airportMap = buildAirportMap(airports)
    const homeBaseOffset = deriveHomeBaseOffset(flights, airportMap)
    const regToTypeMap: Record<string, string> = {}
    if (regs && acTypes) {
      const typeIdToIcao = new Map(acTypes.map((t) => [t._id, t.icaoType]))
      for (const r of regs) {
        const icao = typeIdToIcao.get(r.aircraftTypeId)
        if (r.registration && icao) regToTypeMap[r.registration] = icao
      }
    }
    set({ flights, airportMap, homeBaseOffset, regToTypeMap })
  },

  commitFilters: () => {
    const s = get()
    set({
      committed: {
        timeFrom: s.timeFrom,
        timeTo: s.timeTo,
        acTypes: s.acTypes,
        acRegs: s.acRegs,
        domInt: s.domInt,
        statuses: s.statuses,
        showCancelled: s.showCancelled,
      },
    })
  },

  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),
  setDateFrom: (v) => set({ dateFrom: v }),
  setDateTo: (v) => set({ dateTo: v }),
  setTimeRange: (from, to) => set({ timeFrom: from, timeTo: to }),
  setAcTypes: (v) => set({ acTypes: v }),
  setAcRegs: (v) => set({ acRegs: v }),
  setDomInt: (v) => set({ domInt: v }),
  setStatuses: (v) => set({ statuses: v }),
  setShowCancelled: (v) => set({ showCancelled: v }),

  toggleTimeMode: (mode) => {
    const next = new Set(get().timeModes)
    if (next.has(mode)) {
      if (next.size > 1) next.delete(mode)
    } else next.add(mode)
    set({ timeModes: next })
  },

  setSortSequence: (v) => set({ sortSequence: v }),
  setColumnOrder: (order) => set({ columnOrder: order }),
  toggleColumn: (col) => {
    const next = new Set(get().hiddenColumns)
    if (next.has(col)) next.delete(col)
    else next.add(col)
    set({ hiddenColumns: next })
  },
  setCompactMode: (v) => set({ compactMode: v }),

  reset: () =>
    set({
      flights: [],
      airportMap: {},
      homeBaseOffset: 7,
      dateFrom: '',
      dateTo: '',
      timeFrom: '',
      timeTo: '',
      acTypes: null,
      acRegs: null,
      domInt: 'all',
      statuses: null,
      showCancelled: false,
      committed: null,
      timeModes: new Set<TimeMode>(['utc']),
      sortSequence: 'date-reg-std',
      columnOrder: [...DEFAULT_COLUMN_ORDER],
      hiddenColumns: new Set<ColumnId>(['dow']),
      compactMode: false,
    }),
}))

/* ── Selectors (pure functions) ── */

export function utcMsToHhmm(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function applyOffset(hhmmUtc: string, offsetHours: number): { time: string; dayShift: number } {
  const [h, m] = hhmmUtc.split(':').map(Number)
  let totalMin = h * 60 + m + offsetHours * 60
  let dayShift = 0
  if (totalMin >= 1440) {
    totalMin -= 1440
    dayShift = 1
  } else if (totalMin < 0) {
    totalMin += 1440
    dayShift = -1
  }
  return {
    time: `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`,
    dayShift,
  }
}

/** Filter flights using the COMMITTED filter snapshot (not live UI state) */
export function getFilteredFlights(
  flights: Flight[],
  committed: CommittedFilters | null,
  airportMap: Record<string, { utcOffset: number; countryId: string | null }>,
): Flight[] {
  if (!committed) return flights

  let result = flights

  if (!committed.showCancelled) {
    result = result.filter((f) => f.status !== 'cancelled')
  }
  if (committed.acTypes) {
    result = result.filter((f) => f.tail.icaoType && committed.acTypes!.has(f.tail.icaoType))
  }
  if (committed.acRegs) {
    result = result.filter((f) => f.tail.registration && committed.acRegs!.has(f.tail.registration))
  }
  if (committed.statuses) {
    result = result.filter((f) => committed.statuses!.has(f.status))
  }
  if (committed.domInt !== 'all') {
    result = result.filter((f) => {
      const depCountry = airportMap[f.dep.icao]?.countryId
      const arrCountry = airportMap[f.arr.icao]?.countryId
      const isDom = depCountry != null && depCountry === arrCountry
      return committed.domInt === 'dom' ? isDom : !isDom
    })
  }
  if (committed.timeFrom || committed.timeTo) {
    result = result.filter((f) => {
      if (!f.schedule.stdUtc) return false
      const hhmm = utcMsToHhmm(f.schedule.stdUtc)
      if (committed.timeFrom && hhmm < committed.timeFrom) return false
      if (committed.timeTo && hhmm > committed.timeTo) return false
      return true
    })
  }

  return result
}

export function getSortedFlights(flights: Flight[], sortSequence: SortSequence): Flight[] {
  const sorted = [...flights]
  sorted.sort((a, b) => {
    switch (sortSequence) {
      case 'date-std':
        return a.operatingDate.localeCompare(b.operatingDate) || (a.schedule.stdUtc ?? 0) - (b.schedule.stdUtc ?? 0)
      case 'date-reg-std':
        return (
          a.operatingDate.localeCompare(b.operatingDate) ||
          (a.tail.registration ?? '').localeCompare(b.tail.registration ?? '') ||
          (a.schedule.stdUtc ?? 0) - (b.schedule.stdUtc ?? 0)
        )
      case 'reg-date-std':
        return (
          (a.tail.registration ?? 'zzz').localeCompare(b.tail.registration ?? 'zzz') ||
          a.operatingDate.localeCompare(b.operatingDate) ||
          (a.schedule.stdUtc ?? 0) - (b.schedule.stdUtc ?? 0)
        )
      case 'flt-date':
        return a.flightNumber.localeCompare(b.flightNumber) || a.operatingDate.localeCompare(b.operatingDate)
      default:
        return 0
    }
  })
  return sorted
}

export function getGroupKey(flight: Flight, sortSequence: SortSequence): string {
  switch (sortSequence) {
    case 'date-std':
      return flight.operatingDate
    case 'date-reg-std':
      return `${flight.operatingDate}__${flight.tail.registration ?? '__unassigned__'}`
    case 'reg-date-std':
      return flight.tail.registration ?? '__unassigned__'
    case 'flt-date':
      return flight.flightNumber
  }
}

export interface SummaryStats {
  total: number
  assigned: number
  unassigned: number
  assignedPct: number
  blockMinutes: number
  uniqueDates: number
  avgPerDay: number
}

export function getSummaryStats(flights: Flight[]): SummaryStats {
  const total = flights.length
  let assigned = 0,
    blockMinutes = 0
  const dates = new Set<string>()
  for (const f of flights) {
    if (f.tail.registration) assigned++
    if (f.schedule.stdUtc && f.schedule.staUtc) {
      blockMinutes += Math.max(0, f.schedule.staUtc - f.schedule.stdUtc) / 60000
    }
    dates.add(f.operatingDate)
  }
  const uniqueDates = dates.size || 1
  return {
    total,
    assigned,
    unassigned: total - assigned,
    assignedPct: total ? Math.round((assigned / total) * 100) : 0,
    blockMinutes: Math.round(blockMinutes),
    uniqueDates,
    avgPerDay: Math.round((total / uniqueDates) * 10) / 10,
  }
}
