'use client'

import { create } from 'zustand'
import type { TransportEmailRef } from '@skyhub/api'

export type TransportEmailFolder = 'held' | 'outgoing' | 'incoming'

interface TransportEmailStoreState {
  emails: TransportEmailRef[]
  folder: TransportEmailFolder
  selectedId: string | null
  selectedIds: Set<string>
  loading: boolean
  /** Compose drawer state — when non-null, drawer is open. */
  composeId: string | null

  setEmails: (e: TransportEmailRef[]) => void
  setFolder: (f: TransportEmailFolder) => void
  setSelectedId: (id: string | null) => void
  toggleSelected: (id: string) => void
  clearSelection: () => void
  setLoading: (l: boolean) => void
  openCompose: (id: string | null) => void
  closeCompose: () => void
}

export const useTransportEmailStore = create<TransportEmailStoreState>((set, get) => ({
  emails: [],
  folder: 'held',
  selectedId: null,
  selectedIds: new Set<string>(),
  loading: false,
  composeId: null,

  setEmails: (e) => set({ emails: e }),
  setFolder: (folder) => set({ folder, selectedId: null, selectedIds: new Set() }),
  setSelectedId: (id) => set({ selectedId: id }),
  toggleSelected: (id) => {
    const cur = new Set(get().selectedIds)
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
    set({ selectedIds: cur })
  },
  clearSelection: () => set({ selectedIds: new Set() }),
  setLoading: (loading) => set({ loading }),
  openCompose: (id) => set({ composeId: id }),
  closeCompose: () => set({ composeId: null }),
}))
