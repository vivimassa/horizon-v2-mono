'use client'

import { create } from 'zustand'
import {
  exportSsimText,
  type SsimExportFilters,
  type SsimExportActionCode,
  type SsimExportTimeMode,
} from '@/lib/ssim-export-client'

export type SsimExportStage = 'idle' | 'generating' | 'done' | 'error'

export interface SsimExportResultSummary {
  filename: string
  flightCount: number
  byteLength: number
}

interface SsimExportState extends SsimExportFilters {
  stage: SsimExportStage
  errorMessage: string | null

  /** Last successful result. Retained so the user can re-trigger the
   *  download from the success card without re-hitting the server. */
  lastResult: SsimExportResultSummary | null
  /** Object URL of the last result, kept alive until reset/replaced. */
  lastBlobUrl: string | null

  // Filter setters
  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  setFlightNumFrom: (v: string) => void
  setFlightNumTo: (v: string) => void
  setDepStations: (v: string[]) => void
  setArrStations: (v: string[]) => void
  setServiceTypes: (v: string[]) => void
  setActionCode: (v: SsimExportActionCode) => void
  setTimeMode: (v: SsimExportTimeMode) => void

  // Validation — returns the first user-facing error, or null when ok.
  validate: () => string | null

  // Actions
  download: () => Promise<void>
  triggerSave: () => void
  reset: () => void
}

const initialFilters: SsimExportFilters = {
  dateFrom: '',
  dateTo: '',
  flightNumFrom: '',
  flightNumTo: '',
  depStations: [],
  arrStations: [],
  serviceTypes: [],
  actionCode: 'H',
  timeMode: 'local',
}

function revoke(url: string | null) {
  if (url) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* noop */
    }
  }
}

export const useSsimExportStore = create<SsimExportState>((set, get) => ({
  ...initialFilters,
  stage: 'idle',
  errorMessage: null,
  lastResult: null,
  lastBlobUrl: null,

  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
  setFlightNumFrom: (flightNumFrom) => set({ flightNumFrom }),
  setFlightNumTo: (flightNumTo) => set({ flightNumTo }),
  setDepStations: (depStations) => set({ depStations }),
  setArrStations: (arrStations) => set({ arrStations }),
  setServiceTypes: (serviceTypes) => set({ serviceTypes }),
  setActionCode: (actionCode) => set({ actionCode }),
  setTimeMode: (timeMode) => set({ timeMode }),

  validate: () => {
    const s = get()
    if (s.dateFrom && s.dateTo && s.dateFrom > s.dateTo) {
      return 'Date range: From must be on or before To'
    }
    if (s.dateFrom && !s.dateTo) return 'Date range: To is required when From is set'
    if (s.dateTo && !s.dateFrom) return 'Date range: From is required when To is set'
    if (s.flightNumFrom && s.flightNumTo) {
      const a = parseInt(s.flightNumFrom, 10)
      const b = parseInt(s.flightNumTo, 10)
      if (Number.isFinite(a) && Number.isFinite(b) && a > b) {
        return 'Flight # range: From must be ≤ To'
      }
    }
    return null
  },

  download: async () => {
    const validationError = get().validate()
    if (validationError) {
      set({ stage: 'error', errorMessage: validationError })
      return
    }

    // Drop any prior blob URL — we're about to fetch fresh content.
    revoke(get().lastBlobUrl)

    set({ stage: 'generating', errorMessage: null, lastResult: null, lastBlobUrl: null })

    try {
      const filters: SsimExportFilters = {
        dateFrom: get().dateFrom,
        dateTo: get().dateTo,
        flightNumFrom: get().flightNumFrom,
        flightNumTo: get().flightNumTo,
        depStations: get().depStations,
        arrStations: get().arrStations,
        serviceTypes: get().serviceTypes,
        actionCode: get().actionCode,
        timeMode: get().timeMode,
      }

      const result = await exportSsimText(filters)
      const url = URL.createObjectURL(result.blob)

      set({
        stage: 'done',
        errorMessage: null,
        lastBlobUrl: url,
        lastResult: {
          filename: result.filename,
          flightCount: result.flightCount,
          byteLength: result.blob.size,
        },
      })

      // Auto-trigger the browser save dialog the first time around.
      get().triggerSave()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed — please retry.'
      set({ stage: 'error', errorMessage: message })
    }
  },

  triggerSave: () => {
    const { lastBlobUrl, lastResult } = get()
    if (!lastBlobUrl || !lastResult) return
    const a = document.createElement('a')
    a.href = lastBlobUrl
    a.download = lastResult.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  },

  reset: () => {
    revoke(get().lastBlobUrl)
    set({
      ...initialFilters,
      stage: 'idle',
      errorMessage: null,
      lastResult: null,
      lastBlobUrl: null,
    })
  },
}))
