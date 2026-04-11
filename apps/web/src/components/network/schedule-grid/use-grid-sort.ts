// Network Scheduling XL — Column Sorting Hook

import { create } from 'zustand'
import type { ScheduledFlightRef } from '@skyhub/api'

interface GridSortState {
  sortKey: string | null
  sortDir: 'asc' | 'desc'
  setSortKey: (key: string) => void
  clearSort: () => void
}

export const useGridSortStore = create<GridSortState>((set, get) => ({
  sortKey: null,
  sortDir: 'asc',
  setSortKey: (key) =>
    set((state) => {
      if (state.sortKey === key) {
        return { sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' }
      }
      return { sortKey: key, sortDir: 'asc' }
    }),
  clearSort: () => set({ sortKey: null, sortDir: 'asc' }),
}))

export function sortRows(
  rows: ScheduledFlightRef[],
  sortKey: string | null,
  sortDir: 'asc' | 'desc',
): ScheduledFlightRef[] {
  if (!sortKey) return rows

  return [...rows].sort((a, b) => {
    const av = (a as any)[sortKey]
    const bv = (b as any)[sortKey]

    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1

    const aStr = String(av)
    const bStr = String(bv)

    // Numeric comparison for numeric fields
    if (sortKey === 'blockMinutes' || sortKey === 'arrivalDayOffset') {
      const diff = Number(av) - Number(bv)
      return sortDir === 'asc' ? diff : -diff
    }

    // String comparison for everything else
    const cmp = aStr.localeCompare(bStr)
    return sortDir === 'asc' ? cmp : -cmp
  })
}
