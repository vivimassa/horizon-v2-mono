'use client'

import { create } from 'zustand'
import {
  EMPTY_HOTAC_FILTERS,
  type HotacBooking,
  type HotacDisruption,
  type HotacFilters,
  type HotacTab,
} from '@/components/crew-ops/hotac/types'

interface HotacStoreState {
  // ── Period (committed after Go) ──
  periodFrom: string
  periodTo: string
  periodCommitted: boolean

  // ── Applied filters ──
  filters: HotacFilters

  // ── Data ──
  bookings: HotacBooking[]
  disruptions: HotacDisruption[]
  loading: boolean
  error: string | null
  lastFetchedAtUtcMs: number | null

  // ── UI ──
  activeTab: HotacTab
  selectedBookingId: string | null
  pollingPaused: boolean
  pollingIntervalMs: number
  /** Disruptions detected since the last time the user opened Day to Day. */
  disruptionsSinceLastView: number

  // ── Actions ──
  setPeriod: (from: string, to: string) => void
  commitPeriod: () => void
  setFilters: (filters: HotacFilters) => void
  setBookings: (bookings: HotacBooking[], disruptions: HotacDisruption[]) => void
  appendDisruptions: (disruptions: HotacDisruption[]) => void
  setLoading: (loading: boolean) => void
  setError: (err: string | null) => void
  setActiveTab: (tab: HotacTab) => void
  setSelectedBookingId: (id: string | null) => void
  setPollingPaused: (paused: boolean) => void
  setPollingIntervalMs: (ms: number) => void
  reset: () => void
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

export const useHotacStore = create<HotacStoreState>((set) => ({
  periodFrom: init.from,
  periodTo: init.to,
  periodCommitted: false,

  filters: EMPTY_HOTAC_FILTERS,

  bookings: [],
  disruptions: [],
  loading: false,
  error: null,
  lastFetchedAtUtcMs: null,

  activeTab: 'planning',
  selectedBookingId: null,
  pollingPaused: false,
  pollingIntervalMs: 60_000,
  disruptionsSinceLastView: 0,

  setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),
  commitPeriod: () => set({ periodCommitted: true }),
  setFilters: (filters) => set({ filters }),
  setBookings: (bookings, disruptions) => set({ bookings, disruptions, lastFetchedAtUtcMs: Date.now(), error: null }),
  appendDisruptions: (next) =>
    set((s) => ({
      disruptions: [...s.disruptions, ...next],
      disruptionsSinceLastView: s.disruptionsSinceLastView + next.length,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (err) => set({ error: err }),
  setActiveTab: (tab) =>
    set((s) => ({
      activeTab: tab,
      // Opening Day to Day clears the unread badge.
      disruptionsSinceLastView: tab === 'dayToDay' ? 0 : s.disruptionsSinceLastView,
    })),
  setSelectedBookingId: (id) => set({ selectedBookingId: id }),
  setPollingPaused: (paused) => set({ pollingPaused: paused }),
  setPollingIntervalMs: (ms) => set({ pollingIntervalMs: ms }),
  reset: () =>
    set({
      periodFrom: init.from,
      periodTo: init.to,
      periodCommitted: false,
      filters: EMPTY_HOTAC_FILTERS,
      bookings: [],
      disruptions: [],
      loading: false,
      error: null,
      lastFetchedAtUtcMs: null,
      activeTab: 'planning',
      selectedBookingId: null,
      pollingPaused: false,
      disruptionsSinceLastView: 0,
    }),
}))
