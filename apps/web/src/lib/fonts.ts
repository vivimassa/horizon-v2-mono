/**
 * Web font scale — single source of truth for all text sizes.
 * MINIMUM: 13px. Nothing in the app goes below this.
 *
 * Usage:
 *   import { WEB_FONTS } from "@/lib/fonts";
 *   <span style={{ fontSize: WEB_FONTS.sm }}>subtitle</span>
 */
export const WEB_FONTS = {
  /** 13px — Badges, timestamps, tertiary labels (absolute minimum) */
  min: 13,
  /** 14px — Subtitles, descriptions, secondary info */
  sm: 14,
  /** 15px — Body text, list items, form fields */
  md: 15,
  /** 17px — Section headers, card titles */
  lg: 17,
  /** 20px — Page titles, hero name */
  xl: 20,
  /** 24px — Display text, avatar initials */
  xxl: 24,
} as const;

export type WebFontKey = keyof typeof WEB_FONTS;

/**
 * Web layout constants — single source of truth for panel widths.
 */
export const WEB_LAYOUT = {
  /** Left sidebar/panel width across all detail pages */
  sidebarWidth: 320,
  /** Right inspector/panel width when used in 3-panel layouts */
  inspectorWidth: 320,
} as const;
