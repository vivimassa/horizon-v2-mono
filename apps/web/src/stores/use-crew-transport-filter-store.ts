'use client'

import { create } from 'zustand'

export type TransportTypeFilter = 'all' | 'ground' | 'flight'

export interface CrewTransportFilters {
  stationIcaos: string[] | null
  baseAirports: string[] | null
  positions: string[] | null
  aircraftTypes: string[] | null
  crewGroupIds: string[] | null
  /** HOTAC-specific: Ground / Flight / All. Defaults to 'all' (matches the segment). */
  transportType: TransportTypeFilter
  /** Vendor IDs to scope the trip view to. Empty = all vendors. */
  vendorIds: string[] | null
}

const EMPTY_FILTERS: CrewTransportFilters = {
  stationIcaos: null,
  baseAirports: null,
  positions: null,
  aircraftTypes: null,
  crewGroupIds: null,
  transportType: 'all',
  vendorIds: null,
}

interface CrewTransportFilterStoreState {
  draftPeriodFrom: string
  draftPeriodTo: string
  draftFilters: CrewTransportFilters

  activeCount: () => number

  setDraftFrom: (from: string) => void
  setDraftTo: (to: string) => void
  setDraftFilters: (patch: Partial<CrewTransportFilters>) => void
  reset: () => void
  hydrate: (period: { from: string; to: string }, filters: CrewTransportFilters) => void
}

function defaultPeriod(): { from: string; to: string } {
  const today = new Date()
  const from = today.toISOString().slice(0, 10)
  const end = new Date(today)
  end.setUTCDate(end.getUTCDate() + 6)
  const to = end.toISOString().slice(0, 10)
  return { from, to }
}

const init = defaultPeriod()

export const useCrewTransportFilterStore = create<CrewTransportFilterStoreState>((set, get) => ({
  draftPeriodFrom: init.from,
  draftPeriodTo: init.to,
  draftFilters: EMPTY_FILTERS,

  activeCount: () => {
    const { draftFilters: f, draftPeriodFrom, draftPeriodTo } = get()
    let count = 0
    if (draftPeriodFrom) count += 1
    if (draftPeriodTo) count += 1
    if (f.stationIcaos && f.stationIcaos.length > 0) count += 1
    if (f.baseAirports && f.baseAirports.length > 0) count += 1
    if (f.positions && f.positions.length > 0) count += 1
    if (f.aircraftTypes && f.aircraftTypes.length > 0) count += 1
    if (f.crewGroupIds && f.crewGroupIds.length > 0) count += 1
    if (f.transportType !== 'all') count += 1
    if (f.vendorIds && f.vendorIds.length > 0) count += 1
    return count
  },

  setDraftFrom: (from) => set({ draftPeriodFrom: from }),
  setDraftTo: (to) => set({ draftPeriodTo: to }),
  setDraftFilters: (patch) => set((s) => ({ draftFilters: { ...s.draftFilters, ...patch } })),

  reset: () =>
    set({
      draftPeriodFrom: init.from,
      draftPeriodTo: init.to,
      draftFilters: EMPTY_FILTERS,
    }),

  hydrate: (period, filters) => set({ draftPeriodFrom: period.from, draftPeriodTo: period.to, draftFilters: filters }),
}))

export { EMPTY_FILTERS as EMPTY_TRANSPORT_FILTERS }
