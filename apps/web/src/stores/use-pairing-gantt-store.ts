'use client'

import { create } from 'zustand'
import type {
  GanttFlight,
  GanttAircraft,
  GanttAircraftType,
  LayoutResult,
  ZoomLevel,
  BarLabelMode,
  ColorMode,
  FleetSortOrder,
} from '@/lib/gantt/types'
import { computeLayout } from '@/lib/gantt/layout-engine'
import { computePixelsPerHour } from '@/lib/gantt/time-axis'

/**
 * View-local state for 4.1.5.2 Crew Pairing — Gantt Chart.
 *
 * Mirrors `use-gantt-store` (Movement Control / 2.1.1) in shape and recompute
 * semantics so the Movement Control canvas primitives can be reused verbatim.
 * On top of that it carries the pairing-zone state (deck height, filter tabs)
 * and scaffolds build-mode state for manual pairing creation.
 *
 * Workspace-level state (period, filters, pairings, flights source-of-truth,
 * inspectedPairingId) lives in `use-pairing-store` and is shared across
 * Text / Gantt / Optimizer — this store is only the Gantt view's compute +
 * render state.
 */

export type PairingColorMode = 'pairing_status' | 'crew_complement' | 'ac_type'
export type PairingZoneFilter = 'all' | 'covered' | 'partial' | 'under' | 'over' | 'augmented' | 'illegal'

export type ReviewFilterMode =
  | 'all' // 1. All pairings (no filter)
  | 'operating' // 2. Has ≥1 operating (non-DH) leg
  | 'unfinalized' // 3. workflowStatus = 'draft'
  | 'deadhead' // 4. Has ≥1 deadhead leg
  | 'non_base_to_base' // 5. Last leg arr ≠ baseAirport
  | 'illegal' // 6. status = 'violation'
  | 'partial_uncovered' // 7. Associated with under-covered A/C legs
  | 'over_covered' // 8. Associated with over-covered A/C legs
  | 'over_and_under' // 9. Associated with both under AND over-covered legs
  | 'any_coverage' // 10. Any coverage problem

export interface SmartFilters {
  logic: 'AND' | 'OR'
  /** Empty = all statuses (not filtered). */
  statuses: Array<'legal' | 'warning' | 'violation'>
  hasDeadhead: boolean | null
  nonBaseToBase: boolean | null
  routeLengthMin: number | null
  routeLengthMax: number | null
  /** Empty = all positions (not filtered). */
  positionCodes: string[]
  /** ICAO code or '' (not filtered). */
  dhStation: string
}

interface SearchHighlight {
  registration: string
  phase: number
  expiresAt: number
}

interface PairingGanttState {
  // ── Layout inputs (pushed by the shell after fetching + converting) ──
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  periodFrom: string
  periodTo: string

  // ── View ──
  zoomLevel: ZoomLevel
  rowHeightLevel: number
  colorMode: ColorMode
  barLabelMode: BarLabelMode
  fleetSortOrder: FleetSortOrder
  collapsedTypes: Set<string>
  containerWidth: number

  // ── Pairing zone ──
  zoneOpen: boolean
  zoneHeightRatio: number
  zoneFilter: PairingZoneFilter
  reviewFilterMode: ReviewFilterMode
  smartFilters: SmartFilters | null

  // ── Selection / hover ──
  selectedFlightIds: Set<string>
  hoveredFlightId: string | null
  hoveredPairingId: string | null

  // ── UI toggles ──
  searchOpen: boolean
  fullscreen: boolean
  buildMode: boolean
  bulkMode: boolean

  // ── Build mode — deadhead tracking ──
  /** Flight ids in the current build chain that the planner has marked as deadhead. */
  deadheadFlightIds: Set<string>

  // ── Next-leg proposal (build mode helper) ──
  proposalEnabled: boolean
  /** 1..7 — how many days ahead of chain's last STA to surface candidates. */
  proposalDays: number
  /** Candidate flight ids — recomputed when chain / pairings / toggle / days change. */
  proposalCandidateIds: Set<string>
  /** Tail hosting the nearest candidate — pinned to top of layout while proposal is on. */
  proposalPinnedRegistration: string | null

  // ── Overlays (mirror Movement Control) ──
  showTat: boolean
  centerTimebar: boolean
  /** Stored for Format popover; not wired to a fetch cadence (pairings don't auto-refresh). */
  refreshIntervalMins: number

  // ── Animations ──
  searchHighlight: SearchHighlight | null

  // ── Computed ──
  layout: LayoutResult | null
  /** Scroll target — canvas centers horizontally on this UTC ms on next paint. */
  scrollTargetMs: number | null

