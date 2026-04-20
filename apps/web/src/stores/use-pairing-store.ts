'use client'

import { create } from 'zustand'
import type { CrewComplementRef, CrewPositionRef } from '@skyhub/api'
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
  /** Crew complement templates keyed per (aircraftTypeIcao, templateKey).
   *  Loaded once at shell mount — used to auto-fill `crewCounts` on create and
   *  as a fallback when rendering pairings whose stored crewCounts is null. */
  complements: CrewComplementRef[]
  /** Crew positions (columns for the complement grid) — loaded once. */
  positions: CrewPositionRef[]
  /** Station → UTC offset hours. Loaded from `/airports` once at shell mount
   *  so the Gantt tooltips can render STD/STA in local time without per-hover
   *  network calls (mirrors the Movement Control gantt pattern). */
  stationUtcOffsets: Record<string, number>
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

  // ── Layover mode (text-view Flight Pool only) ──
  // Set by the "Layover at {ARR}" right-click menu item after the planner
  // picks a single outbound flight. While non-null, a floating chip anchored
  // at the menu's click coords shows the station + a +/- day stepper; the
  // next flight added to the selection closes the mode (the gap between leg
  // dates becomes the layover).
  layoverMode: {
    afterFlightId: string
    station: string
    days: number
    /** Viewport-pixel coords of the right-click that opened the menu —
     *  the chip portals to this spot so it replaces the menu in-place. */
    anchorX: number
    anchorY: number
  } | null

  // ── Pending-create request (text view) ──
  // The grid's keyboard (Enter / Shift+Enter) and right-click Draft/Final
  // items dispatch to the Inspector Panel via this field — the Inspector
  // owns all save/dialog state, the grid just announces intent.
  pendingCreateRequest: {
    ids: string[]
    workflow: 'draft' | 'committed'
    label: 'Draft' | 'Final'
  } | null

  // ── Actions ──
  setPeriod: (from: string, to: string) => void
  commitPeriod: () => void
  setFilters: (filters: PairingFilters) => void

  setFlights: (flights: PairingFlight[]) => void
  setPairings: (pairings: Pairing[]) => void
  setComplements: (complements: CrewComplementRef[]) => void
  setPositions: (positions: CrewPositionRef[]) => void
  setStationUtcOffsets: (map: Record<string, number>) => void
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

  startLayover: (afterFlightId: string, station: string, anchorX: number, anchorY: number) => void
  setLayoverDays: (days: number) => void
  clearLayover: () => void

  requestCreatePairing: (ids: string[], workflow: 'draft' | 'committed', label: 'Draft' | 'Final') => void
  clearCreateRequest: () => void
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
  complements: [],
  positions: [],
  stationUtcOffsets: {},
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

  layoverMode: null,
  pendingCreateRequest: null,

  setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),
  commitPeriod: () => set({ periodCommitted: true }),
  setFilters: (filters) => set({ filters }),

  setFlights: (flights) => set({ flights }),
  setPairings: (pairings) => set({ pairings }),
  setComplements: (complements) => set({ complements }),
  setPositions: (positions) => set({ positions }),
  setStationUtcOffsets: (stationUtcOffsets) => set({ stationUtcOffsets }),
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

  startLayover: (afterFlightId, station, anchorX, anchorY) =>
    set({ layoverMode: { afterFlightId, station, days: 1, anchorX, anchorY } }),
  setLayoverDays: (days) =>
    set((s) => (s.layoverMode ? { layoverMode: { ...s.layoverMode, days: Math.max(1, days) } } : {})),
  clearLayover: () => set({ layoverMode: null }),

  requestCreatePairing: (ids, workflow, label) => set({ pendingCreateRequest: { ids, workflow, label } }),
  clearCreateRequest: () => set({ pendingCreateRequest: null }),
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

/** Resolve the crew complement counts for a (aircraftType, templateKey) pair
 *  from the list loaded into the pairing store. Returns `null` when nothing
 *  matches — callers should treat that as "complement not configured yet". */
export function resolveComplementCounts(
  complements: CrewComplementRef[],
  aircraftTypeIcao: string | null | undefined,
  templateKey: string | null | undefined,
): Record<string, number> | null {
  if (!aircraftTypeIcao || !templateKey) return null
  const match = complements.find(
    (c) => c.aircraftTypeIcao === aircraftTypeIcao && c.templateKey === templateKey && c.isActive,
  )
  return match ? match.counts : null
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
