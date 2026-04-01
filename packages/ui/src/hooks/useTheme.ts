import { useThemeStore } from '../stores/useThemeStore'

export function useTheme() {
  const palette = useThemeStore((s) => s.palette)
  const accentColor = useThemeStore((s) => s.accentColor)
  const colorMode = useThemeStore((s) => s.colorMode)
  const backgroundPreset = useThemeStore((s) => s.backgroundPreset)
  const isDark = colorMode === 'dark'
  return { palette, accentColor, colorMode, backgroundPreset, isDark }
}
