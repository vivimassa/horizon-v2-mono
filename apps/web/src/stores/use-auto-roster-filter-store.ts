'use client'

import { create } from 'zustand'

/**
 * Session-scoped filter state for 4.1.6.1 Automatic Crew Assignment.
 *
 * Values persist while the tab is open (across route mounts within the
 * page) and reset to defaults on refresh — same contract as the other
 * filter stores. No localStorage.
 */
interface AutoRosterFilterStore {
  periodFrom: string
  periodTo: string
  filterBase: string[]
  filterPosition: string[]
  filterAcType: string[]
  filterCrewGroup: string[]
  /** True once the user has hit Go — the workspace uses committed params
   *  for Analyze / Generate / Review. Reset on refresh. */
  committed: boolean

  setPeriodFrom: (v: string) => void
  setPeriodTo: (v: string) => void
  setFilterBase: (v: string[]) => void
  setFilterPosition: (v: string[]) => void
  setFilterAcType: (v: string[]) => void
  setFilterCrewGroup: (v: string[]) => void
  commit: () => void
}

/** Auto-rosters are published month-to-month. Preselect = next full month
 *  (UTC) so the planner opens on the period they almost always build for. */
function defaultPeriod(): { from: string; to: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() // 0-based
  const first = new Date(Date.UTC(y, m + 1, 1))
  const last = new Date(Date.UTC(y, m + 2, 0))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(first), to: iso(last) }
}

const init = defaultPeriod()

export const useAutoRosterFilterStore = create<AutoRosterFilterStore>((set) => ({
  periodFrom: init.from,
  periodTo: init.to,
  filterBase: [],
  filterPosition: [],
  filterAcType: [],
  filterCrewGroup: [],
  committed: false,

  setPeriodFrom: (v) => set({ periodFrom: v }),
  setPeriodTo: (v) => set({ periodTo: v }),
  setFilterBase: (v) => set({ filterBase: v }),
  setFilterPosition: (v) => set({ filterPosition: v }),
  setFilterAcType: (v) => set({ filterAcType: v }),
  setFilterCrewGroup: (v) => set({ filterCrewGroup: v }),
  commit: () => set({ committed: true }),
}))
