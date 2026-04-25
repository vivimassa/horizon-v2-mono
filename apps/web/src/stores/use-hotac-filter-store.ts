'use client'

import { create } from 'zustand'
import { EMPTY_HOTAC_FILTERS, type HotacFilters } from '@/components/crew-ops/hotac/types'

/**
 * Draft filter state for 4.1.8.1 Crew Hotel Management. User edits in the left
 * panel mutate the draft; clicking Go pushes it into useHotacStore which
 * triggers the fetch. Mirrors usePairingFilterStore exactly.
 */
interface HotacFilterStoreState {
  draftPeriodFrom: string
  draftPeriodTo: string
  draftFilters: HotacFilters

  activeCount: () => number

  setDraftFrom: (from: string) => void
  setDraftTo: (to: string) => void
  setDraftFilters: (patch: Partial<HotacFilters>) => void
  reset: () => void
  hydrate: (period: { from: string; to: string }, filters: HotacFilters) => void
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

export const useHotacFilterStore = create<HotacFilterStoreState>((set, get) => ({
  draftPeriodFrom: init.from,
  draftPeriodTo: init.to,
  draftFilters: EMPTY_HOTAC_FILTERS,

  activeCount: () => {
    const { draftFilters, draftPeriodFrom, draftPeriodTo } = get()
    let count = 0
    if (draftPeriodFrom) count += 1
    if (draftPeriodTo) count += 1
    if (draftFilters.stationIcaos !== null && draftFilters.stationIcaos.length > 0) count += 1
    if (draftFilters.baseAirports !== null && draftFilters.baseAirports.length > 0) count += 1
    if (draftFilters.positions !== null && draftFilters.positions.length > 0) count += 1
    if (draftFilters.aircraftTypes !== null && draftFilters.aircraftTypes.length > 0) count += 1
    if (draftFilters.crewGroupIds !== null && draftFilters.crewGroupIds.length > 0) count += 1
    return count
  },

  setDraftFrom: (from) => set({ draftPeriodFrom: from }),
  setDraftTo: (to) => set({ draftPeriodTo: to }),
  setDraftFilters: (patch) => set((s) => ({ draftFilters: { ...s.draftFilters, ...patch } })),

  reset: () =>
    set({
      draftPeriodFrom: init.from,
      draftPeriodTo: init.to,
      draftFilters: EMPTY_HOTAC_FILTERS,
    }),

  hydrate: (period, filters) => set({ draftPeriodFrom: period.from, draftPeriodTo: period.to, draftFilters: filters }),
}))
