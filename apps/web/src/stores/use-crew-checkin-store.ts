'use client'

import { create } from 'zustand'
import {
  api,
  type CrewAssignmentRef,
  type CrewMemberListItemRef,
  type CrewPositionRef,
  type PairingRef,
  type UncrewedPairingRef,
} from '@skyhub/api'
import { useCrewScheduleStore } from './use-crew-schedule-store'

/**
 * 4.1.7.1 Crew Check-In/Out store.
 *
 *   • Period + station drive the data fetch.
 *   • Optimistic updates on check-in / undo so the controller sees the
 *     status flip instantly.
 *   • On every check-in mutation, the shared crew-schedule store is also
 *     patched (when loaded) so the 4.1.6.2 Gantt picks up the change
 *     without a full refetch — wiring 4.1.7.1 ↔ 4.1.6.2 end-to-end.
 */

export interface CrewCheckInFilters {
  /** Departure IATA codes. Empty = all stations. */
  stations: string[]
  dutyType: 'all' | 'flights' | 'ground' | 'standby'
  positions: string[]
  /** Aircraft type ICAO codes. Empty = all fleets. */
  aircraftTypes: string[]
  hideDeparted: boolean
  hideAllCheckedIn: boolean
}

interface State {
  // Committed view
  stations: string[]
  /** Single calendar date (YYYY-MM-DD). Defaults to today; user can change. */
  date: string
  filters: CrewCheckInFilters
  committed: boolean

  // Draft (filter panel)
  draftStations: string[]
  draftDate: string
  draftFilters: CrewCheckInFilters

  // Data
  pairings: PairingRef[]
  assignments: CrewAssignmentRef[]
  crew: CrewMemberListItemRef[]
  positions: CrewPositionRef[]
  uncrewed: UncrewedPairingRef[]
  loading: boolean
  error: string | null
  lastFetchUtcMs: number | null

  // Selection
  selectedPairingId: string | null

  // 4.1.7.1 Communication panel
  commPanelMode: 'contacts' | 'messages' | 'logs' | null
  selectedCommCrewId: string | null

  // View prefs (persist via Zustand only — not server)
  rowHeight: number
  refreshIntervalMins: number
  groupBy: 'none' | 'base' | 'acType' | 'status'
}

