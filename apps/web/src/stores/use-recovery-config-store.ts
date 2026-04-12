import { create } from 'zustand'
import type { RecoveryConfig } from '@/components/flight-ops/gantt/recovery-config-panel'

interface RecoveryConfigStore {
  config: RecoveryConfig
  loaded: boolean // true once operator defaults have been applied
  setConfig: (patch: Partial<RecoveryConfig>) => void
  resetConfig: (full: RecoveryConfig) => void
  setLoaded: () => void
}

const DEFAULT_CONFIG: RecoveryConfig = {
  objective: 'min_cost',
  objectiveWeights: null,
  horizonHours: 12,
  lockThresholdMinutes: 60,
  maxDelayPerFlightMinutes: 0,
  referenceTimeUtc: '',
  respectCurfews: true,
  connectionProtectionMinutes: 45,
  maxCrewDutyHours: 12,
  maxSwapsPerAircraft: 0,
  propagationMultiplier: 1.5,
  delayCostPerMinute: 50,
  cancelCostPerFlight: 50000,
  fuelPricePerKg: 0.8,
  maxSolutions: 3,
  maxSolveSeconds: 60,
  minImprovementUsd: 0,
}

export const useRecoveryConfigStore = create<RecoveryConfigStore>((set) => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  resetConfig: (full) => set({ config: full }),
  setLoaded: () => set({ loaded: true }),
}))
