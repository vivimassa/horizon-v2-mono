import { create } from 'zustand'

export interface GroundOpsFlight {
  id: string
  dep: string
  arr: string
  reg: string
  type: string
  std: string
  gate: string
  status: string
}

interface GroundOpsState {
  selectedFlight: GroundOpsFlight | null
  setSelectedFlight: (flight: GroundOpsFlight | null) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  station: string
  setStation: (station: string) => void
}

export const useGroundOpsStore = create<GroundOpsState>((set) => ({
  selectedFlight: null,
  setSelectedFlight: (flight) => set({ selectedFlight: flight }),
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
  station: 'SGN',
  setStation: (station) => set({ station }),
}))
