'use client'

import { create } from 'zustand'
import type { CrewFlightBookingRef, PairingRef } from '@skyhub/api'
import { EMPTY_TRANSPORT_FILTERS, type CrewTransportFilters } from '@/stores/use-crew-transport-filter-store'
import type { TransportTrip } from '@/components/crew-ops/transport/types'

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

  // ── Data ──
  trips: TransportTrip[]
  /** Cached pairings from the last Go — used by Flight views to find deadhead legs. */
  pairings: PairingRef[]
  /** Cached flight bookings keyed by deterministic (pairingId::legId). */
  flightBookings: CrewFlightBookingRef[]
  loading: boolean
  error: string | null
  lastFetchedAtUtcMs: number | null

  // ── UI ──
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
  setTrips: (trips: TransportTrip[]) => void
  upsertTrip: (trip: TransportTrip) => void
  setPairings: (p: PairingRef[]) => void
  setFlightBookings: (b: CrewFlightBookingRef[]) => void
  upsertFlightBooking: (b: CrewFlightBookingRef) => void
  removeFlightBooking: (id: string) => void
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

  trips: [],
  pairings: [],
  flightBookings: [],
  loading: false,
  error: null,
  lastFetchedAtUtcMs: null,

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
  setTrips: (trips) => set({ trips, lastFetchedAtUtcMs: Date.now(), error: null }),
  upsertTrip: (trip) =>
    set((s) => {
      const idx = s.trips.findIndex((t) => t.id === trip.id)
      if (idx === -1) return { trips: [...s.trips, trip] }
      const next = s.trips.slice()
      next[idx] = trip
      return { trips: next }
    }),
  setPairings: (pairings) => set({ pairings }),
  setFlightBookings: (flightBookings) => set({ flightBookings }),
  upsertFlightBooking: (b) =>
    set((s) => {
      const idx = s.flightBookings.findIndex((x) => x._id === b._id)
      if (idx === -1) return { flightBookings: [...s.flightBookings, b] }
      const next = s.flightBookings.slice()
      next[idx] = b
      return { flightBookings: next }
    }),
  removeFlightBooking: (id) => set((s) => ({ flightBookings: s.flightBookings.filter((b) => b._id !== id) })),
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
      trips: [],
      pairings: [],
      flightBookings: [],
      loading: false,
      error: null,
      lastFetchedAtUtcMs: null,
      selectedTripId: null,
      selectedFlightBookingId: null,
      pollingPaused: false,
    }),
}))
