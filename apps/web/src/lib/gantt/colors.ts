import type { GanttFlight, ColorMode } from './types'

interface BarColor {
  bg: string
  text: string
}

/**
 * Compute bar fill and text colors based on flight state and color mode.
 */
export function getBarColor(
  flight: GanttFlight,
  colorMode: ColorMode,
  acTypeColors: Map<string, string>,
  isDark: boolean,
): BarColor {
  if (colorMode === 'ac_type') {
    const typeColor = acTypeColors.get(flight.aircraftTypeIcao ?? '') ?? '#3B82F6'
    return { bg: typeColor, text: '#ffffff' }
  }
  // 'status' is the default for all other modes
  return getStatusColor(flight, isDark)
}

function getStatusColor(flight: GanttFlight, isDark: boolean): BarColor {
  const isAssigned = !!flight.aircraftReg

  if (flight.status === 'cancelled') {
    return {
      bg: isDark ? '#7f1d1d' : '#dc2626',
      text: '#ffffff',
    }
  }
  if (flight.status === 'suspended') {
    return {
      bg: isDark ? '#4a4a5a' : '#8F90A6',
      text: isDark ? 'rgba(255,255,255,0.7)' : '#ffffff',
    }
  }
  if (flight.status === 'active' && isAssigned) {
    return {
      bg: isDark ? '#059669' : '#16a34a',
      text: '#ffffff',
    }
  }
  if (flight.status === 'active' && !isAssigned) {
    return {
      bg: isDark ? '#d97706' : '#d97706',
      text: '#ffffff',
    }
  }
  if (flight.status === 'draft' && isAssigned) {
    return {
      bg: isDark ? '#2563eb' : '#2563eb',
      text: '#ffffff',
    }
  }
  // draft + unassigned (fallback)
  return {
    bg: isDark ? '#64748b' : '#94a3b8',
    text: '#ffffff',
  }
}

function applyOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

/** Slot status indicator colors */
export const SLOT_STATUS_COLORS: Record<string, string> = {
  confirmed: '#06C270',
  offered: '#FF8800',
  waitlisted: '#7c3aed',
  refused: '#FF3B3B',
  conditional: '#00CFDE',
}

/** Utilization risk level colors for slot lines */
export const SLOT_RISK_COLORS: Record<string, string> = {
  safe: '#06C270',
  close: '#FF8800',
  at_risk: '#FF3B3B',
}

/** Color for missing OOOI times corner flags */
export const MISSING_TIMES_FLAG_COLOR = '#FF8800'

/** Default palette when AircraftType.color is null. */
export const AC_TYPE_COLOR_PALETTE = [
  '#0d9488',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#059669',
  '#e11d48',
  '#0284c7',
  '#ca8a04',
] as const

/**
 * Build the AC type → color map from aircraft types.
 * Uses stored color if present, otherwise cycles through the palette.
 */
export function buildAcTypeColorMap(types: Array<{ icaoType: string; color: string | null }>): Map<string, string> {
  const map = new Map<string, string>()
  types.forEach((t, i) => {
    map.set(t.icaoType, t.color ?? AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length])
  })
  return map
}
