import type { CoverageState } from './compute-flight-coverage'

export interface CoverageColor {
  bg: string
  text: string
}

const LIGHT: Record<CoverageState, string> = {
  uncovered: '#FF3B3B',
  fully: '#06C270',
  under: '#FF8800',
  over: '#6600CC',
  mixed: '#BE185D',
}

const DARK: Record<CoverageState, string> = {
  uncovered: '#DC2626',
  fully: '#059669',
  under: '#D97706',
  over: '#7C3AED',
  mixed: '#A21951',
}

export function coverageBarColor(state: CoverageState, isDark: boolean): CoverageColor {
  return { bg: (isDark ? DARK : LIGHT)[state], text: '#FFFFFF' }
}
