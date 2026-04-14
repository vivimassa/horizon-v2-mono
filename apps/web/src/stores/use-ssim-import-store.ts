'use client'

import { create } from 'zustand'
import {
  type SsimParseResponse,
  type SsimParsedFlight,
  type SsimTimeMode,
  type SsimRotationMode,
  type SsimBatchFlight,
  parseSsim,
  createMissingAirports,
  createMissingCityPairs,
  clearExistingFlights,
  importFlightsBatch,
  finalizeImport,
  seedCityPairBlockTimes,
  clipLegToPeriod,
} from '@/lib/ssim-import-client'

export type SsimImportStage = 'idle' | 'parsing' | 'parsed' | 'importing' | 'done' | 'error'
export type SsimImportMode = 'replace' | 'merge' | 'preview'

export interface SsimImportResult {
  imported: number
  errors: Array<{ lineNo: number; message: string }>
  airportsCreated: number
  cityPairsCreated: number
  blockTimesUpdated: number
  deleted: number
  droppedOutOfPeriod: number
}

interface SsimImportState {
  stage: SsimImportStage
  file: File | null
  timeMode: SsimTimeMode
  mode: SsimImportMode
  rotationMode: SsimRotationMode
  autoCreateAirports: boolean
  autoCreateCityPairs: boolean
  /** User-selected import period. Both required before Parse enables. */
  periodFrom: string
  periodTo: string
  /** True once the user has manually set at least one period date. */
  periodTouched: boolean
  parseResult: SsimParseResponse | null
  currentStep: number
  stepLabel: string
  importResult: SsimImportResult | null
  errorMessage: string | null
  seasonCode: string
  scenarioId: string | null
  // setters
  setFile: (file: File | null) => void
  setTimeMode: (mode: SsimTimeMode) => void
  setMode: (mode: SsimImportMode) => void
  setRotationMode: (mode: SsimRotationMode) => void
  setAutoCreateAirports: (value: boolean) => void
  setAutoCreateCityPairs: (value: boolean) => void
  setPeriod: (from: string, to: string) => void
  setScenarioId: (id: string | null) => void
  setSeasonCode: (code: string) => void
  // actions
  parse: () => Promise<void>
  runImport: () => Promise<void>
  reset: () => void
}

const BATCH_SIZE = 50

