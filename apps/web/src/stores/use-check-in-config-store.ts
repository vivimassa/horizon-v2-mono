'use client'

import { create } from 'zustand'
import { api, DEFAULT_CHECK_IN_CONFIG, type OperatorCheckInConfig } from '@skyhub/api'

interface State {
  config: OperatorCheckInConfig | null
  loaded: boolean
  loading: boolean
  error: string | null
}

interface Actions {
  load: (operatorId: string) => Promise<void>
  save: (next: Partial<OperatorCheckInConfig>) => Promise<void>
  /** Returns the active config (loaded doc OR defaults wrapped in a fake shell). */
  effective: () => OperatorCheckInConfig
}

const FAKE_DOC = (operatorId: string): OperatorCheckInConfig => ({
  _id: 'default',
  operatorId,
  ...DEFAULT_CHECK_IN_CONFIG,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
})

export const useCheckInConfigStore = create<State & Actions>((set, get) => ({
  config: null,
  loaded: false,
  loading: false,
  error: null,

  load: async (operatorId) => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const doc = await api.getOperatorCheckInConfig(operatorId)
      set({ config: doc ?? FAKE_DOC(operatorId), loaded: true, loading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load config'
      set({ error: msg, loading: false, loaded: true, config: FAKE_DOC(operatorId) })
    }
  },

  save: async (next) => {
    const cur = get().config
    if (!cur) return
    const merged: OperatorCheckInConfig = {
      ...cur,
      ...next,
      basic: { ...cur.basic, ...(next.basic ?? {}) },
      lateInfo: { ...cur.lateInfo, ...(next.lateInfo ?? {}) },
      delayed: { ...cur.delayed, ...(next.delayed ?? {}) },
      groundDuties: { ...cur.groundDuties, ...(next.groundDuties ?? {}) },
      precheckIn: { ...cur.precheckIn, ...(next.precheckIn ?? {}) },
    }
    set({ config: merged })
    const saved = await api.upsertOperatorCheckInConfig({
      operatorId: cur.operatorId,
      basic: merged.basic,
      lateInfo: merged.lateInfo,
      delayed: merged.delayed,
      groundDuties: merged.groundDuties,
      precheckIn: merged.precheckIn,
    })
    set({ config: saved })
  },

  effective: () => get().config ?? FAKE_DOC('unknown'),
}))