interface Actions {
  setDraftStations: (s: string[]) => void
  setDraftDate: (date: string) => void
  setDraftFilters: (patch: Partial<CrewCheckInFilters>) => void
  commit: () => void
  fetch: () => Promise<void>
  selectPairing: (id: string | null) => void
  checkIn: (assignmentId: string) => Promise<void>
  checkInAllForPairing: (pairingId: string) => Promise<void>
  undoCheckIn: (assignmentId: string) => Promise<void>
  setRowHeight: (h: number) => void
  setRefreshIntervalMins: (m: number) => void
  setGroupBy: (g: State['groupBy']) => void
  setCommPanelMode: (m: State['commPanelMode']) => void
  setSelectedCommCrewId: (id: string | null) => void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function shiftIsoDate(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00.000Z`)
  if (!Number.isFinite(t)) return iso
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10)
}

const EMPTY_FILTERS: CrewCheckInFilters = {
  stations: [],
  dutyType: 'all',
  positions: [],
  aircraftTypes: [],
  hideDeparted: false,
  hideAllCheckedIn: false,
}

export const useCrewCheckInStore = create<State & Actions>((set, get) => ({
  stations: [],
  date: todayIso(),
  filters: { ...EMPTY_FILTERS },
  committed: false,

  draftStations: [],
  draftDate: todayIso(),
  draftFilters: { ...EMPTY_FILTERS },

  pairings: [],
  assignments: [],
  crew: [],
  positions: [],
  uncrewed: [],
  loading: false,
  error: null,
  lastFetchUtcMs: null,

  selectedPairingId: null,

  commPanelMode: null,
  selectedCommCrewId: null,

  rowHeight: 40,
  refreshIntervalMins: 1,
  groupBy: 'none',

  setDraftStations: (s) => set({ draftStations: s.map((x) => x.toUpperCase().slice(0, 3)) }),
  setDraftDate: (date) => set({ draftDate: date }),
  setDraftFilters: (patch) => set({ draftFilters: { ...get().draftFilters, ...patch } }),

  commit: () => {
    const { draftStations, draftDate, draftFilters } = get()
    set({
      stations: draftStations,
      date: draftDate,
      filters: { ...draftFilters, stations: draftStations },
      committed: true,
    })
  },

  fetch: async () => {
    const { date } = get()
    // Widen the server-side window aggressively to ±30 days. The server's
    // assignment filter uses the STORED startUtcIso/endUtcIso on the
    // CrewAssignment doc — and older writes (or any path that used the
    // legs[0].staUtcIso-90 fallback) cached bogus values that fall well
    // outside a tight ±1-day window. With ±30 days every assignment whose
    // pairing operates within the month is returned; the workspace deriver
    // then scopes the visible duty rows to the selected operational date.
    const from = shiftIsoDate(date, -30)
    const to = shiftIsoDate(date, 30)
    set({ loading: true, error: null })
    try {
      const res = await api.getCrewSchedule({ from, to })
      set({
        pairings: res.pairings,
        assignments: res.assignments,
        crew: res.crew,
        positions: res.positions,
        uncrewed: res.uncrewed ?? [],
        loading: false,
        lastFetchUtcMs: Date.now(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch'
      set({ error: msg, loading: false })
      console.error('[crew-checkin] fetch failed', err)
    }
  },

  selectPairing: (id) => {
    const cur = get().selectedPairingId
    if (cur === id) return
    // New pairing context — clear comm-panel selection (different crew set).
    set({ selectedPairingId: id, selectedCommCrewId: null })
  },

  checkIn: async (assignmentId) => {
    const at = Date.now()
    patchLocalAssignment(set, get, assignmentId, { checkInUtcMs: at })
    patchSharedScheduleStore(assignmentId, { checkInUtcMs: at })
    try {
      const updated = await api.checkInCrewAssignment(assignmentId, { at })
      patchLocalAssignment(set, get, assignmentId, updated)
      patchSharedScheduleStore(assignmentId, updated)
    } catch (err) {
      console.error('[crew-checkin] check-in failed', err)
      patchLocalAssignment(set, get, assignmentId, { checkInUtcMs: null })
      patchSharedScheduleStore(assignmentId, { checkInUtcMs: null })
      throw err
    }
  },

  checkInAllForPairing: async (pairingId) => {
    const list = get().assignments.filter((a) => a.pairingId === pairingId && a.checkInUtcMs == null)
    await Promise.all(list.map((a) => get().checkIn(a._id)))
  },

  setRowHeight: (h) => set({ rowHeight: Math.max(28, Math.min(64, Math.round(h))) }),
  setRefreshIntervalMins: (m) => set({ refreshIntervalMins: Math.max(0, Math.min(30, Math.round(m))) }),
  setGroupBy: (g) => set({ groupBy: g }),
  setCommPanelMode: (m) => set({ commPanelMode: m }),
  setSelectedCommCrewId: (id) => set({ selectedCommCrewId: id }),

  undoCheckIn: async (assignmentId) => {
    const prev = get().assignments.find((a) => a._id === assignmentId)?.checkInUtcMs ?? null
    patchLocalAssignment(set, get, assignmentId, { checkInUtcMs: null, checkOutUtcMs: null })
    patchSharedScheduleStore(assignmentId, { checkInUtcMs: null, checkOutUtcMs: null })
    try {
      await api.undoCheckInCrewAssignment(assignmentId)
    } catch (err) {
      console.error('[crew-checkin] undo failed', err)
      patchLocalAssignment(set, get, assignmentId, { checkInUtcMs: prev })
      patchSharedScheduleStore(assignmentId, { checkInUtcMs: prev })
      throw err
    }
  },
}))

function patchLocalAssignment(
  set: (partial: Partial<State>) => void,
  get: () => State,
  id: string,
  patch: Partial<CrewAssignmentRef>,
) {
  const list = get().assignments
  set({ assignments: list.map((a) => (a._id === id ? { ...a, ...patch } : a)) })
}

function patchSharedScheduleStore(id: string, patch: Partial<CrewAssignmentRef>) {
  const sched = useCrewScheduleStore.getState()
  if (!sched.assignments || sched.assignments.length === 0) return
  const next = sched.assignments.map((a) => (a._id === id ? { ...a, ...patch } : a))
  // Only re-set when something actually changed.
  if (next.some((a, i) => a !== sched.assignments[i])) {
    useCrewScheduleStore.setState({ assignments: next } as Partial<ReturnType<typeof useCrewScheduleStore.getState>>)
  }
}
