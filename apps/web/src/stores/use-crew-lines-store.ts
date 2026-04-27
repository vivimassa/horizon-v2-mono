'use client'

import { create } from 'zustand'
import { fetchCrewLines, type CrewLine } from '@/lib/gantt/api'

export type CrewLinesMode = 'off' | 'selected' | 'all'

interface CrewLinesState {
  mode: CrewLinesMode
  lines: CrewLine[]
  loading: boolean
  /** Last successful fetch key — `${flightId ?? '*'}|${fromMs}|${toMs}` */
  lastKey: string | null

  setMode: (mode: CrewLinesMode) => void
  load: (params: {
    operatorId: string
    fromUtcMs: number
    toUtcMs: number
    flightId?: string
    scenarioId?: string | null
  }) => Promise<void>
  clear: () => void
}

export const useCrewLinesStore = create<CrewLinesState>((set, get) => ({
  mode: 'off',
  lines: [],
  loading: false,
  lastKey: null,

  setMode: (mode) => {
    if (mode === 'off') {
      set({ mode, lines: [], lastKey: null })
    } else {
      set({ mode })
    }
  },

  load: async ({ operatorId, fromUtcMs, toUtcMs, flightId, scenarioId }) => {
    if (get().mode === 'off') return
    const key = `${flightId ?? '*'}|${fromUtcMs}|${toUtcMs}|${scenarioId ?? ''}`
    if (key === get().lastKey && get().lines.length > 0) return
    set({ loading: true })
    try {
      const { lines } = await fetchCrewLines({
        operatorId,
        fromUtcMs,
        toUtcMs,
        flightId,
        scenarioId: scenarioId ?? undefined,
      })
      if (get().mode === 'off') return
      set({ lines, loading: false, lastKey: key })
    } catch (err) {
      console.error('[crew-lines] fetch failed', err)
      set({ loading: false })
    }
  },

  clear: () => set({ lines: [], lastKey: null }),
}))
