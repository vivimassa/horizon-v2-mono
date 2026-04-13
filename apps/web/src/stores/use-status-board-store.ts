'use client'

import { create } from 'zustand'
import { authedFetch } from '@/lib/authed-fetch'
import { getOperatorId } from './use-operator-store'

// ── Types ──

export interface StatusBoardFlightChip {
  id: string
  flightNumber: string
  depIcao: string
  arrIcao: string
  stdUtc: number
  staUtc: number
  status: 'completed' | 'airborne' | 'future' | 'cancelled' | 'maintenance'
}

export interface StatusBoardCheckBadge {
  checkTypeId: string
  code: string
  name: string
  color: string | null
  remainingHours: number | null
  remainingCycles: number | null
  remainingDays: number | null
  percentConsumed: number
}

export interface StatusBoardNextEvent {
  checkName: string
  station: string
  plannedStartUtc: number
}

export interface StatusBoardRow {
  id: string
  registration: string
  icaoType: string
  typeName: string
  homeBase: string | null
  currentLocation: string | null
  operationalStatus: 'AIRBORNE' | 'ON_GROUND' | 'MAINTENANCE' | 'AOG'
  healthStatus: 'serviceable' | 'attention' | 'critical'
  rotationFlights: StatusBoardFlightChip[]
  accumulatedDelayMinutes: number
  urgentCheck: StatusBoardCheckBadge | null
  nextEvent: StatusBoardNextEvent | null
  flightHours: number
  cycles: number
}

export interface StatusBoardKpis {
  totalActive: number
  serviceable: number
  attention: number
  critical: number
  inCheck: number
  technicalReliability: number
  upcomingChecks: { within7d: number; within14d: number; within30d: number; within60d: number }
  activeMaintenance: { arrived: number; inducted: number; inWork: number; qa: number; released: number }
  aogCount: number
  deferralCount: number
  oldestDeferralDays: number | null
}

export interface StatusBoardFilterOptions {
  aircraftTypes: { id: string; icaoType: string; name: string }[]
  bases: string[]
  checkTypes: { id: string; code: string; name: string }[]
}

export interface MaintenanceRecord {
  id: string
  checkCode: string
  checkName: string
  status: string
  phase: string
  station: string
  plannedStartUtc: number | null
  plannedEndUtc: number | null
  actualStartUtc: number | null
  actualEndUtc: number | null
  notes: string
}

export interface StatusBoardContextMenu {
  x: number
  y: number
  aircraftId: string
  registration: string
}

// ── Store ──

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

const EMPTY_KPIS: StatusBoardKpis = {
  totalActive: 0,
  serviceable: 0,
  attention: 0,
  critical: 0,
  inCheck: 0,
  technicalReliability: 0,
  upcomingChecks: { within7d: 0, within14d: 0, within30d: 0, within60d: 0 },
  activeMaintenance: { arrived: 0, inducted: 0, inWork: 0, qa: 0, released: 0 },
  aogCount: 0,
  deferralCount: 0,
  oldestDeferralDays: null,
}

const EMPTY_FILTER_OPTIONS: StatusBoardFilterOptions = {
  aircraftTypes: [],
  bases: [],
  checkTypes: [],
}

interface StatusBoardState {
  // Data
  aircraft: StatusBoardRow[]
  kpis: StatusBoardKpis
  filterOptions: StatusBoardFilterOptions
  loading: boolean
  error: string | null

  // Filters
  aircraftTypeFilter: string
  baseFilter: string
  healthStatusFilter: string
  nextCheckWithin: string
  sortBy: string
  searchQuery: string

  // View
  kpisCollapsed: boolean
  expandedAircraftId: string | null
  expandedRecords: MaintenanceRecord[]
  expandedRecordsLoading: boolean

  // Context menu
  contextMenu: StatusBoardContextMenu | null

  // Refresh tracking
  lastRefreshMs: number

  // Computed
  filteredAircraft: StatusBoardRow[]

  // Actions
  loadFilterOptions: () => Promise<void>
  loadData: () => Promise<void>
  setFilter: (key: string, value: string) => void
  resetFilters: () => void
  setSearchQuery: (q: string) => void
  setSortBy: (sort: string) => void
  toggleKpis: () => void
  expandAircraft: (id: string) => Promise<void>
  collapseAircraft: () => void
  openContextMenu: (menu: StatusBoardContextMenu) => void
  closeContextMenu: () => void
}

