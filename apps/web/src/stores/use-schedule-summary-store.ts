'use client'

import { create } from 'zustand'
import type { Flight, AircraftTypeRef, AircraftRegistrationRef, CityPairRef } from '@skyhub/api'
import type {
  FlightTypeFilter,
  ScheduleSummaryFilters,
} from '@/components/network/schedule-summary/schedule-summary-types'

interface ScheduleSummaryState {
  // Live (user-editing) filter state
  dateFrom: string
  dateTo: string
  acType: string
  serviceType: string
  flightType: FlightTypeFilter

  // Route table UI state
  routeSearch: string
  showAllRoutes: boolean

  // Committed dataset — populated on Go
  committed: ScheduleSummaryFilters | null
  flights: Flight[]
  aircraftTypes: AircraftTypeRef[]
  registrations: AircraftRegistrationRef[]
  cityPairs: CityPairRef[]

  // Actions
  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  setAcType: (v: string) => void
  setServiceType: (v: string) => void
  setFlightType: (v: FlightTypeFilter) => void
  setRouteSearch: (v: string) => void
  setShowAllRoutes: (v: boolean) => void
  resetFilters: () => void
  commit: (payload: {
    flights: Flight[]
    aircraftTypes: AircraftTypeRef[]
    registrations: AircraftRegistrationRef[]
    cityPairs: CityPairRef[]
  }) => void
}

export const useScheduleSummaryStore = create<ScheduleSummaryState>((set, get) => ({
  dateFrom: '',
  dateTo: '',
  acType: 'all',
  serviceType: 'all',
  flightType: 'all',

  routeSearch: '',
  showAllRoutes: false,

  committed: null,
  flights: [],
  aircraftTypes: [],
  registrations: [],
  cityPairs: [],

  setDateFrom: (v) => set({ dateFrom: v }),
  setDateTo: (v) => set({ dateTo: v }),
  setAcType: (v) => set({ acType: v }),
  setServiceType: (v) => set({ serviceType: v }),
  setFlightType: (v) => set({ flightType: v }),
  setRouteSearch: (v) => set({ routeSearch: v }),
  setShowAllRoutes: (v) => set({ showAllRoutes: v }),

  resetFilters: () => set({ acType: 'all', serviceType: 'all', flightType: 'all' }),

  commit: ({ flights, aircraftTypes, registrations, cityPairs }) => {
    const s = get()
    set({
      flights,
      aircraftTypes,
      registrations,
      cityPairs,
      committed: {
        dateFrom: s.dateFrom,
        dateTo: s.dateTo,
        acType: s.acType,
        serviceType: s.serviceType,
        flightType: s.flightType,
      },
    })
  },
}))

export function scheduleSummaryActiveCount(s: {
  acType: string
  serviceType: string
  flightType: FlightTypeFilter
}): number {
  let n = 0
  if (s.acType !== 'all') n++
  if (s.serviceType !== 'all') n++
  if (s.flightType !== 'all') n++
  return n
}
