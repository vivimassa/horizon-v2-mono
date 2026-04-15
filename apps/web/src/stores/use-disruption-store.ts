'use client'

import { create } from 'zustand'
import { api, type DisruptionIssueRef, type DisruptionActivityRef } from '@skyhub/api'

export type FeedTab = 'all' | 'critical' | 'warning' | 'info' | 'resolved'

interface Filters {
  from: string | null
  to: string | null
  /**
   * Rolling window size in days. null = fixed period (from/to apply).
   * When set, scan re-anchors: from = today, to = today + N days. Filter
   * panel disables the period picker while this is active.
   */
  rollingPeriodDays: number | null
  category: string | null
  severity: string | null
  station: string | null
  flightNumber: string | null
}

interface DisruptionState {
  operatorId: string
  loading: boolean
  error: string | null
  issues: DisruptionIssueRef[]
  selectedIssueId: string | null
  selectedActivity: DisruptionActivityRef[]
  feedTab: FeedTab
  filters: Filters

  setOperatorId: (id: string) => void
  setFeedTab: (tab: FeedTab) => void
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  resetFilters: () => void
  selectIssue: (id: string | null) => Promise<void>

  refresh: () => Promise<void>
  scan: (from: string, to: string) => Promise<void>

  claim: (id: string) => Promise<void>
  start: (id: string) => Promise<void>
  resolve: (id: string, resolutionType: string, notes?: string) => Promise<void>
  close: (id: string) => Promise<void>
  hide: (id: string) => Promise<void>
}

const defaultFilters: Filters = {
  from: null,
  to: null,
  rollingPeriodDays: 3,
  category: null,
  severity: null,
  station: null,
  flightNumber: null,
}

export const useDisruptionStore = create<DisruptionState>((set, get) => ({
  operatorId: '',
  loading: false,
  error: null,
  issues: [],
  selectedIssueId: null,
  selectedActivity: [],
  feedTab: 'all',
  filters: { ...defaultFilters },

  setOperatorId: (id) => set({ operatorId: id }),
  setFeedTab: (tab) => set({ feedTab: tab }),
  setFilter: (key, value) => set({ filters: { ...get().filters, [key]: value } }),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  selectIssue: async (id) => {
    if (!id) {
      set({ selectedIssueId: null, selectedActivity: [] })
      return
    }
    set({ selectedIssueId: id })
    try {
      const { activity } = await api.getDisruption(id)
      set({ selectedActivity: activity })
    } catch (e) {
      console.error('Failed to load disruption detail:', e)
    }
  },

  refresh: async () => {
    const { operatorId, filters } = get()
    if (!operatorId) return
    set({ loading: true, error: null })
    try {
      const issues = await api.listDisruptions({
        operatorId,
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        category: filters.category ?? undefined,
        severity: filters.severity ?? undefined,
        station: filters.station ?? undefined,
        flightNumber: filters.flightNumber ?? undefined,
      })
      set({ issues, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load' })
    }
  },

  scan: async (from, to) => {
    const { operatorId } = get()
    if (!operatorId) return
    set({ loading: true, error: null })
    try {
      await api.scanDisruptions({ operatorId, from, to })
      await get().refresh()
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Scan failed' })
    }
  },

  claim: async (id) => {
    await api.claimDisruption(id)
    await get().refresh()
    await get().selectIssue(id)
  },
  start: async (id) => {
    await api.startDisruption(id)
    await get().refresh()
    await get().selectIssue(id)
  },
  resolve: async (id, resolutionType, notes) => {
    await api.resolveDisruption(id, { resolutionType, resolutionNotes: notes })
    await get().refresh()
    await get().selectIssue(id)
  },
  close: async (id) => {
    await api.closeDisruption(id)
    await get().refresh()
    await get().selectIssue(id)
  },
  hide: async (id) => {
    await api.hideDisruption(id)
    await get().refresh()
    if (get().selectedIssueId === id) set({ selectedIssueId: null, selectedActivity: [] })
  },
}))
