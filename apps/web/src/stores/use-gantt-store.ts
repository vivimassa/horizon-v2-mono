'use client'

import { create } from 'zustand'
import type {
  GanttFlight,
  GanttAircraft,
  GanttAircraftType,
  ZoomLevel,
  ColorMode,
  BarLabelMode,
  FleetSortOrder,
  LayoutResult,
} from '@/lib/gantt/types'
import { ROW_HEIGHT_LEVELS, ZOOM_CONFIG } from '@/lib/gantt/types'
import { fetchGanttFlights, assignFlights, unassignFlights, swapFlights, cancelFlights } from '@/lib/gantt/api'
import { computePixelsPerHour } from '@/lib/gantt/time-axis'
import { computeLayout } from '@/lib/gantt/layout-engine'
import { useOperatorStore } from './use-operator-store'

interface GanttState {
  // Data
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  operatorCountry: string | null
  stationCountryMap: Record<string, string>
  stationUtcOffsetMap: Record<string, number>
  loading: boolean
  error: string | null

  // Period
  periodFrom: string
  periodTo: string
  periodCommitted: boolean

  // Filters
  acTypeFilter: string[] | null // null = all types
  statusFilter: string[] | null // null = server default
  scenarioId: string | null // null = production schedule

  // View
  zoomLevel: ZoomLevel
  rowHeightLevel: number
  collapsedTypes: Set<string>
  colorMode: ColorMode
  barLabelMode: BarLabelMode
  fleetSortOrder: FleetSortOrder
  showTat: boolean
  showSlots: boolean
  containerWidth: number

  // Utilization targets (acTypeIcao → target block hours per day)
  utilizationTargets: Map<string, number>

  // Forced virtual placements from drag-drop rearrange (flightId → registration)
  _forcedPlacements: Map<string, string> | null

  // Selection
  selectedFlightIds: Set<string>
  hoveredFlightId: string | null

  // Context menus
  contextMenu: { x: number; y: number; flightId: string } | null
  aircraftContextMenu: { x: number; y: number; registration: string; aircraftTypeIcao: string } | null

  // Flight info dialog
  flightInfoDialogId: string | null

  // Aircraft popover
  aircraftPopover: { x: number; y: number; registration: string; aircraftTypeIcao: string } | null

  // Daily summary
  dayContextMenu: { x: number; y: number; date: string } | null
  dailySummaryPopover: { x: number; y: number; date: string } | null

  // Daily rotation
  rowContextMenu: { x: number; y: number; registration: string; aircraftTypeIcao: string; date: string } | null
  rotationPopover: { x: number; y: number; registration: string; aircraftTypeIcao: string; date: string } | null

  // Assign aircraft popover
  assignPopover: { x: number; y: number; flightIds: string[]; aircraftTypeIcao: string } | null

  // Cancel confirmation
  cancelDialog: { flightIds: string[] } | null

  // Swap mode
  swapMode: {
    sourceFlightIds: string[]
    sourceReg: string | null
    sourceDates: string[] // operating dates covered by source selection
  } | null
  swapDialog: {
    targetReg: string
    targetFlightIds: string[] // flights on target AC for the source dates
  } | null

  // Computed layout
  layout: LayoutResult | null

  // Scroll target (epoch ms) — canvas scrolls to this position
  scrollTargetMs: number | null

