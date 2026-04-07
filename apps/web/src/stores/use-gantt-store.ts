"use client"

import { create } from 'zustand'
import type {
  GanttFlight, GanttAircraft, GanttAircraftType,
  ZoomLevel, ColorMode, BarLabelMode, LayoutResult,
} from '@/lib/gantt/types'
import { ROW_HEIGHT_LEVELS, ZOOM_CONFIG } from '@/lib/gantt/types'
import { fetchGanttFlights, assignFlights, unassignFlights } from '@/lib/gantt/api'
import { computePixelsPerHour } from '@/lib/gantt/time-axis'
import { computeLayout } from '@/lib/gantt/layout-engine'
import { useOperatorStore } from './use-operator-store'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

interface GanttState {
  // Data
  flights: GanttFlight[]
  aircraft: GanttAircraft[]
  aircraftTypes: GanttAircraftType[]
  loading: boolean
  error: string | null

  // Period
  periodFrom: string
  periodTo: string
  periodCommitted: boolean

  // View
  zoomLevel: ZoomLevel
  rowHeightLevel: number
  collapsedTypes: Set<string>
  colorMode: ColorMode
  barLabelMode: BarLabelMode
  containerWidth: number

  // Selection
  selectedFlightIds: Set<string>
  hoveredFlightId: string | null

  // Computed layout
  layout: LayoutResult | null

  // Actions
  setPeriod: (from: string, to: string) => void
  commitPeriod: () => Promise<void>
  setZoom: (zoom: ZoomLevel) => void
  zoomRowIn: () => void
  zoomRowOut: () => void
  setContainerWidth: (w: number) => void
  toggleTypeCollapse: (icao: string) => void
  setColorMode: (mode: ColorMode) => void
  setBarLabelMode: (mode: BarLabelMode) => void
  selectFlight: (id: string, multi?: boolean) => void
  clearSelection: () => void
  setHovered: (id: string | null) => void
  navigateDate: (direction: 'prev' | 'next') => void
  goToToday: () => void
  assignToAircraft: (flightIds: string[], registration: string) => Promise<void>
  unassignFromAircraft: (flightIds: string[]) => Promise<void>
  _recomputeLayout: () => void
  _fetchFlights: () => Promise<void>
}

export const useGanttStore = create<GanttState>((set, get) => {
  function recompute() {
    const s = get()
    if (!s.periodCommitted || s.flights.length === 0) {
      set({ layout: null })
      return
    }
    const pph = computePixelsPerHour(s.containerWidth || 1200, s.zoomLevel)
    const isDark = typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true

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
      isDark,
    })
    set({ layout })
  }

  async function fetchFlights() {
    const s = get()
    const operatorId = useOperatorStore.getState().operator?.code ?? 'horizon'
    set({ loading: true, error: null })
    try {
      const data = await fetchGanttFlights({
        operatorId,
        from: s.periodFrom,
        to: s.periodTo,
      })
      set({
        flights: data.flights,
        aircraft: data.aircraft,
        aircraftTypes: data.aircraftTypes,
        loading: false,
      })
      recompute()
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  }

  const today = todayISO()

  return {
    flights: [],
    aircraft: [],
    aircraftTypes: [],
    loading: false,
    error: null,

    periodFrom: today,
    periodTo: addDaysISO(today, 3),
    periodCommitted: false,

    zoomLevel: '4D',
    rowHeightLevel: 1,
    collapsedTypes: new Set(),
    colorMode: 'status',
    barLabelMode: 'flightNo',
    containerWidth: 1200,

    selectedFlightIds: new Set(),
    hoveredFlightId: null,
    layout: null,

    setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),

    commitPeriod: async () => {
      set({ periodCommitted: true })
      await fetchFlights()
    },

    setZoom: (zoom) => {
      set({ zoomLevel: zoom })
      recompute()
    },

    zoomRowIn: () => {
      const lvl = Math.min(get().rowHeightLevel + 1, ROW_HEIGHT_LEVELS.length - 1)
      set({ rowHeightLevel: lvl })
      recompute()
    },

    zoomRowOut: () => {
      const lvl = Math.max(get().rowHeightLevel - 1, 0)
      set({ rowHeightLevel: lvl })
      recompute()
    },

    setContainerWidth: (w) => {
      set({ containerWidth: w })
      recompute()
    },

    toggleTypeCollapse: (icao) => {
      const collapsed = new Set(get().collapsedTypes)
      if (collapsed.has(icao)) collapsed.delete(icao)
      else collapsed.add(icao)
      set({ collapsedTypes: collapsed })
      recompute()
    },

    setColorMode: (mode) => {
      set({ colorMode: mode })
      recompute()
    },

    setBarLabelMode: (mode) => {
      set({ barLabelMode: mode })
      recompute()
    },

    selectFlight: (id, multi = false) => {
      const sel = multi ? new Set(get().selectedFlightIds) : new Set<string>()
      if (sel.has(id)) sel.delete(id)
      else sel.add(id)
      set({ selectedFlightIds: sel })
    },

    clearSelection: () => set({ selectedFlightIds: new Set() }),
    setHovered: (id) => set({ hoveredFlightId: id }),

    navigateDate: (direction) => {
      const { periodFrom, periodTo, zoomLevel } = get()
      const days = ZOOM_CONFIG[zoomLevel].days
      const shift = direction === 'next' ? days : -days
      set({ periodFrom: addDaysISO(periodFrom, shift), periodTo: addDaysISO(periodTo, shift) })
      fetchFlights()
    },

    goToToday: () => {
      const days = ZOOM_CONFIG[get().zoomLevel].days
      const from = todayISO()
      set({ periodFrom: from, periodTo: addDaysISO(from, days - 1) })
      fetchFlights()
    },

    assignToAircraft: async (flightIds, registration) => {
      const operatorId = useOperatorStore.getState().operator?.code ?? 'horizon'
      const flights = get().flights.map(f =>
        flightIds.includes(f.id) ? { ...f, aircraftReg: registration } : f
      )
      set({ flights })
      recompute()
      try {
        await assignFlights(operatorId, flightIds, registration)
      } catch (e) {
        await fetchFlights()
        throw e
      }
    },

    unassignFromAircraft: async (flightIds) => {
      const operatorId = useOperatorStore.getState().operator?.code ?? 'horizon'
      const flights = get().flights.map(f =>
        flightIds.includes(f.id) ? { ...f, aircraftReg: null } : f
      )
      set({ flights })
      recompute()
      try {
        await unassignFlights(operatorId, flightIds)
      } catch (e) {
        await fetchFlights()
        throw e
      }
    },

    _recomputeLayout: recompute,
    _fetchFlights: fetchFlights,
  }
})
