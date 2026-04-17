'use client'

import { create } from 'zustand'
import { compareSsim, type AirportCoord, type SSIMParseResult, type SsimComparisonReport } from '@skyhub/logic'
import { api } from '@skyhub/api'
import { parseSsimFile } from '@/lib/ssim-parse-browser'

export type Stage = 'idle' | 'parsing' | 'ready' | 'comparing' | 'done' | 'error'

interface FileSlot {
  file: File | null
  result: SSIMParseResult | null
  error: string | null
}

interface SsimComparisonState {
  a: FileSlot
  b: FileSlot
  dateFrom: string
  dateTo: string
  aircraftTypeFilter: string[]
  stage: Stage
  errorMessage: string | null
  report: SsimComparisonReport | null
  airports: AirportCoord[] | null

  setFileA: (file: File | null) => Promise<void>
  setFileB: (file: File | null) => Promise<void>
  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  setAircraftTypeFilter: (v: string[]) => void

  validate: () => string | null
  compare: () => Promise<void>
  reset: () => void
}

const emptySlot: FileSlot = { file: null, result: null, error: null }

async function ensureAirports(current: AirportCoord[] | null): Promise<AirportCoord[]> {
  if (current) return current
  try {
    const list = await api.getAirports()
    return list
      .filter((a) => a.iataCode && a.latitude != null && a.longitude != null)
      .map((a) => ({
        iata: a.iataCode!,
        latitude: a.latitude!,
        longitude: a.longitude!,
      }))
  } catch {
    return []
  }
}

export const useSsimComparisonStore = create<SsimComparisonState>((set, get) => ({
  a: { ...emptySlot },
  b: { ...emptySlot },
  dateFrom: '',
  dateTo: '',
  aircraftTypeFilter: [],
  stage: 'idle',
  errorMessage: null,
  report: null,
  airports: null,

  setFileA: async (file) => {
    if (!file) {
      set({ a: { ...emptySlot }, report: null, stage: pickStage({ ...get(), a: emptySlot }) })
      return
    }
    set({ a: { file, result: null, error: null }, stage: 'parsing', report: null })
    try {
      const result = await parseSsimFile(file)
      set({ a: { file, result, error: null } })
      seedRangeFromFiles(get, set)
      set({ stage: pickStage(get()) })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse file'
      set({ a: { file, result: null, error: msg }, stage: 'error', errorMessage: msg })
    }
  },

  setFileB: async (file) => {
    if (!file) {
      set({ b: { ...emptySlot }, report: null, stage: pickStage({ ...get(), b: emptySlot }) })
      return
    }
    set({ b: { file, result: null, error: null }, stage: 'parsing', report: null })
    try {
      const result = await parseSsimFile(file)
      set({ b: { file, result, error: null } })
      seedRangeFromFiles(get, set)
      set({ stage: pickStage(get()) })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse file'
      set({ b: { file, result: null, error: msg }, stage: 'error', errorMessage: msg })
    }
  },

  setDateFrom: (dateFrom) => {
    set({ dateFrom })
    if (get().report) set({ report: null, stage: pickStage(get()) })
  },
  setDateTo: (dateTo) => {
    set({ dateTo })
    if (get().report) set({ report: null, stage: pickStage(get()) })
  },
  setAircraftTypeFilter: (aircraftTypeFilter) => {
    set({ aircraftTypeFilter })
    if (get().report) set({ report: null, stage: pickStage(get()) })
  },

  validate: () => {
    const s = get()
    if (!s.a.result) return 'Upload a baseline SSIM file (A)'
    if (!s.b.result) return 'Upload a comparison SSIM file (B)'
    if (!s.dateFrom || !s.dateTo) return 'Pick a date range'
    if (s.dateFrom > s.dateTo) return 'Date range: From must be on or before To'
    return null
  },

  compare: async () => {
    const err = get().validate()
    if (err) {
      set({ stage: 'error', errorMessage: err })
      return
    }
    set({ stage: 'comparing', errorMessage: null, report: null })
    try {
      const airports = await ensureAirports(get().airports)
      set({ airports })
      const s = get()
      const report = compareSsim(s.a.result!, s.b.result!, {
        from: s.dateFrom,
        to: s.dateTo,
        aircraftTypeFilter: s.aircraftTypeFilter,
        airports,
      })
      set({ report, stage: 'done' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Comparison failed'
      set({ stage: 'error', errorMessage: msg })
    }
  },

  reset: () => {
    set({
      a: { ...emptySlot },
      b: { ...emptySlot },
      dateFrom: '',
      dateTo: '',
      aircraftTypeFilter: [],
      stage: 'idle',
      errorMessage: null,
      report: null,
    })
  },
}))

/** After both files parse, auto-seed the date range to the intersection of their coverage windows. */
function seedRangeFromFiles(
  get: () => SsimComparisonState,
  set: (partial: Partial<SsimComparisonState>) => void,
): void {
  const s = get()
  if (!s.a.result || !s.b.result) return
  if (s.dateFrom && s.dateTo) return // user already picked — don't overwrite

  const aStart = s.a.result.stats.dateRange.start
  const aEnd = s.a.result.stats.dateRange.end
  const bStart = s.b.result.stats.dateRange.start
  const bEnd = s.b.result.stats.dateRange.end
  if (!aStart || !aEnd || !bStart || !bEnd) return

  const from = aStart > bStart ? aStart : bStart
  const to = aEnd < bEnd ? aEnd : bEnd
  if (from > to) return // no overlap — leave empty so user picks manually

  set({ dateFrom: from, dateTo: to })
}

function pickStage(s: Pick<SsimComparisonState, 'a' | 'b' | 'report'>): Stage {
  if (s.report) return 'done'
  if (s.a.result && s.b.result) return 'ready'
  return 'idle'
}