  // Actions
  setPeriod: (from: string, to: string) => void
  setAcTypeFilter: (types: string[] | null) => void
  setStatusFilter: (statuses: string[] | null) => void
  setScenarioId: (id: string | null) => void
  commitPeriod: () => Promise<void>
  setZoom: (zoom: ZoomLevel) => void
  zoomRowIn: () => void
  zoomRowOut: () => void
  setContainerWidth: (w: number) => void
  toggleTypeCollapse: (icao: string) => void
  setColorMode: (mode: ColorMode) => void
  setBarLabelMode: (mode: BarLabelMode) => void
  setFleetSortOrder: (order: FleetSortOrder) => void
  toggleTat: () => void
  toggleSlots: () => void
  setUtilizationTargets: (targets: Map<string, number>) => void
  selectFlight: (id: string, multi?: boolean) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  navigateDate: (direction: 'prev' | 'next') => void
  goToToday: () => void
  consumeScrollTarget: () => void
  openContextMenu: (x: number, y: number, flightId: string) => void
  closeContextMenu: () => void
  openAircraftContextMenu: (x: number, y: number, registration: string, aircraftTypeIcao: string) => void
  closeAircraftContextMenu: () => void
  openFlightInfo: (flightId: string) => void
  closeFlightInfo: () => void
  openAircraftPopover: (x: number, y: number, registration: string, aircraftTypeIcao: string) => void
  closeAircraftPopover: () => void
  openDayContextMenu: (x: number, y: number, date: string) => void
  closeDayContextMenu: () => void
  openDailySummary: (x: number, y: number, date: string) => void
  closeDailySummary: () => void
  openRowContextMenu: (x: number, y: number, registration: string, aircraftTypeIcao: string, date: string) => void
  closeRowContextMenu: () => void
  openRotationPopover: (x: number, y: number, registration: string, aircraftTypeIcao: string, date: string) => void
  closeRotationPopover: () => void
  openAssignPopover: (x: number, y: number, flightIds: string[], aircraftTypeIcao: string) => void
  closeAssignPopover: () => void
  assignToAircraft: (flightIds: string[], registration: string) => Promise<void>
  unassignFromAircraft: (flightIds: string[]) => Promise<void>
  openCancelDialog: (flightIds: string[]) => void
  closeCancelDialog: () => void
  confirmCancel: () => Promise<void>
  /** Visual-only rearrange: swap virtual placements between two sets of flights without DB writes */
  rearrangeVirtualPlacements: (
    sourceFlightIds: string[],
    sourceReg: string | null,
    targetFlightIds: string[],
    targetReg: string,
  ) => void
  enterSwapMode: () => void
  exitSwapMode: () => void
  pickSwapTarget: (targetFlightId: string) => void
  closeSwapDialog: () => void
  executeSwap: () => Promise<void>
  _recomputeLayout: () => void
  _fetchFlights: () => Promise<void>
  /** Hydrate period from localStorage (call once on client mount) */
  hydrate: () => void
}