  // ── Actions: data ──
  setFlights: (flights: GanttFlight[]) => void
  setAircraft: (aircraft: GanttAircraft[]) => void
  setAircraftTypes: (types: GanttAircraftType[]) => void
  setPeriod: (from: string, to: string) => void

  // ── Actions: view ──
  setZoom: (z: ZoomLevel) => void
  setRowHeightLevel: (level: number) => void
  cycleRowHeight: (delta: 1 | -1) => void
  setColorMode: (m: ColorMode) => void
  setBarLabelMode: (m: BarLabelMode) => void
  setFleetSortOrder: (o: FleetSortOrder) => void
  toggleTypeCollapse: (icaoType: string) => void
  setContainerWidth: (w: number) => void

  // ── Actions: zone ──
  toggleZoneOpen: () => void
  setZoneHeightRatio: (r: number) => void
  setZoneFilter: (f: PairingZoneFilter) => void
  setReviewFilterMode: (mode: ReviewFilterMode) => void
  setSmartFilters: (f: SmartFilters | null) => void

  // ── Actions: selection ──
  selectFlight: (id: string, multi?: boolean) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  setHoveredPairingId: (id: string | null) => void

  // ── Actions: UI ──
  toggleSearch: () => void
  setFullscreen: (v: boolean) => void
  setBuildMode: (v: boolean) => void
  setBulkMode: (v: boolean) => void
  toggleDeadheadFlight: (id: string) => void
  clearDeadheadFlights: () => void
  toggleProposal: () => void
  setProposalDays: (d: number) => void
  setProposalCandidates: (ids: Set<string>, pinnedRegistration: string | null) => void
  toggleTat: () => void
  toggleCenterTimebar: () => void
  setRefreshIntervalMins: (mins: number) => void
  goToToday: () => void

  // ── Actions: search highlight ──
  startSearchHighlight: (registration: string) => void
  advanceSearchHighlight: (phase: number) => void
  clearSearchHighlight: () => void

  // ── Actions: scroll ──
  setScrollTarget: (ms: number) => void
  consumeScrollTarget: () => void

  // ── Compute ──
  recompute: () => void
}

const STORAGE_KEY_ZONE_RATIO = 'pairing-gantt.zoneHeightRatio'
const STORAGE_KEY_ROW_HEIGHT = 'pairing-gantt.rowHeightLevel'
const STORAGE_KEY_ZONE_OPEN = 'pairing-gantt.zoneOpen'
const STORAGE_KEY_PLACEMENTS = 'pairing-gantt.virtualPlacements'
const STORAGE_KEY_ZOOM = 'pairing-gantt.zoomLevel'
const STORAGE_KEY_LABEL_MODE = 'pairing-gantt.barLabelMode'

const VALID_ZOOMS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '14D', '21D', '28D']

function readStoredString<T extends string>(key: string, allowed: T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return allowed.includes(raw as T) ? (raw as T) : fallback
  } catch {
    return fallback
  }
}

function readStoredNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function readStoredBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === '1' || raw === 'true'
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

// Debounced recompute — coalesce rapid property changes (zoom, row height,
// collapse toggle) so we don't thrash `computeLayout`.
let recomputeTimer: ReturnType<typeof setTimeout> | null = null
function scheduleRecompute(fn: () => void) {
  if (recomputeTimer) clearTimeout(recomputeTimer)
  recomputeTimer = setTimeout(() => {
    recomputeTimer = null
    fn()
  }, 16)
}

