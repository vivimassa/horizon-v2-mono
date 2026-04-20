'use client'

import { create } from 'zustand'
import type {
  PairingFilters,
  Pairing,
  PairingFlight,
  PairingOptions,
  PairingLegalityStatus,
} from '@/components/crew-ops/pairing/types'
import { DEFAULT_FILTERS } from '@/components/crew-ops/pairing/types'

/**
 * Workspace state for 4.1.5 Crew Pairing. Shared across 4.1.5.1 Text, 4.1.5.2
 * Gantt, and 4.1.5.3 Optimizer so period + scenario + selection survive route
 * changes between the three views.
 *
 * Grid row selection (the flights a user has picked for a new pairing) lives
 * in `use-flight-grid-selection.ts` — this store only owns period, filters,
 * fetched data, and the currently inspected pairing.
 */
interface PairingStoreState {
  // ── Period ──
  periodFrom: string
  periodTo: string
  periodCommitted: boolean

  // ── Applied filters (after Go) ──
  filters: PairingFilters

  // ── Data ──
  flights: PairingFlight[]
  pairings: Pairing[]
  loading: boolean
  error: string | null

  // ── Inspector target ──
  /** Pairing currently shown in the inspector (null = grid-selection mode or idle) */
  inspectedPairingId: string | null
  /** Pairing being edited (F2). null when creating fresh. */
  editingPairingId: string | null

  // ── Complement / pairing options (applied to the in-progress pairing) ──
  activeComplementKey: 'standard' | 'aug1' | 'aug2' | 'custom'
  pairingOptions: PairingOptions

  // ── Actions ──
  setPeriod: (from: string, to: string) => void
  commitPeriod: () => void
  setFilters: (filters: PairingFilters) => void

  setFlights: (flights: PairingFlight[]) => void
  setPairings: (pairings: Pairing[]) => void
  /** Append a new pairing AND mark its flights covered so the pool greys
   *  them out without a round-trip. */
  addPairing: (pairing: Pairing) => void
  /** Remove a pairing AND release its flights back to uncovered. */
  removePairing: (pairingId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  inspectPairing: (pairingId: string | null) => void
  setEditingPairing: (pairingId: string | null) => void

  setComplement: (key: 'standard' | 'aug1' | 'aug2' | 'custom') => void
  setPairingOptions: (patch: Partial<PairingOptions>) => void
}

/** Default 7-day period starting today (UTC YYYY-MM-DD). */
function defaultPeriod(): { from: string; to: string } {
  const today = new Date()
  const from = today.toISOString().slice(0, 10)
  const end = new Date(today)
  end.setUTCDate(end.getUTCDate() + 6)
  const to = end.toISOString().slice(0, 10)
  return { from, to }
}

const initialPeriod = defaultPeriod()

export const usePairingStore = create<PairingStoreState>((set, get) => ({
  periodFrom: initialPeriod.from,
  periodTo: initialPeriod.to,
  periodCommitted: false,

  filters: DEFAULT_FILTERS,

  flights: [],
  pairings: [],
  loading: false,
  error: null,

  inspectedPairingId: null,
  editingPairingId: null,

  activeComplementKey: 'standard',
  pairingOptions: {
    cockpitCount: 2,
    cockpitFacilityClass: null,
    complementKey: 'standard',
    isAcclimatized: true,
    isSinglePilot: false,
    splitDutyRest: null,
  },

  setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),
  commitPeriod: () => set({ periodCommitted: true }),
  setFilters: (filters) => set({ filters }),

  setFlights: (flights) => set({ flights }),
  setPairings: (pairings) => set({ pairings }),
  addPairing: (pairing) => {
    const { pairings, flights } = get()
    const covered = new Set(pairing.flightIds)
    set({
      pairings: [pairing, ...pairings],
      flights: flights.map((f) => (covered.has(f.id) ? { ...f, pairingId: pairing.id } : f)),
    })
  },
  removePairing: (pairingId) => {
    const { pairings, flights } = get()
    set({
      pairings: pairings.filter((p) => p.id !== pairingId),
      flights: flights.map((f) => (f.pairingId === pairingId ? { ...f, pairingId: null } : f)),
    })
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  inspectPairing: (pairingId) => set({ inspectedPairingId: pairingId, editingPairingId: null }),

  setEditingPairing: (pairingId) => set({ editingPairingId: pairingId }),

  setComplement: (key) =>
    set((s) => ({
      activeComplementKey: key,
      pairingOptions: { ...s.pairingOptions, complementKey: key, cockpitCount: complementToCockpit(key) },
    })),

  setPairingOptions: (patch) => set((s) => ({ pairingOptions: { ...s.pairingOptions, ...patch } })),
}))

function complementToCockpit(key: 'standard' | 'aug1' | 'aug2' | 'custom'): number {
  switch (key) {
    case 'standard':
      return 2
    case 'aug1':
      return 3
    case 'aug2':
      return 4
    case 'custom':
      return 2
  }
}

/** Helper selector — worst legality in a group of pairings (for list grouping). */
export function worstStatus(items: Pairing[]): PairingLegalityStatus {
  let worst: PairingLegalityStatus = 'legal'
  for (const p of items) {
    if (p.status === 'violation') return 'violation'
    if (p.status === 'warning') worst = 'warning'
  }
  return worst
}