function applySearchFilter(aircraft: StatusBoardRow[], query: string): StatusBoardRow[] {
  if (!query) return aircraft
  const lower = query.toLowerCase()
  return aircraft.filter((a) => a.registration.toLowerCase().includes(lower))
}

export const useStatusBoardStore = create<StatusBoardState>((set, get) => ({
  // Data
  aircraft: [],
  kpis: EMPTY_KPIS,
  filterOptions: EMPTY_FILTER_OPTIONS,
  loading: false,
  error: null,

  // Filters
  aircraftTypeFilter: '',
  baseFilter: '',
  healthStatusFilter: '',
  nextCheckWithin: '',
  sortBy: 'registration',
  searchQuery: '',

  // View
  kpisCollapsed: false,
  expandedAircraftId: null,
  expandedRecords: [],
  expandedRecordsLoading: false,

  // Context menu
  contextMenu: null,

  // Refresh tracking
  lastRefreshMs: 0,

  // Computed
  get filteredAircraft() {
    const state = get()
    return applySearchFilter(state.aircraft, state.searchQuery)
  },

  // ── Actions ──

  loadFilterOptions: async () => {
    const operatorId = getOperatorId()
    if (!operatorId) return
    try {
      const res = await authedFetch(`${API_BASE}/maintenance-events/filter-options?operatorId=${operatorId}`)
      if (!res.ok) return
      const data = await res.json()
      set({
        filterOptions: {
          aircraftTypes: data.aircraftTypes ?? [],
          bases: (data.bases ?? []).map((b: { icao: string }) => b.icao),
          checkTypes: data.checkTypes ?? [],
        },
      })
    } catch {
      // silent — filter options are a convenience, not critical
    }
  },

  loadData: async () => {
    const operatorId = getOperatorId()
    if (!operatorId) {
      set({ error: 'No operator selected' })
      return
    }

    set({ loading: true, error: null })
    try {
      const qs = new URLSearchParams({ operatorId })
      const { aircraftTypeFilter, baseFilter, healthStatusFilter, nextCheckWithin, sortBy } = get()
      if (aircraftTypeFilter) qs.set('aircraftTypeId', aircraftTypeFilter)
      if (baseFilter) qs.set('base', baseFilter)
      if (healthStatusFilter) qs.set('healthStatus', healthStatusFilter)
      if (nextCheckWithin) qs.set('nextCheckWithin', nextCheckWithin)
      if (sortBy) qs.set('sortBy', sortBy)

      const res = await authedFetch(`${API_BASE}/aircraft-status-board?${qs}`)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Status Board API ${res.status}: ${body}`)
      }
      const data = await res.json()
      set({
        aircraft: data.aircraft ?? [],
        kpis: data.kpis ?? EMPTY_KPIS,
        loading: false,
        lastRefreshMs: Date.now(),
      })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  setFilter: (key, value) => {
    const map: Record<string, string> = {
      aircraftType: 'aircraftTypeFilter',
      base: 'baseFilter',
      healthStatus: 'healthStatusFilter',
      nextCheckWithin: 'nextCheckWithin',
    }
    const stateKey = map[key] || key
    set({ [stateKey]: value } as Partial<StatusBoardState>)
  },

  resetFilters: () =>
    set({
      aircraftTypeFilter: '',
      baseFilter: '',
      healthStatusFilter: '',
      nextCheckWithin: '',
      sortBy: 'registration',
      searchQuery: '',
    }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  setSortBy: (sort) => set({ sortBy: sort }),

  toggleKpis: () => set((s) => ({ kpisCollapsed: !s.kpisCollapsed })),

  expandAircraft: async (id) => {
    const operatorId = getOperatorId()
    if (!operatorId) return

    set({ expandedAircraftId: id, expandedRecords: [], expandedRecordsLoading: true })
    try {
      const res = await authedFetch(`${API_BASE}/aircraft-status-board/${id}/records?operatorId=${operatorId}`)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Records API ${res.status}: ${body}`)
      }
      const data = await res.json()
      set({ expandedRecords: data.records ?? [], expandedRecordsLoading: false })
    } catch (err) {
      set({ expandedRecordsLoading: false, error: (err as Error).message })
    }
  },

  collapseAircraft: () => set({ expandedAircraftId: null, expandedRecords: [], expandedRecordsLoading: false }),

  openContextMenu: (menu) => set({ contextMenu: menu }),

  closeContextMenu: () => set({ contextMenu: null }),
}))
