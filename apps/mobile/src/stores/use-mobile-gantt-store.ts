// Mobile Gantt store — module 1.1.2.
// Mirrors web's useGanttStore in shape, omits desktop-only state (right-click
// menus, fullscreen, search overlay) which become bottom sheets on mobile.

import { create } from 'zustand'
import { api } from '@skyhub/api'
import { computeLayout, computePixelsPerHour, type LayoutInput } from '@skyhub/logic'
import type {
  GanttFlight,
  GanttAircraft,
  GanttAircraftType,
  ZoomLevel,
  ColorMode,
  BarLabelMode,
  FleetSortOrder,
  LayoutResult,
} from '@skyhub/types'
import { readCachedPeriod, writeCachedPeriod, listPending } from '../lib/gantt/cache'
import { readCachedPeriodFromWmdb, writeCachedPeriodToWmdb, listPendingFromWmdb } from '../lib/gantt/wmdb-bridge'

const DEFAULT_PERIOD_DAYS = 3

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export type DetailSheetTarget =
  | { kind: 'flight'; flightId: string }
  | { kind: 'aircraft'; registration: string }
  | { kind: 'day'; date: string }
  | null

export type MutationSheetTarget =
  | { kind: 'cancel'; flightIds: string[] }
  | { kind: 'reschedule'; flightId: string }
  | { kind: 'swap'; aFlightIds: string[]; bFlightIds: string[] }
  | { kind: 'divert'; flightId: string }
  | { kind: 'addFlight' }
  | { kind: 'editFlight'; flightId: string }
  | { kind: 'assign'; flightIds: string[]; aircraftTypeIcao: string | null }
  | { kind: 'aircraftContext'; registration: string }
  | { kind: 'dayContext'; date: string }
  | { kind: 'scenario' }
  | { kind: 'compare' }
  | { kind: 'optimizer' }
  | null

interface GanttState {
  // ── Data ──
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  loading: boolean
  error: string | null

  // ── Period & filters ──
  periodFrom: string
  periodTo: string
  periodCommitted: boolean
  acTypeFilter: string[] | null
  statusFilter: string[] | null
  scenarioId: string | null

  // ── View ──
  zoom: ZoomLevel
  rowHeightLevel: number
  collapsedTypes: Set<string>
  colorMode: ColorMode
  barLabelMode: BarLabelMode
  fleetSortOrder: FleetSortOrder
  containerWidth: number
  containerHeight: number
  isDark: boolean

  // ── Overlay toggles ──
  showTat: boolean
  showSlots: boolean
  showMissingTimes: boolean
  showDelays: boolean
  oooiGraceMins: number
  considerableDelayMins: number

  // ── Layout (derived) ──
  layout: LayoutResult | null

  // ── Selection ──
  selectionMode: boolean
  selectedFlightIds: Set<string>
  selectionRotationId: string | null

  // ── Sheets ──
  detailSheet: DetailSheetTarget
  filterSheetOpen: boolean
  searchSheetOpen: boolean
  mutationSheet: MutationSheetTarget

  // ── Optimistic state ──
  /** Optimistic forced placements applied to layout. Reverted on API failure. */
  forcedPlacements: Map<string, string>
  toastMessage: { kind: 'success' | 'error' | 'info'; text: string } | null

  // ── Sync state ──
  /** True when last loaded data came from local cache, not server. */
  isStale: boolean
  /** Pending mutations awaiting server sync (read from MMKV queue). */
  pendingMutationsCount: number

  // ── Actions ──
  setPeriod: (from: string, to: string) => void
  setAcTypeFilter: (types: string[] | null) => void
  setStatusFilter: (statuses: string[] | null) => void
  setZoom: (z: ZoomLevel) => void
  cycleZoom: (dir: 1 | -1) => void
  cycleRowHeight: () => void
  setColorMode: (m: ColorMode) => void
  setBarLabelMode: (m: BarLabelMode) => void
  setFleetSortOrder: (o: FleetSortOrder) => void
  toggleTypeCollapse: (icaoType: string) => void
  setContainerSize: (w: number, h: number) => void
  setIsDark: (d: boolean) => void

