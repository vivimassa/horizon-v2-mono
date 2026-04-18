'use client'

import { create } from 'zustand'
import { defaultFilterState } from '@/components/network/frequency-analysis/compute-frequency'
import type {
  FrequencyFilterState,
  FrequencyFlightRow,
  SortBy,
} from '@/components/network/frequency-analysis/frequency-analysis-types'

interface FrequencyAnalysisState {
  /** Raw per-(flight, date) rows returned from the last load. */
  rawRows: FrequencyFlightRow[]
  /** True once the user has clicked Go and data has loaded at least once. */
  hasLoaded: boolean

  /** Live UI filter state (what the user is currently editing). */
  filters: FrequencyFilterState
  /** Committed filter state (what the visible results reflect). */
  committed: FrequencyFilterState

  /** Color map: ICAO type → CSS color string. Sourced from Aircraft Types DB. */
  acTypeColors: Map<string, string>

  setRawRows: (rows: FrequencyFlightRow[]) => void
  setHasLoaded: (v: boolean) => void
  setAcTypeColors: (m: Map<string, string>) => void

  /** Filter setters. */
  setDateRange: (from: string, to: string) => void
  setSelectedTypes: (types: Set<string>) => void
  setSelectedStation: (s: string) => void
  setSelectedRoute: (r: string) => void
  setSelectedRouteType: (v: FrequencyFilterState['selectedRouteType']) => void
  setSelectedServiceType: (s: string) => void
  setSearchQuery: (q: string) => void
  setSortBy: (s: SortBy) => void

  /** Snapshot current live filters → committed (called on Go and on in-panel changes post-load). */
  commitFilters: () => void
  /** Reset filters back to defaults (keeps raw data + dateRange). */
  resetFilters: () => void
}

export const useFrequencyAnalysisStore = create<FrequencyAnalysisState>((set, get) => ({
  rawRows: [],
  hasLoaded: false,
  filters: defaultFilterState(),
  committed: defaultFilterState(),
  acTypeColors: new Map(),

  setRawRows: (rows) => set({ rawRows: rows }),
  setHasLoaded: (v) => set({ hasLoaded: v }),
  setAcTypeColors: (m) => set({ acTypeColors: m }),

  // Left-panel setters intentionally do NOT auto-commit. Changes stay in the
  // live `filters` object until the user clicks Go (→ commitFilters), so the
  // visible results don't shift under the user while they're tuning filters.
  setDateRange: (from, to) => set((s) => ({ filters: { ...s.filters, dateFrom: from, dateTo: to } })),
  setSelectedTypes: (types) => set((s) => ({ filters: { ...s.filters, selectedTypes: types } })),
  setSelectedStation: (selectedStation) => set((s) => ({ filters: { ...s.filters, selectedStation } })),
  setSelectedRoute: (selectedRoute) => set((s) => ({ filters: { ...s.filters, selectedRoute } })),
  setSelectedRouteType: (selectedRouteType) => set((s) => ({ filters: { ...s.filters, selectedRouteType } })),
  setSelectedServiceType: (selectedServiceType) => set((s) => ({ filters: { ...s.filters, selectedServiceType } })),
  setSortBy: (sortBy) => set((s) => ({ filters: { ...s.filters, sortBy } })),

  // Toolbar controls (search / reset) stay live — they operate on the already-
  // loaded result set and users expect immediate feedback there.
  setSearchQuery: (searchQuery) => {
    set((s) => ({ filters: { ...s.filters, searchQuery } }))
    get().commitFilters()
  },

  commitFilters: () =>
    set((s) => ({
      committed: {
        ...s.filters,
        selectedTypes: new Set(s.filters.selectedTypes),
      },
    })),
  resetFilters: () =>
    set((s) => {
      const base = defaultFilterState()
      const next: FrequencyFilterState = {
        ...base,
        dateFrom: s.filters.dateFrom,
        dateTo: s.filters.dateTo,
      }
      return { filters: next, committed: { ...next, selectedTypes: new Set() } }
    }),
}))

/** Count of active (non-default) refinement filters — for the filter-panel badge. */
export function countActiveFilters(f: FrequencyFilterState): number {
  let n = 0
  if (f.selectedTypes.size > 0) n += 1
  if (f.selectedStation) n += 1
  if (f.selectedRoute) n += 1
  if (f.selectedRouteType !== 'all') n += 1
  if (f.selectedServiceType) n += 1
  if (f.searchQuery.trim()) n += 1
  return n
}

/**
 * True when the live filter state diverges from the last-committed snapshot
 * on any left-panel input. Excludes searchQuery since that's a toolbar control
 * which auto-commits live. Used to enable the "click Go to apply" hint.
 */
export function leftPanelDirty(live: FrequencyFilterState, committed: FrequencyFilterState): boolean {
  if (live.dateFrom !== committed.dateFrom) return true
  if (live.dateTo !== committed.dateTo) return true
  if (live.selectedStation !== committed.selectedStation) return true
  if (live.selectedRoute !== committed.selectedRoute) return true
  if (live.selectedRouteType !== committed.selectedRouteType) return true
  if (live.selectedServiceType !== committed.selectedServiceType) return true
  if (live.sortBy !== committed.sortBy) return true
  if (live.selectedTypes.size !== committed.selectedTypes.size) return true
  for (const t of live.selectedTypes) if (!committed.selectedTypes.has(t)) return true
  return false
}
