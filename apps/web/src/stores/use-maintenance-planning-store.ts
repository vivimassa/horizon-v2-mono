import { create } from 'zustand'
import {
  api,
  type MxGanttAircraftRow,
  type MxEventRow,
  type MxSchedulingStats,
  type MxFilterOptions,
} from '@skyhub/api'
import { useOperatorStore } from './use-operator-store'

interface FormDialogConfig {
  mode: 'create' | 'edit'
  aircraftId: string
  registration: string
  event?: MxEventRow
  date?: string
}

interface MaintenancePlanningState {
  // Data
  rows: MxGanttAircraftRow[]
  stats: MxSchedulingStats
  filterOptions: MxFilterOptions
  loading: boolean
  error: string | null

  // Draft filters (what user edits in the filter panel — NOT used by Gantt)
  periodFrom: string
  periodTo: string
  aircraftTypeFilter: string
  baseFilter: string
  checkTypeFilter: string
  statusFilter: string
  sortBy: string

  // Committed values (what the Gantt actually renders — set on Go click)
  committedFrom: string
  committedTo: string

  // View
  periodCommitted: boolean
  zoomDays: number
  rowHeight: number
  colorMode: 'check_type' | 'status'
  collapsedTypes: Set<string>
  searchOpen: boolean

  // Selection
  selectedEvent: MxEventRow | null

  // Form dialog
  formDialog: FormDialogConfig | null

  // Forecast popover
  forecastPopover: { eventId: string; event: MxEventRow; x: number; y: number } | null

  // Forecast
  forecastLoading: boolean
  forecastBanner: { aircraft: number; events: number } | null
  bulkLoading: boolean

  // Context menu
  contextMenu: {
    type: 'aircraft' | 'event'
    x: number
    y: number
    aircraftId: string
    registration: string
    event?: MxEventRow
    date?: string
  } | null

  // Actions
  setPeriod: (from: string, to: string) => void
  setFilter: (key: string, value: string) => void
  commitPeriod: () => Promise<void>
  loadFilterOptions: (operatorId: string) => Promise<void>
  runForecast: (operatorId: string) => Promise<void>
  acceptAll: (operatorId: string) => Promise<void>
  rejectAll: (operatorId: string) => Promise<void>
  selectEvent: (event: MxEventRow | null) => void
  openForecastPopover: (event: MxEventRow, x: number, y: number) => void
  closeForecastPopover: () => void
  setZoomDays: (days: number) => void
  setRowHeight: (h: number) => void
  setColorMode: (mode: 'check_type' | 'status') => void
  toggleCollapsedType: (type: string) => void
  setSearchOpen: (open: boolean) => void
  deleteSelectedEvent: () => Promise<void>
  openForm: (config: FormDialogConfig) => void
  closeForm: () => void
  setContextMenu: (menu: MaintenancePlanningState['contextMenu']) => void
  dismissForecastBanner: () => void
  refresh: (operatorId: string) => Promise<void>
}

const today = new Date().toISOString().slice(0, 10)
const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

const EMPTY_STATS: MxSchedulingStats = { total: 0, proposed: 0, planned: 0, confirmed: 0, inProgress: 0 }
const EMPTY_OPTIONS: MxFilterOptions = { aircraftTypes: [], bases: [], checkTypes: [] }