export const useSsimImportStore = create<SsimImportState>((set, get) => ({
  stage: 'idle',
  file: null,
  timeMode: 'standard',
  mode: 'replace',
  rotationMode: 'combine-ofr',
  autoCreateAirports: true,
  autoCreateCityPairs: true,
  periodFrom: '',
  periodTo: '',
  periodTouched: false,
  parseResult: null,
  currentStep: 0,
  stepLabel: '',
  importResult: null,
  errorMessage: null,
  seasonCode: '',
  scenarioId: null,

  setFile: (file) => set({ file }),
  setTimeMode: (timeMode) => set({ timeMode }),
  setMode: (mode) => set({ mode }),
  setRotationMode: (rotationMode) => set({ rotationMode }),
  setAutoCreateAirports: (autoCreateAirports) => set({ autoCreateAirports }),
  setAutoCreateCityPairs: (autoCreateCityPairs) => set({ autoCreateCityPairs }),
  setPeriod: (periodFrom, periodTo) => set({ periodFrom, periodTo, periodTouched: true }),
  setScenarioId: (scenarioId) => set({ scenarioId }),
  setSeasonCode: (seasonCode) => set({ seasonCode }),

  parse: async () => {
    const { file, timeMode, seasonCode, scenarioId } = get()
    if (!file) {
      set({ stage: 'error', errorMessage: 'No file selected.' })
      return
    }
    set({ stage: 'parsing', errorMessage: null, stepLabel: 'Parsing SSIM file…' })
    try {
      const content = await file.text()
      const result = await parseSsim(content, timeMode, seasonCode, scenarioId)
      // Auto-fill the period if the user hasn't touched it yet — convenient
      // default, but still editable.
      const patch: Partial<SsimImportState> = { parseResult: result, stage: 'parsed' }
      const { periodTouched, periodFrom, periodTo } = get()
      if (!periodTouched && result.carrier && (!periodFrom || !periodTo)) {
        patch.periodFrom = result.carrier.seasonStart
        patch.periodTo = result.carrier.seasonEnd
      }
      set(patch)
    } catch (err) {
      set({
        stage: 'error',
        errorMessage: err instanceof Error ? err.message : 'Parse failed',
      })
    }
  },

  runImport: async () => {
    const state = get()
    const { parseResult, mode, rotationMode, autoCreateAirports, autoCreateCityPairs, seasonCode, scenarioId } = state
    if (!parseResult) {
      set({ stage: 'error', errorMessage: 'Parse a file before importing.' })
      return
    }
    if (mode === 'preview') {
      // Dry-run: stop here.
      set({
        stage: 'done',
        importResult: {
          imported: 0,
          errors: [],
          airportsCreated: 0,
          cityPairsCreated: 0,
          blockTimesUpdated: 0,
          deleted: 0,
          droppedOutOfPeriod: countDropped(parseResult.flights, state.periodFrom, state.periodTo),
        },
      })
      return
    }
    if (!state.periodFrom || !state.periodTo) {
      set({ stage: 'error', errorMessage: 'Select an import period first.' })
      return
    }

    set({ stage: 'importing', errorMessage: null, currentStep: 0 })

    // Pre-clip legs to the user period. Drops legs whose recurrence window
    // has no overlap with [periodFrom, periodTo] and carries the clipped
    // effectiveFrom/effectiveUntil on the rest.
    const clipped: SsimBatchFlight[] = []
    let dropped = 0
    for (const f of parseResult.flights) {
      const window = clipLegToPeriod(f.periodStart, f.periodEnd, state.periodFrom, state.periodTo)
      if (!window) {
        dropped++
        continue
      }
      clipped.push({ ...f, ...window })
    }

    const errors: Array<{ lineNo: number; message: string }> = []
    let imported = 0
    let airportsCreated = 0
    let cityPairsCreated = 0
    let blockTimesUpdated = 0
    let deleted = 0

    try {
      // ── Step 1: create missing airports ───────────────────────────────
      if (autoCreateAirports && parseResult.validation.missingAirports.length > 0) {
        set({
          currentStep: 1,
          stepLabel: `Creating ${parseResult.validation.missingAirports.length} missing airports…`,
        })
        const res = await createMissingAirports(parseResult.validation.missingAirports, seasonCode, scenarioId)
        airportsCreated = res.created
      }

      // ── Step 2: create missing city pairs ─────────────────────────────
      if (autoCreateCityPairs && parseResult.validation.missingCityPairs.length > 0) {
        set({
          currentStep: 2,
          stepLabel: `Creating ${parseResult.validation.missingCityPairs.length} missing city pairs…`,
        })
        const res = await createMissingCityPairs(parseResult.validation.missingCityPairs, seasonCode, scenarioId)
        cityPairsCreated = res.created
      }

      // ── Step 3: clear existing flights (Replace only) ────────────────
      if (mode === 'replace') {
        set({ currentStep: 3, stepLabel: 'Clearing existing flights in the selected period…' })
        const res = await clearExistingFlights(state.periodFrom, state.periodTo, seasonCode, scenarioId)
        deleted = res.deleted
      }

      // ── Step 4: batch insert ──────────────────────────────────────────
      const totalBatches = Math.ceil(clipped.length / BATCH_SIZE)
      for (let b = 0; b < totalBatches; b++) {
        const from = b * BATCH_SIZE
        const slice = clipped.slice(from, from + BATCH_SIZE)
        set({ currentStep: 4, stepLabel: `Importing flights — batch ${b + 1} of ${totalBatches}…` })
        const res = await importFlightsBatch(slice, rotationMode, b, seasonCode, scenarioId)
        imported += res.created
        if (res.errors.length > 0) errors.push(...res.errors)
      }

      // ── Step 5: finalize references ──────────────────────────────────
      set({ currentStep: 5, stepLabel: 'Finalizing references…' })
      await finalizeImport(seasonCode, scenarioId)

      // ── Step 6: seed city-pair block times ───────────────────────────
      set({ currentStep: 6, stepLabel: 'Seeding median block times…' })
      const bt = await seedCityPairBlockTimes(seasonCode, scenarioId)
      blockTimesUpdated = bt.updated

      set({
        stage: 'done',
        importResult: {
          imported,
          errors,
          airportsCreated,
          cityPairsCreated,
          blockTimesUpdated,
          deleted,
          droppedOutOfPeriod: dropped,
        },
      })
    } catch (err) {
      set({
        stage: 'error',
        errorMessage: err instanceof Error ? err.message : 'Import failed',
        importResult: {
          imported,
          errors,
          airportsCreated,
          cityPairsCreated,
          blockTimesUpdated,
          deleted,
          droppedOutOfPeriod: dropped,
        },
      })
    }
  },

  reset: () =>
    set({
      stage: 'idle',
      file: null,
      parseResult: null,
      currentStep: 0,
      stepLabel: '',
      importResult: null,
      errorMessage: null,
      periodTouched: false,
      periodFrom: '',
      periodTo: '',
    }),
}))

function countDropped(flights: SsimParsedFlight[], userFrom: string, userTo: string): number {
  if (!userFrom || !userTo) return 0
  let dropped = 0
  for (const f of flights) {
    if (!clipLegToPeriod(f.periodStart, f.periodEnd, userFrom, userTo)) dropped++
  }
  return dropped
}
