// SkyHub — Color Tokens

export type StatusKey =
  | 'onTime'
  | 'delayed'
  | 'cancelled'
  | 'departed'
  | 'diverted'
  | 'scheduled'

interface StatusColor {
  bg: string
  text: string
  darkBg: string
  darkText: string
}

export const colors = {
  light: {
    background: '#f0f2f5',
    backgroundSecondary: 'rgba(245,245,245,0.80)',
    backgroundHover: 'rgba(235,235,235,0.85)',
    text: '#111111',
    textSecondary: '#888888',
    textTertiary: '#aaaaaa',
    border: 'rgba(232,232,232,0.70)',
    borderSecondary: 'rgba(212,212,212,0.70)',
    card: 'rgba(245,245,245,0.75)',
    cardBorder: 'rgba(232,232,232,0.60)',
    tabBar: 'rgba(255,255,255,0.85)',
    tabBarBorder: 'rgba(232,232,232,0.60)',
    tabInactive: '#888888',
  },
  dark: {
    background: '#111118',
    backgroundSecondary: 'rgba(40,40,44,0.85)',
    backgroundHover: 'rgba(55,55,60,0.90)',
    text: '#f5f5f5',
    textSecondary: '#a1a1aa',
    textTertiary: '#71717a',
    border: 'rgba(255,255,255,0.10)',
    borderSecondary: 'rgba(255,255,255,0.14)',
    card: 'rgba(30,30,34,0.80)',
    cardBorder: 'rgba(255,255,255,0.10)',
    tabBar: 'rgba(22,22,26,0.92)',
    tabBarBorder: 'rgba(255,255,255,0.10)',
    tabInactive: '#a1a1aa',
  },
  status: {
    onTime: {
      bg: '#dcfce7',
      text: '#166534',
      darkBg: 'rgba(22,163,74,0.15)',
      darkText: '#4ade80',
    },
    delayed: {
      bg: '#fef3c7',
      text: '#92400e',
      darkBg: 'rgba(245,158,11,0.15)',
      darkText: '#fbbf24',
    },
    cancelled: {
      bg: '#fee2e2',
      text: '#991b1b',
      darkBg: 'rgba(220,38,38,0.15)',
      darkText: '#f87171',
    },
    departed: {
      bg: '#dbeafe',
      text: '#1e40af',
      darkBg: 'rgba(30,64,175,0.15)',
      darkText: '#60a5fa',
    },
    diverted: {
      bg: '#f3e8ff',
      text: '#6b21a8',
      darkBg: 'rgba(124,58,237,0.15)',
      darkText: '#a78bfa',
    },
    scheduled: {
      bg: '#f5f5f5',
      text: '#555555',
      darkBg: '#303030',
      darkText: '#999999',
    },
  } satisfies Record<StatusKey, StatusColor>,
  accentPresets: {
    Blue: '#1e40af',
    Teal: '#0f766e',
    Violet: '#7c3aed',
    Maroon: '#991b1b',
    Amber: '#b45309',
    Green: '#15803d',
    Sky: '#0369a1',
    Pink: '#be185d',
  },
  defaultAccent: '#1e40af',
} as const

export type Palette = {
  readonly background: string
  readonly backgroundSecondary: string
  readonly backgroundHover: string
  readonly text: string
  readonly textSecondary: string
  readonly textTertiary: string
  readonly border: string
  readonly borderSecondary: string
  readonly card: string
  readonly cardBorder: string
  readonly tabBar: string
  readonly tabBarBorder: string
  readonly tabInactive: string
}

export function accentTint(hexColor: string, opacity: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

/**
 * Desaturate a hex color by a given amount (0-1).
 * Default 0.2 = 20% desaturation. Used in dark mode to reduce eye strain.
 */
export function desaturate(hex: string, amount = 0.2): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const nr = Math.round(r + (gray - r) * amount)
  const ng = Math.round(g + (gray - g) * amount)
  const nb = Math.round(b + (gray - b) * amount)
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`
}

/**
 * Return the color adjusted for the current mode.
 * In dark mode, desaturates by 20% to reduce vibrancy on dark backgrounds.
 */
export function modeColor(hex: string, isDark: boolean): string {
  return isDark ? desaturate(hex, 0.2) : hex
}

export function getStatusColors(
  statusKey: StatusKey,
  isDark: boolean,
): { bg: string; text: string } {
  const s = colors.status[statusKey]
  return isDark ? { bg: s.darkBg, text: s.darkText } : { bg: s.bg, text: s.text }
}
