import { create } from 'zustand'
import { colors, type Palette } from '../theme/colors'

type ColorMode = 'light' | 'dark'

export type BackgroundPreset = 'aurora' | 'ember' | 'lagoon' | 'prism' | 'none'

interface ThemeState {
  colorMode: ColorMode
  accentColor: string
  backgroundPreset: BackgroundPreset
  palette: Palette
  setColorMode: (mode: ColorMode) => void
  toggleColorMode: () => void
  setAccentColor: (color: string) => void
  setBackgroundPreset: (preset: BackgroundPreset) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  // Dark-first default — the SkyHub hub, wallpapers, glass and accent glows
  // are all designed against a dark background. Consumers on web still flip
  // to light via `setColorMode('light')`.
  colorMode: 'dark',
  accentColor: colors.defaultAccent,
  backgroundPreset: 'aurora',
  palette: colors.dark,
  setColorMode: (mode) => set({ colorMode: mode, palette: colors[mode] }),
  toggleColorMode: () =>
    set((s) => {
      const next = s.colorMode === 'light' ? 'dark' : 'light'
      return { colorMode: next, palette: colors[next] }
    }),
  setAccentColor: (color) => set({ accentColor: color }),
  setBackgroundPreset: (preset) => set({ backgroundPreset: preset }),
}))
