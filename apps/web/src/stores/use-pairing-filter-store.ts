'use client'

import { create } from 'zustand'
import type { PairingFilters } from '@/components/crew-ops/pairing/types'
import { DEFAULT_FILTERS, ALL_STATUS, ALL_WORKFLOW } from '@/components/crew-ops/pairing/types'

/**
 * Draft filter state for 4.1.5 Crew Pairing. Users tweak filters in the left
 * panel, then click Go which pushes the draft into `usePairingStore.filters`
 * and triggers the load. Staged pattern mirrors Network Gantt + Schedule Grid.
 */
interface PairingFilterStoreState {
  draftPeriodFrom: string
  draftPeriodTo: string
  draftFilters: PairingFilters

  /** Count of fields that differ from defaults — shown as accent badge on the panel */
  activeCount: () => number

  setDraftPeriod: (from: string, to: string) => void
  /** Update FROM only — immune to stale closures in the date picker where
   *  onChangeFrom + onChangeTo fire back-to-back. */
  setDraftFrom: (from: string) => void
  /** Update TO only. */
  setDraftTo: (to: string) => void
  setDraftFilters: (patch: Partial<PairingFilters>) => void
  reset: () => void
  hydrate: (period: { from: string; to: string }, filters: PairingFilters) => void
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

const STORAGE_KEY_POSITION_FILTER = 'pairing-filter.positionFilter'

function readStoredPositionFilter(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_POSITION_FILTER)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((v) => typeof v === 'string') ? parsed : null
  } catch {
    return null
  }
}

function writeStoredPositionFilter(v: string[] | null) {
  if (typeof window === 'undefined') return
  try {
    if (v === null) window.localStorage.removeItem(STORAGE_KEY_POSITION_FILTER)
    else window.localStorage.setItem(STORAGE_KEY_POSITION_FILTER, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

const persistedFilters: PairingFilters = {
  ...DEFAULT_FILTERS,
  positionFilter: readStoredPositionFilter(),
}

export const usePairingFilterStore = create<PairingFilterStoreState>((set, get) => ({
  draftPeriodFrom: init.from,
  draftPeriodTo: init.to,
  draftFilters: persistedFilters,

  activeCount: () => {
    const { draftFilters, draftPeriodFrom, draftPeriodTo } = get()
    let count = 0
    if (draftPeriodFrom) count += 1
    if (draftPeriodTo) count += 1
    if (draftFilters.baseAirports !== null) count += 1
    if (draftFilters.aircraftTypes !== null) count += 1
    if (draftFilters.positionFilter !== null && draftFilters.positionFilter.length > 0) count += 1
    if (draftFilters.crewGroupIds !== null && draftFilters.crewGroupIds.length > 0) count += 1
    if (draftFilters.statusFilter.length !== ALL_STATUS.length) count += 1
    if (draftFilters.workflowFilter.length !== ALL_WORKFLOW.length) count += 1
    if (draftFilters.durations.length > 0) count += 1
    if (draftFilters.scenarioId !== null) count += 1
    return count
  },

  setDraftPeriod: (from, to) => set({ draftPeriodFrom: from, draftPeriodTo: to }),
  setDraftFrom: (from) => set({ draftPeriodFrom: from }),
  setDraftTo: (to) => set({ draftPeriodTo: to }),
  setDraftFilters: (patch) => {
    set((s) => ({ draftFilters: { ...s.draftFilters, ...patch } }))
    if ('positionFilter' in patch) writeStoredPositionFilter(patch.positionFilter ?? null)
  },

  reset: () =>
    set({
      draftPeriodFrom: init.from,
      draftPeriodTo: init.to,
      draftFilters: DEFAULT_FILTERS,
    }),

  hydrate: (period, filters) =>
    set({
      draftPeriodFrom: period.from,
      draftPeriodTo: period.to,
      draftFilters: filters,
    }),
}))
