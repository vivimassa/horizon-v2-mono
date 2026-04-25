'use client'

import { create } from 'zustand'
import { EMPTY_TRANSPORT_FILTERS, type CrewTransportFilters } from '@/stores/use-crew-transport-filter-store'

export type TransportSegment = 'ground' | 'flight'
export type GroundTab = 'planning' | 'dayToDay' | 'communication'
export type FlightTab = 'open' | 'booked' | 'history'

interface CrewTransportStoreState {
  // ── Period (committed after Go) ──
  periodFrom: string
  periodTo: string
  periodCommitted: boolean

  filters: CrewTransportFilters

  // ── Segment + tabs ──
  segment: TransportSegment
  groundTab: GroundTab
  flightTab: FlightTab

  // ── Data (Phase C/D wires real fetches) ──
  // Server rows are not stored here yet — Phase C will add `trips` and
  // `flightBookings` arrays. For now the shell only owns period/filter/UI state.

  // ── UI ──
  loading: boolean
  error: string | null
  selectedTripId: string | null
  selectedFlightBookingId: string | null

  // Polling control
  pollingPaused: boolean
  pollingIntervalMs: number

  // ── Actions ──
  setPeriod: (from: string, to: string) => void
  commitPeriod: () => void
  setFilters: (filters: CrewTransportFilters) => void
  setSegment: (s: TransportSegment) => void
  setGroundTab: (t: GroundTab) => void
  setFlightTab: (t: FlightTab) => void
  setLoading: (l: boolean) => void
  setError: (e: string | null) => void
  setSelectedTripId: (id: string | null) => void
  setSelectedFlightBookingId: (id: string | null) => void
  setPollingPaused: (p: boolean) => void
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

export const useCrewTransportStore = create<CrewTransportStoreState>((set) => ({
  periodFrom: init.from,
  periodTo: init.to,
  periodCommitted: false,
  filters: EMPTY_TRANSPORT_FILTERS,

  segment: 'ground',
  groundTab: 'planning',
  flightTab: 'open',

  loading: false,
  error: null,
  selectedTripId: null,
  selectedFlightBookingId: null,

  pollingPaused: false,
  pollingIntervalMs: 60_000,

  setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),
  commitPeriod: () => set({ periodCommitted: true }),
  setFilters: (filters) => set({ filters }),
  setSegment: (segment) => set({ segment }),
  setGroundTab: (groundTab) => set({ groundTab }),
  setFlightTab: (flightTab) => set({ flightTab }),
  setLoading: (loading) => set({ loading }),
  setError: (err) => set({ error: err }),
  setSelectedTripId: (id) => set({ selectedTripId: id }),
  setSelectedFlightBookingId: (id) => set({ selectedFlightBookingId: id }),
  setPollingPaused: (p) => set({ pollingPaused: p }),
  setPollingIntervalMs: (ms) => set({ pollingIntervalMs: ms }),

  reset: () =>
    set({
      periodFrom: init.from,
      periodTo: init.to,
      periodCommitted: false,
      filters: EMPTY_TRANSPORT_FILTERS,
      segment: 'ground',
      groundTab: 'planning',
      flightTab: 'open',
      loading: false,
      error: null,
      selectedTripId: null,
      selectedFlightBookingId: null,
      pollingPaused: false,
    }),
}))
