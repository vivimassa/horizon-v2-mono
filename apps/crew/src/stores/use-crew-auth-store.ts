import { create } from 'zustand'
import type { CrewProfile } from '../lib/api-client'

interface CrewAuthState {
  isLoading: boolean
  isAuthenticated: boolean
  profile: CrewProfile | null
  expoPushToken: string | null
  setLoading(v: boolean): void
  setSession(profile: CrewProfile): void
  setPushToken(token: string | null): void
  logout(): void
}

export const useCrewAuthStore = create<CrewAuthState>((set) => ({
  isLoading: true,
  isAuthenticated: false,
  profile: null,
  expoPushToken: null,
  setLoading: (v) => set({ isLoading: v }),
  setSession: (profile) => set({ profile, isAuthenticated: true, isLoading: false }),
  setPushToken: (token) => set({ expoPushToken: token }),
  logout: () => set({ profile: null, isAuthenticated: false, expoPushToken: null, isLoading: false }),
}))
