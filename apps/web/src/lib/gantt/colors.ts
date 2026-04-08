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
    return { bg: applyOpacity(typeColor, isDark ? 0.6 : 0.75), text: '#ffffff' }
  }
  // 'status' is the default for all other modes
  return getStatusColor(flight, isDark)
}

function getStatusColor(flight: GanttFlight, isDark: boolean): BarColor {
  const isAssigned = !!flight.aircraftReg

  if (flight.status === 'cancelled') {
    return {
      bg: isDark ? 'rgba(230,53,53,0.40)' : 'rgba(230,53,53,0.55)',
      text: isDark ? 'rgba(255,255,255,0.85)' : '#ffffff',
    }
  }
  if (flight.status === 'suspended') {
    return {
      bg: isDark ? 'rgba(143,144,166,0.30)' : 'rgba(143,144,166,0.40)',
      text: isDark ? 'rgba(255,255,255,0.55)' : '#8F90A6',
    }
  }
  if (flight.status === 'active' && isAssigned) {
    return {
      bg: isDark ? 'rgba(16,185,129,0.65)' : 'rgba(22,163,74,0.75)',
      text: '#ffffff',
    }
  }
  if (flight.status === 'active' && !isAssigned) {
    return {
      bg: isDark ? 'rgba(245,158,11,0.60)' : 'rgba(217,119,6,0.70)',
      text: '#ffffff',
    }
  }
  if (flight.status === 'draft' && isAssigned) {
    return {
      bg: isDark ? 'rgba(59,130,246,0.60)' : 'rgba(37,99,235,0.70)',
      text: '#ffffff',
    }
  }
  // draft + unassigned (fallback)
  return {
    bg: isDark ? 'rgba(100,116,139,0.50)' : 'rgba(100,116,139,0.60)',
    text: isDark ? 'rgba(255,255,255,0.8)' : '#ffffff',
  }
}

function applyOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

/** Default palette when AircraftType.color is null. */
export const AC_TYPE_COLOR_PALETTE = [
  '#0d9488', '#2563eb', '#d97706', '#7c3aed',
  '#059669', '#e11d48', '#0284c7', '#ca8a04',
] as const

/**
 * Build the AC type → color map from aircraft types.
 * Uses stored color if present, otherwise cycles through the palette.
 */
export function buildAcTypeColorMap(
  types: Array<{ icaoType: string; color: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>()
  types.forEach((t, i) => {
    map.set(t.icaoType, t.color ?? AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length])
  })
  return map
}
