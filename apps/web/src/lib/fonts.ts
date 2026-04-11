/**
 * Web font scales — supports Small, Default, Large, Extra Large.
 * MINIMUM: 13px at Default scale. Nothing goes below 13px at any scale.
 *
 * Usage:
 *   import { getWebFonts, type TextScale } from "@/lib/fonts";
 *   const F = getWebFonts("default");
 *   <span style={{ fontSize: F.sm }}>subtitle</span>
 */

export type TextScale = 'small' | 'default' | 'large' | 'xlarge'

export interface WebFonts {
  min: number
  sm: number
  md: number
  lg: number
  xl: number
  xxl: number
}

const SCALES: Record<TextScale, WebFonts> = {
  small: { min: 13, sm: 14, md: 15, lg: 17, xl: 20, xxl: 24 },
  default: { min: 14, sm: 15, md: 16, lg: 18, xl: 22, xxl: 26 },
  large: { min: 15, sm: 16, md: 18, lg: 20, xl: 24, xxl: 28 },
  xlarge: { min: 16, sm: 18, md: 20, lg: 22, xl: 26, xxl: 32 },
}

export function getWebFonts(scale: TextScale): WebFonts {
  return SCALES[scale]
}

/** Backwards compat — current "small" is the old WEB_FONTS */
export const WEB_FONTS = SCALES.default

export type WebFontKey = keyof WebFonts

export const TEXT_SCALE_OPTIONS: { value: TextScale; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
]

/**
 * Web layout constants — single source of truth for panel widths.
 */
export const WEB_LAYOUT = {
  /** Left sidebar/panel width across all detail pages */
  sidebarWidth: 320,
  /** Right inspector/panel width when used in 3-panel layouts */
  inspectorWidth: 320,
} as const

// ── Persistence ──

const STORAGE_KEY = 'skyhub-text-scale'

export function getSavedTextScale(): TextScale {
  if (typeof window === 'undefined') return 'default'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && saved in SCALES) return saved as TextScale
  return 'default'
}

export function saveTextScale(scale: TextScale) {
  localStorage.setItem(STORAGE_KEY, scale)
}
