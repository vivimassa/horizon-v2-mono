'use client'

import { create } from 'zustand'
import type { CrewComplementRef, CrewPositionRef, OperatorPairingConfig, PairingCreateInput } from '@skyhub/api'
import type {
  PairingFilters,
  Pairing,
  PairingFlight,
  PairingOptions,
  PairingLegalityStatus,
  LegalityResult,
} from '@/components/crew-ops/pairing/types'
import { DEFAULT_FILTERS } from '@/components/crew-ops/pairing/types'

/** A pairing staged for bulk commit — built in memory, not yet written to DB. */
export interface BulkQueuedPairing {
  localId: string
  flightIds: string[]
  pairingCode: string
  baseAirport: string
  aircraftTypeIcao: string | null
  complementKey: string
  cockpitCount: number
  facilityClass: string | null
  crewCounts: Record<string, number> | null
  legs: PairingCreateInput['legs']
  fdtlStatus: 'legal' | 'warning' | 'violation'
  lastLegalityResult: LegalityResult
}

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
  /** ICAO type → family map, loaded once from /aircraft-types. Used for
   *  cross-family pairing validation (e.g. block A350+A380, allow A320+A321). */
  aircraftTypeFamilies: Record<string, string | null>
  /** In-progress pairing's custom crew counts when complementKey === 'custom'.
   *  Keyed by position code (CP, FO, PU, FA, …). Reset when key changes away. */
  customCrewCounts: Record<string, number>
  /** Station → UTC offset hours. Loaded from `/airports` once at shell mount
   *  so the Gantt tooltips can render STD/STA in local time without per-hover
   *  network calls (mirrors the Movement Control gantt pattern). */
  stationUtcOffsets: Record<string, number>
  /** Station ICAO/IATA → ISO2 country code. Loaded from `/airports` alongside
   *  `stationUtcOffsets`. Used by the 4.1.5.4 aircraft-change ground-time
   *  soft rule to decide dom/intl on each leg. */
  stationCountries: Record<string, string>
  /** 4.1.5.4 operator-level pairing-construction policy. `null` = not loaded
   *  yet or no doc → soft rules simply don't fire. */
  pairingConfig: OperatorPairingConfig | null
  /** ISO2 country code of the operator's main base — used as the "home
   *  country" when classifying a leg as domestic vs international. */
  homeCountryIso2: string | null
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
  // The grid's Enter key and right-click "Create Pairing" item dispatch to
  // the Inspector Panel via this field — the Inspector owns all save/dialog
  // state, the grid just announces intent. All new pairings are created as
  // committed (production); draft workflow has been removed from the UI.
  pendingCreateRequest: {
    ids: string[]
  } | null

  // ── Actions ──
  setPeriod: (from: string, to: string) => void
  commitPeriod: () => void
  setFilters: (filters: PairingFilters) => void

  setFlights: (flights: PairingFlight[]) => void
  setPairings: (pairings: Pairing[]) => void
  setComplements: (complements: CrewComplementRef[]) => void
  setPositions: (positions: CrewPositionRef[]) => void
  setAircraftTypeFamilies: (map: Record<string, string | null>) => void
  setCustomCrewCounts: (counts: Record<string, number>) => void
  setStationUtcOffsets: (map: Record<string, number>) => void
  setStationCountries: (map: Record<string, string>) => void
  setPairingConfig: (cfg: OperatorPairingConfig | null) => void
  setHomeCountryIso2: (iso: string | null) => void
  /** Append a new pairing AND mark its flights covered so the pool greys
   *  them out without a round-trip. */
  addPairing: (pairing: Pairing) => void
  /** Replace an existing pairing in-place — used after a successful PATCH
   *  from the Edit Pairing flow so the list + inspector reflect the update. */
  replacePairing: (pairing: Pairing) => void
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

  requestCreatePairing: (ids: string[]) => void
  clearCreateRequest: () => void

  // ── Bulk queue (Gantt bulk mode — staged before DB write) ──
  bulkQueue: BulkQueuedPairing[]
  addToBulkQueue: (item: BulkQueuedPairing) => void
  removeFromBulkQueue: (localId: string) => void
  clearBulkQueue: () => void
}

/** Default 7-day period starting today (UTC YYYY-MM-DD). */
const PERIOD_STORAGE_KEY = 'pairing_period_v1'

function defaultPeriod(): { from: string; to: string } {
  // Restore the last-used period from localStorage so pairings created in
  // a prior session remain visible after refresh. Falls back to today→+6
  // when no persisted value exists (first visit or cleared storage).
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PERIOD_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { from: string; to: string }
        if (parsed.from && parsed.to && /^\d{4}-\d{2}-\d{2}$/.test(parsed.from)) {
          return parsed
        }
      }
    } catch {
      // ignore
    }
  }
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
  aircraftTypeFamilies: {},
  customCrewCounts: {},
  stationUtcOffsets: {},
  stationCountries: {},
  pairingConfig: null,
  homeCountryIso2: null,
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
  bulkQueue: [],

  setPeriod: (from, to) => {
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify({ from, to }))
    } catch {
      // ignore quota / SSR errors
    }
    set({ periodFrom: from, periodTo: to })
  },
  commitPeriod: () => set({ periodCommitted: true }),
  setFilters: (filters) => set({ filters }),

  setFlights: (flights) => set({ flights }),
  setPairings: (pairings) => set({ pairings }),
  setComplements: (complements) => set({ complements }),
  setPositions: (positions) => set({ positions }),
  setAircraftTypeFamilies: (aircraftTypeFamilies) => set({ aircraftTypeFamilies }),
  setCustomCrewCounts: (customCrewCounts) => set({ customCrewCounts }),
  setStationUtcOffsets: (stationUtcOffsets) => set({ stationUtcOffsets }),
  setStationCountries: (stationCountries) => set({ stationCountries }),
  setPairingConfig: (pairingConfig) => set({ pairingConfig }),
  setHomeCountryIso2: (homeCountryIso2) => set({ homeCountryIso2 }),
  addPairing: (pairing) => {
    const { pairings, flights } = get()
    const covered = new Set(pairing.flightIds)
    set({
      pairings: [pairing, ...pairings],
      flights: flights.map((f) => (covered.has(f.id) ? { ...f, pairingId: pairing.id } : f)),
    })
  },
  replacePairing: (pairing) => {
    const { pairings, flights } = get()
    const idx = pairings.findIndex((p) => p.id === pairing.id)
    const next = idx >= 0 ? [...pairings.slice(0, idx), pairing, ...pairings.slice(idx + 1)] : [pairing, ...pairings]
    const covered = new Set(pairing.flightIds)
    // Recompute flight.pairingId membership for this pairing only.
    set({
      pairings: next,
      flights: flights.map((f) =>
        covered.has(f.id)
          ? { ...f, pairingId: pairing.id }
          : f.pairingId === pairing.id
            ? { ...f, pairingId: null }
            : f,
      ),
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

  requestCreatePairing: (ids) => set({ pendingCreateRequest: { ids } }),
  clearCreateRequest: () => set({ pendingCreateRequest: null }),

  addToBulkQueue: (item) => set((s) => ({ bulkQueue: [...s.bulkQueue, item] })),
  removeFromBulkQueue: (localId) => set((s) => ({ bulkQueue: s.bulkQueue.filter((q) => q.localId !== localId) })),
  clearBulkQueue: () => set({ bulkQueue: [] }),
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
