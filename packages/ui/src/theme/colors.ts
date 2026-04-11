// SkyHub — Color Tokens

export type StatusKey = 'onTime' | 'delayed' | 'cancelled' | 'departed' | 'diverted' | 'scheduled'

interface StatusColor {
  bg: string
  text: string
  darkBg: string
  darkText: string
}

export const colors = {
  light: {
    background: '#FAFAFC',
    backgroundSecondary: '#F7F7FA',
    backgroundHover: '#F2F2F5',
    text: '#1C1C28',
    textSecondary: '#555770',
    textTertiary: '#8F90A6',
    border: '#E4E4EB',
    borderSecondary: '#C7C9D9',
    card: '#FFFFFF',
    cardBorder: '#EBEBF0',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E4E4EB',
    tabInactive: '#8F90A6',
  },
  dark: {
    background: '#0E0E14',
    backgroundSecondary: '#13131A',
    backgroundHover: '#1F1F28',
    text: '#F5F2FD',
    textSecondary: '#8F90A6',
    textTertiary: '#555770',
    border: 'rgba(255,255,255,0.08)',
    borderSecondary: 'rgba(255,255,255,0.12)',
    card: '#191921',
    cardBorder: 'rgba(255,255,255,0.06)',
    tabBar: '#0E0E14',
    tabBarBorder: 'rgba(255,255,255,0.06)',
    tabInactive: '#555770',
  },
  status: {
    onTime: {
      bg: 'rgba(6,194,112,0.12)',
      text: '#06C270',
      darkBg: 'rgba(57,217,138,0.15)',
      darkText: '#39D98A',
    },
    delayed: {
      bg: 'rgba(255,136,0,0.12)',
      text: '#E67A00',
      darkBg: 'rgba(253,172,66,0.15)',
      darkText: '#FDAC42',
    },
    cancelled: {
      bg: 'rgba(255,59,59,0.12)',
      text: '#E63535',
      darkBg: 'rgba(255,92,92,0.15)',
      darkText: '#FF5C5C',
    },
    departed: {
      bg: 'rgba(0,99,247,0.12)',
      text: '#0063F7',
      darkBg: 'rgba(91,141,239,0.15)',
      darkText: '#5B8DEF',
    },
    diverted: {
      bg: 'rgba(0,207,222,0.12)',
      text: '#00B7C4',
      darkBg: 'rgba(115,223,231,0.15)',
      darkText: '#73DFE7',
    },
    scheduled: {
      bg: '#F2F2F5',
      text: '#555770',
      darkBg: '#28293D',
      darkText: '#8F90A6',
    },
  } satisfies Record<StatusKey, StatusColor>,
  accentPresets: {
    Blue: '#1e40af',
    Sky: '#3E7BFA',
    Teal: '#0f766e',
    Violet: '#7c3aed',
    Amber: '#b45309',
    Green: '#15803d',
    Maroon: '#991b1b',
    Pink: '#be185d',
  },
  /** Primary color shades (XD Core Design System — based on #3E7BFA) */
  primary: {
    pressed: '#3568D4',
    default: '#3E7BFA',
    hover: '#5B8DEF',
    light: '#6698FF',
    lighter: '#9DBFF9',
    lightest: '#CCDDFF',
    surfaceTint: '#E5F0FF',
  },
  /** Extended semantic colors (XD System) */
  semantic: {
    yellow: { light: '#FFCC00', dark: '#FDDD48' },
    purple: { light: '#6600CC', dark: '#AC5DD9' },
    teal: { light: '#00CFDE', dark: '#73DFE7' },
  },
  /** @deprecated Use darkAccent(hex) directly instead of this lookup map */
  accentPresetsDark: {} as Record<string, string>,
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
 * Convert hex to HSL. Returns [h (0-360), s (0-100), l (0-100)].
 */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Derive a dark-mode accent from a light-mode accent.
 * Same hue, 80% of original saturation, lightness boosted to 70% for readability.
 */
export function darkAccent(hex: string): string {
  const [h, s, _l] = hexToHsl(hex)
  return hslToHex(h, s * 0.8, 70)
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

export function getStatusColors(statusKey: StatusKey, isDark: boolean): { bg: string; text: string } {
  const s = colors.status[statusKey]
  return isDark ? { bg: s.darkBg, text: s.darkText } : { bg: s.bg, text: s.text }
}

/** Glass panel helpers for hero/elevated cards (Stitch aesthetic) */
export const glass = {
  panel: 'rgba(25,25,33,0.85)',
  panelBorder: 'rgba(255,255,255,0.06)',
  panelHover: 'rgba(31,31,40,0.90)',
  /** Radial glow behind hero sections (web only — CSS gradient, not RN) */
  radialGlow: (accentHex: string) =>
    `radial-gradient(circle at 50% 30%, ${accentTint(accentHex, 0.12)} 0%, transparent 70%)`,
  /** Accent glow shadow for selected items (cross-platform) */
  accentGlow: (accentHex: string) => ({
    shadowColor: accentHex,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  }),
} as const
