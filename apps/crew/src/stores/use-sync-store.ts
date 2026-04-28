import { create } from 'zustand'

export interface SyncCounts {
  assignments: number
  pairings: number
  legs: number
  activities: number
  messages: number
}

interface SyncState {
  lastSyncMs: number | null
  lastError: string | null
  inFlight: boolean
  counts: SyncCounts | null
  setStarted(): void
  setSuccess(counts: SyncCounts): void
  setError(msg: string): void
}

export const useSyncStore = create<SyncState>((set) => ({
  lastSyncMs: null,
  lastError: null,
  inFlight: false,
  counts: null,
  setStarted: () => set({ inFlight: true }),
  setSuccess: (counts) => set({ inFlight: false, lastSyncMs: Date.now(), lastError: null, counts }),
  setError: (msg) => set({ inFlight: false, lastError: msg }),
}))