export const useGanttStore = create<GanttState>((set, get) => {
  let recomputeTimer: ReturnType<typeof setTimeout> | null = null

  /** Debounced recompute — coalesces rapid state changes into a single layout pass */
  function recomputeDebounced() {
    if (recomputeTimer) clearTimeout(recomputeTimer)
    recomputeTimer = setTimeout(() => {
      recomputeTimer = null
      recompute()
    }, 16)
  }

  function recompute() {
    const s = get()
    if (!s.periodCommitted || (s.flights.length === 0 && s.aircraft.length === 0)) {
      set({ layout: null })
      return
    }
    const pph = computePixelsPerHour(s.containerWidth || 1200, s.zoomLevel)
    const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true

    // Use in-memory placements first, fall back to localStorage on fresh load
    let prevPlacements = s.layout?.virtualPlacements
    if (!prevPlacements) {
      try {
        const raw = localStorage.getItem('gantt.virtualPlacements')
        if (raw) prevPlacements = new Map(JSON.parse(raw))
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
      containerWidth: s.containerWidth || 1200,
      previousVirtualPlacements: prevPlacements,
      forcedPlacements: s._forcedPlacements ?? undefined,
    })
    set({ layout })

    // Persist virtual placements for page reload stability
    try {
      localStorage.setItem('gantt.virtualPlacements', JSON.stringify([...layout.virtualPlacements]))
    } catch {
      /* quota exceeded — non-critical */
    }
  }

  async function fetchFlights() {
    const s = get()
    let operatorId = useOperatorStore.getState().operator?._id ?? ''
    if (!operatorId) {
      // Operator may not have loaded yet — wait and retry
      await new Promise((r) => setTimeout(r, 1000))
      operatorId = useOperatorStore.getState().operator?._id ?? ''
      if (!operatorId) {
        set({ loading: false })
        return
      }
    }
    set({ loading: true, error: null })
    try {
      const data = await fetchGanttFlights({
        operatorId,
        from: s.periodFrom,
        to: s.periodTo,
        scenarioId: useOperatorStore.getState().activeScenarioId || undefined,
        acTypeFilter: s.acTypeFilter ?? undefined,
        statusFilter: s.statusFilter ?? undefined,
      })
      set({
        flights: data.flights,
        aircraft: data.aircraft,
        aircraftTypes: data.aircraftTypes,
        operatorCountry: data.operatorCountry ?? null,
        stationCountryMap: data.stationCountryMap ?? {},
        stationUtcOffsetMap: data.stationUtcOffsetMap ?? {},
        loading: false,
      })
      recompute()
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  }

  return {
    flights: [],
    aircraft: [],
    aircraftTypes: [],
    operatorCountry: null,
    stationCountryMap: {},
    stationUtcOffsetMap: {},
    loading: false,
    error: null,

    periodFrom: '',
    periodTo: '',
    periodCommitted: false,
    acTypeFilter: null,
    statusFilter: null,
    scenarioId: null,

    zoomLevel: '3D',
    rowHeightLevel: 1,
    collapsedTypes: new Set(),
    colorMode: 'status',
    barLabelMode: 'flightNo',
    fleetSortOrder: 'type' as FleetSortOrder,
    showTat: true,
    showSlots: true,
    utilizationTargets: new Map(),
    _forcedPlacements: null,
    containerWidth: 1200,

    selectedFlightIds: new Set(),
    hoveredFlightId: null,
    contextMenu: null,
    aircraftContextMenu: null,
    flightInfoDialogId: null,
    aircraftPopover: null,
    dayContextMenu: null,
    dailySummaryPopover: null,
    rowContextMenu: null,
    rotationPopover: null,
    assignPopover: null,
    cancelDialog: null,
    swapMode: null,
    swapDialog: null,
    layout: null,
    scrollTargetMs: null,

    setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),
    setAcTypeFilter: (types) => set({ acTypeFilter: types }),
    setStatusFilter: (statuses) => set({ statusFilter: statuses }),
    setScenarioId: (id) => set({ scenarioId: id }),

    commitPeriod: async () => {
      const { periodFrom, periodTo } = get()
      if (!periodFrom || !periodTo) return
      set({ periodCommitted: true })
      localStorage.setItem('gantt.periodFrom', periodFrom)
      localStorage.setItem('gantt.periodTo', periodTo)
      await fetchFlights()
    },

    setZoom: (zoom) => {
      set({ zoomLevel: zoom })
      recomputeDebounced()
    },

    zoomRowIn: () => {
      const lvl = Math.min(get().rowHeightLevel + 1, ROW_HEIGHT_LEVELS.length - 1)
      set({ rowHeightLevel: lvl })
      recomputeDebounced()
    },

    zoomRowOut: () => {
      const lvl = Math.max(get().rowHeightLevel - 1, 0)
      set({ rowHeightLevel: lvl })
      recomputeDebounced()
    },

    setContainerWidth: (w) => {
      set({ containerWidth: w })
      recomputeDebounced()
    },

    toggleTypeCollapse: (icao) => {
      const collapsed = new Set(get().collapsedTypes)
      if (collapsed.has(icao)) collapsed.delete(icao)
      else collapsed.add(icao)
      set({ collapsedTypes: collapsed })
      recomputeDebounced()
    },

    setColorMode: (mode) => {
      set({ colorMode: mode })
      recomputeDebounced()
    },

    setUtilizationTargets: (targets) => {
      set({ utilizationTargets: targets })
      // Persist to localStorage
      try {
        localStorage.setItem('gantt.utilizationTargets', JSON.stringify([...targets]))
      } catch {
        /* ignore */
      }
    },

    setBarLabelMode: (mode) => {
      set({ barLabelMode: mode })
      recomputeDebounced()
    },

    setFleetSortOrder: (order) => {
      set({ fleetSortOrder: order })
      recomputeDebounced()
    },

    toggleTat: () => set({ showTat: !get().showTat }),
    toggleSlots: () => set({ showSlots: !get().showSlots }),

    selectFlight: (id, multi = false) => {
      const sel = multi ? new Set(get().selectedFlightIds) : new Set<string>()
      if (sel.has(id)) sel.delete(id)
      else sel.add(id)
      set({ selectedFlightIds: sel })
    },

    clearSelection: () => set({ selectedFlightIds: new Set() }),
    setHovered: (id) => set({ hoveredFlightId: id }),

    navigateDate: (direction) => {
      const { zoomLevel, scrollTargetMs, periodFrom } = get()
      const days = ZOOM_CONFIG[zoomLevel].days
      const shiftMs = days * 86_400_000 * (direction === 'next' ? 1 : -1)
      const current = scrollTargetMs ?? new Date(periodFrom + 'T00:00:00Z').getTime()
      set({ scrollTargetMs: current + shiftMs })
    },

    goToToday: () => {
      set({ scrollTargetMs: Date.now() })
    },

    consumeScrollTarget: () => set({ scrollTargetMs: null }),

    openContextMenu: (x, y, flightId) => set({ contextMenu: { x, y, flightId } }),
    closeContextMenu: () => set({ contextMenu: null }),
    openAircraftContextMenu: (x, y, registration, aircraftTypeIcao) =>
      set({ aircraftContextMenu: { x, y, registration, aircraftTypeIcao }, contextMenu: null }),
    closeAircraftContextMenu: () => set({ aircraftContextMenu: null }),
    openFlightInfo: (flightId) => set({ flightInfoDialogId: flightId, contextMenu: null }),
    closeFlightInfo: () => set({ flightInfoDialogId: null }),
    openAircraftPopover: (x, y, registration, aircraftTypeIcao) =>
      set({ aircraftPopover: { x, y, registration, aircraftTypeIcao }, contextMenu: null }),
    closeAircraftPopover: () => set({ aircraftPopover: null }),
    openDayContextMenu: (x, y, date) =>
      set({ dayContextMenu: { x, y, date }, contextMenu: null, aircraftContextMenu: null }),
    closeDayContextMenu: () => set({ dayContextMenu: null }),
    openDailySummary: (x, y, date) => set({ dailySummaryPopover: { x, y, date }, dayContextMenu: null }),
    closeDailySummary: () => set({ dailySummaryPopover: null }),
    openRowContextMenu: (x, y, registration, aircraftTypeIcao, date) =>
      set({
        rowContextMenu: { x, y, registration, aircraftTypeIcao, date },
        contextMenu: null,
        aircraftContextMenu: null,
        dayContextMenu: null,
      }),
    closeRowContextMenu: () => set({ rowContextMenu: null }),
    openRotationPopover: (x, y, registration, aircraftTypeIcao, date) =>
      set({ rotationPopover: { x, y, registration, aircraftTypeIcao, date }, rowContextMenu: null }),
    closeRotationPopover: () => set({ rotationPopover: null }),
    openAssignPopover: (x, y, flightIds, aircraftTypeIcao) =>
      set({ assignPopover: { x, y, flightIds, aircraftTypeIcao }, contextMenu: null }),
    closeAssignPopover: () => set({ assignPopover: null }),

    assignToAircraft: async (flightIds, registration) => {
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      const flights = get().flights.map((f) => (flightIds.includes(f.id) ? { ...f, aircraftReg: registration } : f))
      set({ flights, assignPopover: null })
      recompute()
      try {
        await assignFlights(operatorId, flightIds, registration)
      } catch (e) {
        console.error('Assign failed, refetching:', e)
        await fetchFlights()
      }
    },

    unassignFromAircraft: async (flightIds) => {
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      const flights = get().flights.map((f) => (flightIds.includes(f.id) ? { ...f, aircraftReg: null } : f))
      set({ flights, assignPopover: null })
      recompute()
      try {
        await unassignFlights(operatorId, flightIds)
      } catch (e) {
        console.error('Unassign failed, refetching:', e)
        await fetchFlights()
      }
    },

    openCancelDialog: (flightIds) => set({ cancelDialog: { flightIds }, contextMenu: null }),
    closeCancelDialog: () => set({ cancelDialog: null }),
    confirmCancel: async () => {
      const s = get()
      if (!s.cancelDialog) return
      const { flightIds } = s.cancelDialog
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      // Optimistic: remove flights from local state
      const flights = s.flights.filter((f) => !flightIds.includes(f.id))
      set({ flights, selectedFlightIds: new Set(), cancelDialog: null })
      recompute()
      try {
        await cancelFlights(operatorId, flightIds)
      } catch (e) {
        console.error('Cancel failed, refetching:', e)
        await fetchFlights()
      }
    },

    rearrangeVirtualPlacements: (sourceFlightIds, sourceReg, targetFlightIds, targetReg) => {
      const s = get()
      // Build forced placements: source → target, target → source
      const forced = new Map<string, string>()
      for (const id of sourceFlightIds) forced.set(id, targetReg)
      if (sourceReg) {
        for (const id of targetFlightIds) forced.set(id, sourceReg)
      }
      // Merge with any existing forced placements
      const existingForced = s._forcedPlacements ?? new Map<string, string>()
      const merged = new Map<string, string>([...existingForced, ...forced])

      // Recompute with forced placements — these bypass the greedy algorithm
      const pph = computePixelsPerHour(s.containerWidth || 1200, s.zoomLevel)
      const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
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
        containerWidth: s.containerWidth || 1200,
        previousVirtualPlacements: s.layout?.virtualPlacements,
        forcedPlacements: merged,
      })
      // Persist for refresh stability
      try {
        localStorage.setItem('gantt.virtualPlacements', JSON.stringify([...layout.virtualPlacements]))
      } catch {
        /* ignore */
      }
      set({ layout, selectedFlightIds: new Set(), _forcedPlacements: merged })
    },

    enterSwapMode: () => {
      const s = get()
      if (s.selectedFlightIds.size === 0 || !s.layout) return
      const allIds = [...s.selectedFlightIds]

      // Group selected flights by their aircraft row
      const regGroups = new Map<string, string[]>()
      for (const id of allIds) {
        const bar = s.layout.bars.find((b) => b.flightId === id)
        const row = bar ? s.layout.rows[bar.row] : null
        const reg = row?.registration ?? s.flights.find((f) => f.id === id)?.aircraftReg ?? '_unassigned'
        const list = regGroups.get(reg) ?? []
        list.push(id)
        regGroups.set(reg, list)
      }

      const regs = [...regGroups.keys()]

      if (regs.length === 2) {
        // Smart swap: 2 rows selected → open dialog directly
        const [regA, regB] = regs
        const aFlightIds = regGroups.get(regA)!
        const bFlightIds = regGroups.get(regB)!
        const aFlights = s.flights.filter((f) => aFlightIds.includes(f.id))
        const sourceDates = [...new Set(aFlights.map((f) => f.operatingDate))]
        const sourceReg = regA === '_unassigned' ? null : regA
        const targetReg = regB === '_unassigned' ? null : regB

        // Also include any other flights on the target row for the same dates (date-aware)
        const allTargetIds = s.flights
          .filter((f) => {
            const fBar = s.layout!.bars.find((b) => b.flightId === f.id)
            const fRow = fBar ? s.layout!.rows[fBar.row] : null
            const fReg = fRow?.registration ?? f.aircraftReg
            return fReg === targetReg && sourceDates.includes(f.operatingDate) && !aFlightIds.includes(f.id)
          })
          .map((f) => f.id)
        // Merge explicitly selected B flights + date-aware B flights
        const mergedTargetIds = [...new Set([...bFlightIds, ...allTargetIds])]

        set({
          swapMode: { sourceFlightIds: aFlightIds, sourceReg, sourceDates },
          swapDialog: { targetReg: targetReg ?? '', targetFlightIds: mergedTargetIds },
          contextMenu: null,
        })
      } else if (regs.length === 1) {
        // Single row: enter swap mode, wait for target click
        const sourceFlightIds = allIds
        const sourceFlights = s.flights.filter((f) => sourceFlightIds.includes(f.id))
        const reg = regs[0]
        const sourceReg = reg === '_unassigned' ? null : reg
        const sourceDates = [...new Set(sourceFlights.map((f) => f.operatingDate))]
        set({ swapMode: { sourceFlightIds, sourceReg, sourceDates }, contextMenu: null })
      }
      // 3+ rows: do nothing (too ambiguous)
    },

    exitSwapMode: () => set({ swapMode: null, swapDialog: null }),

    pickSwapTarget: (targetFlightId) => {
      const s = get()
      if (!s.swapMode) return
      const targetFlight = s.flights.find((f) => f.id === targetFlightId)
      if (!targetFlight) return
      // Find target registration from the clicked flight's row
      const targetBar = s.layout?.bars.find((b) => b.flightId === targetFlightId)
      const targetRow = targetBar ? s.layout?.rows[targetBar.row] : null
      const targetReg = targetRow?.registration ?? targetFlight.aircraftReg ?? null
      if (!targetReg || targetReg === s.swapMode.sourceReg) return // same row = no-op
      // Find ALL flights on target aircraft for the source dates
      const targetFlightIds = s.flights
        .filter((f) => {
          const fBar = s.layout?.bars.find((b) => b.flightId === f.id)
          const fRow = fBar ? s.layout?.rows[fBar.row] : null
          const fReg = fRow?.registration ?? f.aircraftReg
          return fReg === targetReg && s.swapMode!.sourceDates.includes(f.operatingDate)
        })
        .map((f) => f.id)
      set({ swapDialog: { targetReg, targetFlightIds } })
    },

    closeSwapDialog: () => set({ swapDialog: null }),

    executeSwap: async () => {
      const s = get()
      if (!s.swapMode || !s.swapDialog) return
      const { sourceFlightIds, sourceReg } = s.swapMode
      const { targetReg, targetFlightIds } = s.swapDialog
      const operatorId = useOperatorStore.getState().operator?._id ?? ''

      // Close dialog + optimistic update
      const flights = s.flights.map((f) => {
        if (sourceFlightIds.includes(f.id)) return { ...f, aircraftReg: targetReg }
        if (targetFlightIds.includes(f.id)) return { ...f, aircraftReg: sourceReg }
        return f
      })
      set({ flights, swapMode: null, swapDialog: null, selectedFlightIds: new Set() })
      recompute()

      try {
        await swapFlights(operatorId, sourceFlightIds, targetReg, targetFlightIds, sourceReg)
      } catch (e) {
        console.error('Swap API failed, refetching:', e)
        await fetchFlights()
      }
    },

    _recomputeLayout: recompute,
    _fetchFlights: fetchFlights,

    hydrate: () => {
      const from = localStorage.getItem('gantt.periodFrom') ?? ''
      const to = localStorage.getItem('gantt.periodTo') ?? ''
      if (from && to) set({ periodFrom: from, periodTo: to })
      try {
        const raw = localStorage.getItem('gantt.utilizationTargets')
        if (raw) set({ utilizationTargets: new Map(JSON.parse(raw)) })
      } catch {
        /* ignore */
      }
    },
  }
})
