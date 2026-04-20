import { create } from 'zustand'
import { api, type OperatorRef } from '@skyhub/api'
import type { DateFormatType } from '@skyhub/logic'

interface OperatorState {
  operator: OperatorRef | null
  dateFormat: DateFormatType
  loaded: boolean
  loadOperator: () => Promise<void>
  setOperator: (op: OperatorRef) => void
  reset: () => void
}

const DEFAULT_FORMAT: DateFormatType = 'DD-MMM-YY'

/**
 * Mirror of the web operator store. One operator per user session; pages
 * read `dateFormat` from here to format dates consistently. Populated once
 * after auth succeeds (see app/_layout.tsx).
 */
export const useOperatorStore = create<OperatorState>((set, get) => ({
  operator: null,
  dateFormat: DEFAULT_FORMAT,
  loaded: false,

  loadOperator: async () => {
    if (get().loaded) return
    try {
      const operators = await api.getOperators()
      const op = operators[0]
      if (op) {
        set({
          operator: op,
          dateFormat: (op.dateFormat as DateFormatType) ?? DEFAULT_FORMAT,
          loaded: true,
        })
      }
    } catch (e) {
      console.error('[operator-store] failed to load:', e)
    }
  },

  setOperator: (op) =>
    set({
      operator: op,
      dateFormat: (op.dateFormat as DateFormatType) ?? DEFAULT_FORMAT,
      loaded: true,
    }),

  reset: () => set({ operator: null, dateFormat: DEFAULT_FORMAT, loaded: false }),
}))

/** Sync accessor — current operator's date format, falling back to DD-MMM-YY. */
export function getOperatorDateFormat(): DateFormatType {
  return useOperatorStore.getState().dateFormat
}