export const usePairingGanttStore = create<PairingGanttState>((set, get) => {
  function doRecompute() {
    const s = get()
    if (!s.flights.length || !s.periodFrom || !s.periodTo) {
      set({ layout: null })
      return
    }
    // Fallback width so the first layout can run before the canvas has
    // reported its own ResizeObserver size. Matches Movement Control
    // (`use-gantt-store`) — once the canvas mounts, its observer pushes
    // the real width and recompute runs again.
    const width = s.containerWidth || 1200
    const pph = computePixelsPerHour(width, s.zoomLevel)
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

    // Hydrate prior placements for visual continuity across reloads.
    let prevPlacements: Map<string, string> | undefined
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY_PLACEMENTS)
        if (raw) {
          const arr = JSON.parse(raw) as Array<[string, string]>
          prevPlacements = new Map(arr)
        }
      } catch {
        /* ignore */
      }
    }

    const layout = computeLayout({
      flights: s.flights,
      aircraft: s.aircraft,
      aircraftTypes: s.aircraftTypes,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      pph,
      zoom: s.zoomLevel,
      rowHeightLevel: s.rowHeightLevel,
      collapsedTypes: s.collapsedTypes,
      colorMode: s.colorMode,
      barLabelMode: s.barLabelMode,
      fleetSortOrder: s.fleetSortOrder,
      isDark,
      containerWidth: width,
      previousVirtualPlacements: prevPlacements,
    })
    set({ layout })

    try {
      window.localStorage.setItem(STORAGE_KEY_PLACEMENTS, JSON.stringify([...layout.virtualPlacements]))
    } catch {
      /* quota — non-critical */
    }
  }

  return {
    // Data
    flights: [],
    aircraft: [],
    aircraftTypes: [],
    periodFrom: '',
    periodTo: '',

    // View
    zoomLevel: readStoredString<ZoomLevel>(STORAGE_KEY_ZOOM, VALID_ZOOMS, '3D'),
    rowHeightLevel: readStoredNumber(STORAGE_KEY_ROW_HEIGHT, 1),
    colorMode: 'status',
    barLabelMode: readStoredString<BarLabelMode>(STORAGE_KEY_LABEL_MODE, ['flightNo', 'sector'], 'sector'),
    fleetSortOrder: 'type',
    collapsedTypes: new Set<string>(),
    containerWidth: 0,

    // Zone
    zoneOpen: readStoredBool(STORAGE_KEY_ZONE_OPEN, true),
    zoneHeightRatio: Math.min(0.6, Math.max(0.1, readStoredNumber(STORAGE_KEY_ZONE_RATIO, 0.25))),
    zoneFilter: 'all',
    reviewFilterMode: 'all',
    smartFilters: null,

    // Selection / hover
    selectedFlightIds: new Set<string>(),
    hoveredFlightId: null,
    hoveredPairingId: null,

    // UI
    searchOpen: false,
    fullscreen: false,
    buildMode: true,
    bulkMode: false,
    deadheadFlightIds: new Set<string>(),

    // Proposal (session-only; resets on reload, defaults ON)
    proposalEnabled: true,
    proposalDays: 1,
    proposalCandidateIds: new Set<string>(),
    proposalPinnedRegistration: null,

    // Overlays
    showTat: false,
    centerTimebar: false,
    refreshIntervalMins: 15,

    searchHighlight: null,

    // Computed
    layout: null,
    scrollTargetMs: null,

    // ── Data actions ──
    setFlights: (flights) => {
      set({ flights })
      scheduleRecompute(doRecompute)
    },
    setAircraft: (aircraft) => {
      set({ aircraft })
      scheduleRecompute(doRecompute)
    },
    setAircraftTypes: (aircraftTypes) => {
      set({ aircraftTypes })
      scheduleRecompute(doRecompute)
    },
    setPeriod: (from, to) => {
      set({ periodFrom: from, periodTo: to })
      scheduleRecompute(doRecompute)
    },

    // ── View actions ──
    setZoom: (z) => {
      writeStored(STORAGE_KEY_ZOOM, z)
      set({ zoomLevel: z })
      scheduleRecompute(doRecompute)
    },
    setRowHeightLevel: (level) => {
      const clamped = Math.max(0, Math.min(3, level))
      writeStored(STORAGE_KEY_ROW_HEIGHT, String(clamped))
      set({ rowHeightLevel: clamped })
      scheduleRecompute(doRecompute)
    },
    cycleRowHeight: (delta) => {
      const current = get().rowHeightLevel
      const next = Math.max(0, Math.min(3, current + delta))
      if (next === current) return
      writeStored(STORAGE_KEY_ROW_HEIGHT, String(next))
      set({ rowHeightLevel: next })
      scheduleRecompute(doRecompute)
    },
    setColorMode: (m) => {
      set({ colorMode: m })
      scheduleRecompute(doRecompute)
    },
    setBarLabelMode: (m) => {
      writeStored(STORAGE_KEY_LABEL_MODE, m)
      set({ barLabelMode: m })
      scheduleRecompute(doRecompute)
    },
    setFleetSortOrder: (o) => {
      set({ fleetSortOrder: o })
      scheduleRecompute(doRecompute)
    },
    toggleTypeCollapse: (icaoType) => {
      const next = new Set(get().collapsedTypes)
      if (next.has(icaoType)) next.delete(icaoType)
      else next.add(icaoType)
      set({ collapsedTypes: next })
      scheduleRecompute(doRecompute)
    },
    setContainerWidth: (w) => {
      if (w === get().containerWidth) return
      set({ containerWidth: w })
      scheduleRecompute(doRecompute)
    },

    // ── Zone actions ──
    toggleZoneOpen: () => {
      const next = !get().zoneOpen
      writeStored(STORAGE_KEY_ZONE_OPEN, next ? '1' : '0')
      set({ zoneOpen: next })
    },
    setZoneHeightRatio: (r) => {
      const clamped = Math.min(0.6, Math.max(0.1, r))
      writeStored(STORAGE_KEY_ZONE_RATIO, String(clamped))
      set({ zoneHeightRatio: clamped })
    },
    setZoneFilter: (f) => set({ zoneFilter: f }),
    setReviewFilterMode: (mode) => set({ reviewFilterMode: mode }),
    setSmartFilters: (f) => set({ smartFilters: f }),

    // ── Selection actions ──
    selectFlight: (id, multi = false) => {
      const current = get().selectedFlightIds
      if (multi) {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        set({ selectedFlightIds: next })
      } else {
        if (current.size === 1 && current.has(id)) {
          set({ selectedFlightIds: new Set() })
        } else {
          set({ selectedFlightIds: new Set([id]) })
        }
      }
    },
    clearSelection: () => set({ selectedFlightIds: new Set(), deadheadFlightIds: new Set() }),
    setHovered: (id) => {
      if (id === get().hoveredFlightId) return
      set({ hoveredFlightId: id })
    },
    setHoveredPairingId: (id) => {
      if (id === get().hoveredPairingId) return
      set({ hoveredPairingId: id })
    },

    // ── UI ──
    toggleSearch: () => set({ searchOpen: !get().searchOpen }),
    setFullscreen: (v) => set({ fullscreen: v }),
    setBuildMode: (v) => {
      // Turning build off also exits bulk mode and clears deadhead state.
      set({
        buildMode: v,
        bulkMode: v ? get().bulkMode : false,
        selectedFlightIds: new Set(),
        deadheadFlightIds: new Set(),
      })
    },
    setBulkMode: (v) => {
      set({ bulkMode: v })
    },
    toggleDeadheadFlight: (id) => {
      const next = new Set(get().deadheadFlightIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      set({ deadheadFlightIds: next })
    },
    clearDeadheadFlights: () => set({ deadheadFlightIds: new Set() }),
    toggleProposal: () => {
      const next = !get().proposalEnabled
      set({
        proposalEnabled: next,
        // Clear candidates + unpin when turning off so layout reverts.
        ...(next ? {} : { proposalCandidateIds: new Set<string>(), proposalPinnedRegistration: null }),
      })
      scheduleRecompute(doRecompute)
    },
    setProposalDays: (d) => {
      const clamped = Math.max(1, Math.min(7, Math.round(d)))
      if (clamped === get().proposalDays) return
      set({ proposalDays: clamped })
    },
    setProposalCandidates: (ids, pinnedRegistration) => {
      const state = get()
      const prevIds = state.proposalCandidateIds
      const prevPinned = state.proposalPinnedRegistration
      const sameSet = prevIds.size === ids.size && [...ids].every((v) => prevIds.has(v))
      if (sameSet && prevPinned === pinnedRegistration) return
      // No scheduleRecompute — proposal now highlights + scrolls (C); fleet
      // row order stays stable so the grid doesn't reshuffle on each chain edit.
      set({ proposalCandidateIds: ids, proposalPinnedRegistration: pinnedRegistration })
    },
    toggleTat: () => set({ showTat: !get().showTat }),
    toggleCenterTimebar: () => {
      const next = !get().centerTimebar
      set({ centerTimebar: next })
      if (next) set({ scrollTargetMs: Date.now() })
    },
    setRefreshIntervalMins: (mins) => set({ refreshIntervalMins: Math.max(1, Math.min(59, mins)) }),
    goToToday: () => set({ scrollTargetMs: Date.now() }),

    // ── Search highlight ──
    startSearchHighlight: (registration) =>
      set({ searchHighlight: { registration, phase: 0, expiresAt: performance.now() + 3800 } }),
    advanceSearchHighlight: (phase) => {
      const cur = get().searchHighlight
      if (!cur) return
      set({ searchHighlight: { ...cur, phase } })
    },
    clearSearchHighlight: () => set({ searchHighlight: null }),

    // ── Scroll target ──
    setScrollTarget: (ms) => set({ scrollTargetMs: ms }),
    consumeScrollTarget: () => set({ scrollTargetMs: null }),

    // ── Public recompute (used after manual data swap, rare) ──
    recompute: () => scheduleRecompute(doRecompute),
  }
})
