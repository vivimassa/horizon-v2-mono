import { HORIZON, type Theme } from './tokens'

/**
 * Resolved theme accessor. Phase A forces dark; Phase B will read from a
 * Zustand store wired to the user's "Appearance" preference in More.
 */
export function useTheme(): Theme {
  return HORIZON.dark
}