  commitPeriod: (operatorId: string) => Promise<void>
  refresh: (operatorId: string) => Promise<void>

  openDetailSheet: (target: DetailSheetTarget) => void
  closeDetailSheet: () => void
  setFilterSheetOpen: (open: boolean) => void
  setSearchSheetOpen: (open: boolean) => void
  openMutationSheet: (target: MutationSheetTarget) => void
  closeMutationSheet: () => void

  toggleTat: () => void
  toggleSlots: () => void
  toggleMissingTimes: () => void
  toggleDelays: () => void
  setOooiGraceMins: (n: number) => void

  /** Apply optimistic placement and recompute layout. */
  applyOptimisticPlacement: (flightIds: string[], registration: string) => void
  /** Roll back specific flightIds from forcedPlacements. */
  revertOptimisticPlacement: (flightIds: string[]) => void
  /** Clear forcedPlacements after a successful refetch. */
  clearForcedPlacements: () => void
  /** Apply optimistic STD shift to a flight (mutates etdUtc/etaUtc). */
  applyOptimisticReschedule: (flightId: string, newEtdUtc: number, newEtaUtc: number | null) => void
  showToast: (kind: 'success' | 'error' | 'info', text: string) => void
  dismissToast: () => void

  setScenarioId: (id: string | null) => void
  refreshPendingCount: () => Promise<void>

  selectionDayDate: string | null
  enterSelection: (rotationId: string | null, flightIds: string[], dayDate: string | null) => void
  toggleSelection: (flightId: string) => void
  clearSelection: () => void
  /** Fill selectedFlightIds with all rotation siblings within scope. */
  selectRotationScope: (scope: 'day' | 'period', dayDate: string | null) => void
  /** Selection has been confirmed (jiggle stops, solid highlights take over). */
  selectionConfirmed: boolean
  setSelectionConfirmed: (v: boolean) => void

  recomputeLayout: () => void
}

const ZOOM_ORDER: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '14D', '21D', '28D']

