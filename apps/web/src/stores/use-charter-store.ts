'use client'

import { create } from 'zustand'
import { api } from '@skyhub/api'
import type { CharterContractRef, CharterFlightRef, CharterContractStats } from '@skyhub/api'
import { getOperatorId, useOperatorStore } from './use-operator-store'

interface CharterState {
  contracts: CharterContractRef[]
  selectedId: string | null
  flights: CharterFlightRef[]
  stats: CharterContractStats
  dataLoaded: boolean

  loadContracts: () => Promise<CharterContractRef[]>
  selectContract: (id: string | null) => Promise<void>
  refreshFlightsAndStats: () => Promise<void>
  reset: () => void
}

const emptyStats: CharterContractStats = {
  totalFlights: 0,
  revenueFlights: 0,
  positioningFlights: 0,
  totalBlockMinutes: 0,
  estimatedRevenue: 0,
  paxTotal: 0,
}

export const useCharterStore = create<CharterState>((set, get) => ({
  contracts: [],
  selectedId: null,
  flights: [],
  stats: { ...emptyStats },
  dataLoaded: false,

  loadContracts: async () => {
    let opId = getOperatorId()
    if (!opId) {
      // Operator not loaded yet — wait for it
      await useOperatorStore.getState().loadOperator()
      opId = getOperatorId()
    }
    if (!opId) return []
    const contracts = await api.getCharterContracts(opId)
    set({ contracts, dataLoaded: true })
    return contracts
  },

  selectContract: async (id) => {
    set({ selectedId: id, flights: [], stats: { ...emptyStats } })
    if (!id) return

    const [flights, stats] = await Promise.all([api.getCharterFlights(id), api.getCharterStats(id)])
    set({ flights, stats })
  },

  refreshFlightsAndStats: async () => {
    const { selectedId } = get()
    if (!selectedId) return

    const [flights, stats] = await Promise.all([api.getCharterFlights(selectedId), api.getCharterStats(selectedId)])
    set({ flights, stats })
  },

  reset: () =>
    set({
      contracts: [],
      selectedId: null,
      flights: [],
      stats: { ...emptyStats },
      dataLoaded: false,
    }),
}))
