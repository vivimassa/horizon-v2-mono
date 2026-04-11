'use client'

import { create } from 'zustand'
import { api } from '@skyhub/api'
import type { ScheduleMessageRef, ScheduleMessageStats, ScheduleMessageQuery } from '@skyhub/api'
import { getOperatorId } from './use-operator-store'

type ActiveSection = 'receive' | 'send' | 'log'

interface ScheduleMessagingState {
  // Data
  messages: ScheduleMessageRef[]
  stats: ScheduleMessageStats | null
  totalCount: number
  dataLoaded: boolean

  // Filters
  filters: Omit<ScheduleMessageQuery, 'operatorId'>
  setFilter: <K extends keyof Omit<ScheduleMessageQuery, 'operatorId'>>(
    key: K,
    value: Omit<ScheduleMessageQuery, 'operatorId'>[K],
  ) => void
  resetFilters: () => void

  // Pagination
  page: number
  pageSize: number
  setPage: (p: number) => void

  // Loading
  loading: boolean
  statsLoading: boolean

  // View
  activeSection: ActiveSection
  setActiveSection: (s: ActiveSection) => void

  // Selection (message log table)
  selectedIds: Set<string>
  toggleSelected: (id: string) => void
  selectAll: () => void
  clearSelection: () => void

  // Actions
  loadMessages: () => Promise<void>
  loadStats: () => Promise<void>
  reset: () => void
}

const DEFAULT_FILTERS: Omit<ScheduleMessageQuery, 'operatorId'> = {
  limit: 50,
  offset: 0,
}

export const useScheduleMessagingStore = create<ScheduleMessagingState>((set, get) => ({
  messages: [],
  stats: null,
  totalCount: 0,
  dataLoaded: false,

  filters: { ...DEFAULT_FILTERS },
  setFilter: (key, value) => {
    set((s) => ({ filters: { ...s.filters, [key]: value } }))
  },
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS }, page: 1 }),

  page: 1,
  pageSize: 50,
  setPage: (p) => set({ page: p }),

  loading: false,
  statsLoading: false,

  activeSection: 'log',
  setActiveSection: (s) => set({ activeSection: s }),

  selectedIds: new Set(),
  toggleSelected: (id) => {
    set((s) => {
      const next = new Set(s.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    })
  },
  selectAll: () => {
    set((s) => ({ selectedIds: new Set(s.messages.map((m) => m._id)) }))
  },
  clearSelection: () => set({ selectedIds: new Set() }),

  loadMessages: async () => {
    const opId = getOperatorId()
    if (!opId) return
    set({ loading: true })
    try {
      const { page, pageSize, filters } = get()
      const result = await api.getScheduleMessages({
        operatorId: opId,
        ...filters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      set({ messages: result.messages, totalCount: result.total, dataLoaded: true })
    } finally {
      set({ loading: false })
    }
  },

  loadStats: async () => {
    const opId = getOperatorId()
    if (!opId) return
    set({ statsLoading: true })
    try {
      const stats = await api.getScheduleMessageStats(opId)
      set({ stats })
    } finally {
      set({ statsLoading: false })
    }
  },

  reset: () =>
    set({
      messages: [],
      stats: null,
      totalCount: 0,
      dataLoaded: false,
      filters: { ...DEFAULT_FILTERS },
      page: 1,
      selectedIds: new Set(),
      activeSection: 'log',
    }),
}))