export const useMobileGanttStore = create<GanttState>((set, get) => ({
  flights: [],
  aircraft: [],
  aircraftTypes: [],
  loading: false,
  error: null,

  periodFrom: addDaysIso(todayUtc(), -1),
  periodTo: addDaysIso(todayUtc(), DEFAULT_PERIOD_DAYS - 1),
  periodCommitted: false,
  acTypeFilter: null,
  statusFilter: null,
  scenarioId: null,

  zoom: '3D',
  rowHeightLevel: 1,
  collapsedTypes: new Set(),
  colorMode: 'status',
  barLabelMode: 'flightNo',
  fleetSortOrder: 'type',
  containerWidth: 0,
  containerHeight: 0,
  isDark: true,

  showTat: true,
  showSlots: true,
  showMissingTimes: true,
  showDelays: true,
  oooiGraceMins: 15,
  considerableDelayMins: 60,

  layout: null,

  selectionMode: false,
  selectedFlightIds: new Set(),
  selectionRotationId: null,
  selectionConfirmed: false,
  selectionDayDate: null,

  detailSheet: null,
  filterSheetOpen: false,
  searchSheetOpen: false,
  mutationSheet: null,
  forcedPlacements: new Map(),
  toastMessage: null,
  isStale: false,
  pendingMutationsCount: 0,

  setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),
  setAcTypeFilter: (types) => set({ acTypeFilter: types }),
  setStatusFilter: (statuses) => set({ statusFilter: statuses }),

  setZoom: (z) => {
    set({ zoom: z })
    get().recomputeLayout()
  },
  cycleZoom: (dir) => {
    const cur = get().zoom
    const idx = ZOOM_ORDER.indexOf(cur)
    const next = ZOOM_ORDER[Math.max(0, Math.min(ZOOM_ORDER.length - 1, idx + dir))]
    if (next !== cur) {
      set({ zoom: next })
      get().recomputeLayout()
    }
  },
  cycleRowHeight: () => {
    set((s) => ({ rowHeightLevel: (s.rowHeightLevel + 1) % 4 }))
    get().recomputeLayout()
  },
  setColorMode: (m) => {
    set({ colorMode: m })
    get().recomputeLayout()
  },
  setBarLabelMode: (m) => {
    set({ barLabelMode: m })
    get().recomputeLayout()
  },
  setFleetSortOrder: (o) => {
    set({ fleetSortOrder: o })
    get().recomputeLayout()
  },
  toggleTypeCollapse: (icaoType) => {
    set((s) => {
      const next = new Set(s.collapsedTypes)
      if (next.has(icaoType)) next.delete(icaoType)
      else next.add(icaoType)
      return { collapsedTypes: next }
    })
    get().recomputeLayout()
  },
  setContainerSize: (w, h) => {
    set({ containerWidth: w, containerHeight: h })
    get().recomputeLayout()
  },
  setIsDark: (d) => {
    if (get().isDark !== d) {
      set({ isDark: d })
      get().recomputeLayout()
    }
  },

  commitPeriod: async (operatorId) => {
    const { periodFrom, periodTo, scenarioId, acTypeFilter, statusFilter } = get()
    set({ loading: true, error: null, periodCommitted: true })
    const cacheKey = { operatorId, from: periodFrom, to: periodTo, scenarioId }
    try {
      const res = await api.getGanttFlights({
        operatorId,
        from: periodFrom,
        to: periodTo,
        scenarioId: scenarioId ?? undefined,
        acTypeFilter: acTypeFilter ?? undefined,
        statusFilter: statusFilter ?? undefined,
      })
      // Persist to both WMDB (preferred, durable) and AsyncStorage cache.
      void writeCachedPeriod(cacheKey, {
        flights: res.flights,
        aircraft: res.aircraft,
        aircraftTypes: res.aircraftTypes,
      })
      void writeCachedPeriodToWmdb(cacheKey, {
        flights: res.flights,
        aircraft: res.aircraft,
        aircraftTypes: res.aircraftTypes,
      })
      const wmdbPending = await listPendingFromWmdb(operatorId)
      const asPending = wmdbPending || (await listPending()).length
      set({
        flights: res.flights,
        aircraft: res.aircraft,
        aircraftTypes: res.aircraftTypes,
        loading: false,
        forcedPlacements: new Map(),
        isStale: false,
        pendingMutationsCount: asPending,
      })
      get().recomputeLayout()
    } catch (e) {
      // Prefer WMDB on offline read; AsyncStorage cache as last resort.
      const wmdbCached = await readCachedPeriodFromWmdb(cacheKey)
      const cached = wmdbCached
        ? { data: wmdbCached, fetchedAt: wmdbCached.fetchedAt }
        : await readCachedPeriod(cacheKey)
      if (cached) {
        const wmdbPending = await listPendingFromWmdb(operatorId)
        const asPending = wmdbPending || (await listPending()).length
        set({
          flights: cached.data.flights,
          aircraft: cached.data.aircraft,
          aircraftTypes: cached.data.aircraftTypes,
          loading: false,
          isStale: true,
          error: null,
          pendingMutationsCount: asPending,
        })
        get().recomputeLayout()
      } else {
        set({
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load',
          isStale: false,
        })
      }
    }
  },

  refresh: async (operatorId) => {
    if (!get().periodCommitted) return
    await get().commitPeriod(operatorId)
  },

  openDetailSheet: (target) => set({ detailSheet: target }),
  closeDetailSheet: () => set({ detailSheet: null }),
  setFilterSheetOpen: (open) => set({ filterSheetOpen: open }),
  setSearchSheetOpen: (open) => set({ searchSheetOpen: open }),
  openMutationSheet: (target) => set({ mutationSheet: target }),
  closeMutationSheet: () => set({ mutationSheet: null }),

  toggleTat: () => set((s) => ({ showTat: !s.showTat })),
  toggleSlots: () => set((s) => ({ showSlots: !s.showSlots })),
  toggleMissingTimes: () => set((s) => ({ showMissingTimes: !s.showMissingTimes })),
  toggleDelays: () => set((s) => ({ showDelays: !s.showDelays })),
  setOooiGraceMins: (n) => set({ oooiGraceMins: Math.max(1, Math.min(60, n)) }),

  applyOptimisticPlacement: (flightIds, registration) => {
    set((s) => {
      const next = new Map(s.forcedPlacements)
      for (const id of flightIds) next.set(id, registration)
      // Mirror the placement onto the in-memory flights array so layout picks
      // up the change for both unassigned virtual placement and assigned reg.
      const flights = s.flights.map((f) => (flightIds.includes(f.id) ? { ...f, aircraftReg: registration } : f))
      return { forcedPlacements: next, flights }
    })
    get().recomputeLayout()
  },
  revertOptimisticPlacement: (flightIds) => {
    set((s) => {
      const next = new Map(s.forcedPlacements)
      const wasReg = new Map<string, string>()
      for (const id of flightIds) {
        const r = next.get(id)
        if (r) wasReg.set(id, r)
        next.delete(id)
      }
      // Best effort: drop the optimistic aircraftReg back to null for IDs we'd patched.
      const flights = s.flights.map((f) => (wasReg.has(f.id) ? { ...f, aircraftReg: null } : f))
      return { forcedPlacements: next, flights }
    })
    get().recomputeLayout()
  },
  clearForcedPlacements: () => {
    set({ forcedPlacements: new Map() })
  },
  applyOptimisticReschedule: (flightId, newEtdUtc, newEtaUtc) => {
    set((s) => ({
      flights: s.flights.map((f) =>
        f.id === flightId ? { ...f, etdUtc: newEtdUtc, etaUtc: newEtaUtc ?? f.etaUtc } : f,
      ),
    }))
    get().recomputeLayout()
  },
  showToast: (kind, text) => set({ toastMessage: { kind, text } }),
  dismissToast: () => set({ toastMessage: null }),

  setScenarioId: (id) => {
    set({ scenarioId: id })
  },
  refreshPendingCount: async () => {
    const list = await listPending()
    set({ pendingMutationsCount: list.length })
  },

  enterSelection: (rotationId, flightIds, dayDate) =>
    set({
      selectionMode: true,
      selectionRotationId: rotationId,
      selectedFlightIds: new Set(flightIds),
      selectionConfirmed: false,
      selectionDayDate: dayDate,
    }),
  toggleSelection: (flightId) =>
    set((s) => {
      const next = new Set(s.selectedFlightIds)
      if (next.has(flightId)) next.delete(flightId)
      else next.add(flightId)
      return { selectedFlightIds: next }
    }),
  clearSelection: () =>
    set({
      selectionMode: false,
      selectionRotationId: null,
      selectedFlightIds: new Set(),
      selectionConfirmed: false,
      selectionDayDate: null,
    }),
  selectRotationScope: (scope, dayDate) => {
    const s = get()
    if (!s.selectionRotationId) return
    const ids = s.flights
      .filter((f) => {
        if (f.rotationId !== s.selectionRotationId) return false
        if (scope === 'day' && dayDate && f.operatingDate !== dayDate) return false
        return true
      })
      .map((f) => f.id)
    set({ selectedFlightIds: new Set(ids), selectionConfirmed: true })
  },
  setSelectionConfirmed: (v) => set({ selectionConfirmed: v }),

  recomputeLayout: () => {
    const s = get()
    if (s.containerWidth <= 0) return
    const pph = computePixelsPerHour(s.containerWidth, s.zoom)
    const input: LayoutInput = {
      flights: s.flights,
      aircraft: s.aircraft,
      aircraftTypes: s.aircraftTypes,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      pph,
      zoom: s.zoom,
      rowHeightLevel: s.rowHeightLevel,
      collapsedTypes: s.collapsedTypes,
      colorMode: s.colorMode,
      barLabelMode: s.barLabelMode,
      fleetSortOrder: s.fleetSortOrder,
      isDark: s.isDark,
      containerWidth: s.containerWidth,
      previousVirtualPlacements: s.layout?.virtualPlacements,
      forcedPlacements: s.forcedPlacements.size > 0 ? s.forcedPlacements : undefined,
    }
    set({ layout: computeLayout(input) })
  },
}))
