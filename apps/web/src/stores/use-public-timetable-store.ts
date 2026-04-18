'use client'

import { create } from 'zustand'
import type { DirectionMode } from '@/lib/public-timetable/logic'

function firstOfMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function lastOfMonthIso(): string {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

export interface CommittedTimetableFilters {
  dateFrom: string
  dateTo: string
  from: string
  to: string
  direction: DirectionMode
  effectiveDate: string
}

interface PublicTimetableState {
  dateFrom: string
  dateTo: string
  from: string
  to: string
  direction: DirectionMode
  effectiveDate: string

  committed: CommittedTimetableFilters | null

  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  setFrom: (v: string) => void
  setTo: (v: string) => void
  setDirection: (v: DirectionMode) => void
  setEffectiveDate: (v: string) => void

  commit: () => void
  reset: () => void
}

export const usePublicTimetableStore = create<PublicTimetableState>((set, get) => ({
  dateFrom: firstOfMonthIso(),
  dateTo: lastOfMonthIso(),
  from: '',
  to: '',
  direction: 'both',
  effectiveDate: '',

  committed: null,

  setDateFrom: (v) => set({ dateFrom: v }),
  setDateTo: (v) => set({ dateTo: v }),
  setFrom: (v) => set({ from: v.toUpperCase() }),
  setTo: (v) => set({ to: v.toUpperCase() }),
  setDirection: (v) => set({ direction: v }),
  setEffectiveDate: (v) => set({ effectiveDate: v }),

  commit: () => {
    const { dateFrom, dateTo, from, to, direction, effectiveDate } = get()
    if (!dateFrom || !dateTo || !from || !to) return
    set({ committed: { dateFrom, dateTo, from, to, direction, effectiveDate } })
  },

  reset: () =>
    set({
      dateFrom: firstOfMonthIso(),
      dateTo: lastOfMonthIso(),
      from: '',
      to: '',
      direction: 'both',
      effectiveDate: '',
      committed: null,
    }),
}))
