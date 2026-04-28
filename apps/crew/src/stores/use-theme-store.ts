import { create } from 'zustand'
import { Appearance, type ColorSchemeName } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'dark' | 'light' | 'system'
export type Scheme = 'dark' | 'light'

const STORAGE_KEY = '@skyhub-crew/theme-mode'

interface ThemeState {
  mode: ThemeMode
  systemScheme: Scheme
  hydrated: boolean
  setMode(mode: ThemeMode): void
  hydrate(): Promise<void>
}

function resolveSystemScheme(s: ColorSchemeName): Scheme {
  return s === 'light' ? 'light' : 'dark'
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  systemScheme: resolveSystemScheme(Appearance.getColorScheme()),
  hydrated: false,
  setMode: (mode) => {
    set({ mode })
    void AsyncStorage.setItem(STORAGE_KEY, mode)
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        set({ mode: stored })
      }
    } catch {
      // ignore — fall back to default 'dark'
    } finally {
      set({ hydrated: true })
    }
  },
}))

Appearance.addChangeListener(({ colorScheme }) => {
  useThemeStore.setState({ systemScheme: resolveSystemScheme(colorScheme) })
})

export function useScheme(): Scheme {
  const mode = useThemeStore((s) => s.mode)
  const systemScheme = useThemeStore((s) => s.systemScheme)
  return mode === 'system' ? systemScheme : mode
}
