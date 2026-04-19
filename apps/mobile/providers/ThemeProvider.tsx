import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Appearance, useWindowDimensions } from 'react-native'
import { colors, accentTint, darkAccent, type Palette } from '@skyhub/ui/theme'
import { useThemeStore } from '@skyhub/ui'

/** Resolve accent color for current mode — same hue, 80% saturation, 70% lightness */
function resolveAccent(hex: string, isDark: boolean): string {
  if (!isDark) return hex
  return darkAccent(hex)
}

// ── Global font size scale ──
// Every screen reads these instead of hardcoding sizes.
// Phone base, tablet gets ~1.2x via `fs()`.
export interface FontSizes {
  /** Extra small labels, badges (phone 11, tablet 13) */
  xs: number
  /** Secondary text, subtitles (phone 13, tablet 15) */
  sm: number
  /** Body text, list items (phone 15, tablet 17) */
  md: number
  /** Section headers (phone 17, tablet 20) */
  lg: number
  /** Page titles (phone 20, tablet 24) */
  xl: number
  /** Hero display text (phone 24, tablet 28) */
  xxl: number
}

const PHONE_FONTS: FontSizes = { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24 }
const TABLET_FONTS: FontSizes = { xs: 13, sm: 15, md: 17, lg: 20, xl: 24, xxl: 28 }
const TABLET_WIDTH = 768

interface ThemeContextValue {
  isDark: boolean
  palette: Palette
  /** Accent color resolved for current mode (bright+desaturated in dark mode) */
  accent: string
  /** Raw accent hex as chosen by user (light-mode value, for picker comparison) */
  rawAccent: string
  isTablet: boolean
  /** Global font sizes — use these instead of hardcoded numbers */
  fonts: FontSizes
  /** Scale a custom font size for current device (1x phone, 1.2x tablet) */
  fs: (size: number) => number
  toggleDark: () => void
  setAccent: (hex: string) => void
}

const ThemeCtx = createContext<ThemeContextValue>({
  isDark: false,
  palette: colors.light,
  accent: '#1e40af',
  rawAccent: '#1e40af',
  isTablet: false,
  fonts: PHONE_FONTS,
  fs: (s) => s,
  toggleDark: () => {},
  setAccent: () => {},
})

export function useAppTheme() {
  return useContext(ThemeCtx)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark mode for every user on every launch — the SkyHub hub is
  // designed dark-first (wallpapers, glass, accent glows all read strongest
  // on dark). Users can still flip via the UserMenu toggle.
  const [isDark, setIsDark] = useState(true)
  const [accent, setAccent] = useState('#1e40af')
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_WIDTH

  const palette = isDark ? colors.dark : colors.light
  const resolvedAccent = resolveAccent(accent, isDark)
  const fonts = isTablet ? TABLET_FONTS : PHONE_FONTS
  const scale = isTablet ? 1.2 : 1
  const fs = useCallback((size: number) => Math.round(size * scale), [scale])

  // Sync the shared Zustand useThemeStore whenever the context mode flips.
  // Shared components in `packages/ui` (Text, ListScreenHeader, etc.) read
  // palette from that store — without this bridge they always render in
  // light mode and become invisible on the mobile dark background.
  useEffect(() => {
    useThemeStore.getState().setColorMode(isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    useThemeStore.getState().setAccentColor(accent)
  }, [accent])

  const toggleDark = useCallback(() => {
    const next = !isDark
    setIsDark(next)
    Appearance.setColorScheme(next ? 'dark' : 'light')
  }, [isDark])

  return (
    <ThemeCtx.Provider
      value={{ isDark, palette, accent: resolvedAccent, rawAccent: accent, isTablet, fonts, fs, toggleDark, setAccent }}
    >
      {children}
    </ThemeCtx.Provider>
  )
}