export const useMaintenancePlanningStore = create<MaintenancePlanningState>((set, get) => ({
  // Data
  rows: [],
  stats: EMPTY_STATS,
  filterOptions: EMPTY_OPTIONS,
  loading: false,
  error: null,

  // Draft filters
  periodFrom: today,
  periodTo: twoWeeks,
  aircraftTypeFilter: '',
  baseFilter: '',
  checkTypeFilter: '',
  statusFilter: '',
  sortBy: 'registration',

  // Committed values
  committedFrom: '',
  committedTo: '',

  // View
  periodCommitted: false,
  zoomDays: 14,
  rowHeight: 36,
  colorMode: 'check_type',
  collapsedTypes: new Set(),
  searchOpen: false,

  // Selection
  selectedEvent: null,

  // Form dialog
  formDialog: null,

  // Forecast popover
  forecastPopover: null,

  // Forecast
  forecastLoading: false,
  forecastBanner: null,
  bulkLoading: false,

  // Context menu
  contextMenu: null,

  // ── Actions ──

  setPeriod: (from, to) => set({ periodFrom: from, periodTo: to }),

  setFilter: (key, value) => {
    const map: Record<string, string> = {
      aircraftType: 'aircraftTypeFilter',
      base: 'baseFilter',
      checkType: 'checkTypeFilter',
      status: 'statusFilter',
      sortBy: 'sortBy',
    }
    const stateKey = map[key] || key
    set({ [stateKey]: value } as Partial<MaintenancePlanningState>)
  },

  loadFilterOptions: async (operatorId) => {
    try {
      const options = await api.getMaintenanceFilterOptions(operatorId)
      set({ filterOptions: options })
    } catch {
      // silent
    }
  },

  commitPeriod: async () => {
    const s = get()
    // Snapshot draft filters into committed values
    set({
      loading: true,
      error: null,
      periodCommitted: true,
      committedFrom: s.periodFrom,
      committedTo: s.periodTo,
    })
    try {
      const operatorId = useOperatorStore.getState().operator?._id ?? ''
      const result = await api.getMaintenanceEvents({
        operatorId,
        dateFrom: s.periodFrom,
        dateTo: s.periodTo,
        aircraftTypeId: s.aircraftTypeFilter || undefined,
        base: s.baseFilter || undefined,
        checkTypeId: s.checkTypeFilter || undefined,
        status: s.statusFilter || undefined,
        sortBy: s.sortBy || undefined,
      })
      set({ rows: result.rows, stats: result.stats, loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  runForecast: async (operatorId) => {
    const s = get()
    const from = s.committedFrom || s.periodFrom
    const to = s.committedTo || s.periodTo
    set({ forecastLoading: true })
    try {
      const result = await api.runMaintenanceForecast({ operatorId, dateFrom: from, dateTo: to })
      set({
        forecastLoading: false,
        forecastBanner: { aircraft: result.totalAircraftAnalyzed, events: result.totalProposedEvents },
      })
      await get().commitPeriod()
    } catch (err) {
      set({ forecastLoading: false, error: (err as Error).message })
    }
  },

  acceptAll: async (operatorId) => {
    set({ bulkLoading: true })
    try {
      await api.acceptAllProposedEvents(operatorId)
      set({ bulkLoading: false, forecastBanner: null })
      await get().commitPeriod()
    } catch (err) {
      set({ bulkLoading: false, error: (err as Error).message })
    }
  },

  rejectAll: async (operatorId) => {
    set({ bulkLoading: true })
    try {
      await api.rejectAllProposedEvents(operatorId)
      set({ bulkLoading: false, forecastBanner: null })
      await get().commitPeriod()
    } catch (err) {
      set({ bulkLoading: false, error: (err as Error).message })
    }
  },

  selectEvent: (event) => set({ selectedEvent: event }),

  openForecastPopover: (event, x, y) => set({ forecastPopover: { eventId: event.id, event, x, y } }),
  closeForecastPopover: () => set({ forecastPopover: null }),

  setZoomDays: (days) => set({ zoomDays: days }),
  setRowHeight: (h) => set({ rowHeight: Math.max(28, Math.min(56, h)) }),
  setColorMode: (mode) => set({ colorMode: mode }),

  setSearchOpen: (open) => set({ searchOpen: open }),

  deleteSelectedEvent: async () => {
    const ev = get().selectedEvent
    if (!ev) return
    try {
      await api.deleteMaintenanceEvent(ev.id)
      set({ selectedEvent: null })
      await get().commitPeriod()
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  toggleCollapsedType: (type) => {
    const next = new Set(get().collapsedTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    set({ collapsedTypes: next })
  },

  openForm: (config) => set({ formDialog: config }),
  closeForm: () => set({ formDialog: null }),

  setContextMenu: (menu) => set({ contextMenu: menu }),

  dismissForecastBanner: () => set({ forecastBanner: null }),

  refresh: async (operatorId) => {
    void operatorId
    await get().commitPeriod()
  },
}))
