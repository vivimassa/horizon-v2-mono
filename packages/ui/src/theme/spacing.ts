// SkyHub — Spacing & Dimension Tokens (Core Design System)

// NEVER below 13px — user memory feedback_min_font_size.md

/** Button size scale from Core Design System */
export const buttonSize = {
  /** 24px — compact actions, icon-only buttons */
  sm: { height: 24, fontSize: 13, paddingX: 8, radius: 8 },
  /** 32px — standard buttons, toolbar actions */
  md: { height: 32, fontSize: 13, paddingX: 12, radius: 8 },
  /** 40px — primary CTAs, form submit */
  lg: { height: 40, fontSize: 14, paddingX: 16, radius: 8 },
  /** 48px — mobile primary actions, full-width CTAs */
  xl: { height: 48, fontSize: 14, paddingX: 20, radius: 10 },
} as const

/** Badge size scale from Core Design System */
export const badgeSize = {
  /** 20px — compact chips, status dots with text */
  sm: { height: 20, fontSize: 13, paddingX: 6, radius: 6 },
  /** 24px — standard badges, status chips */
  md: { height: 24, fontSize: 13, paddingX: 8, radius: 6 },
  /** 29px — large labels, filter tags */
  lg: { height: 29, fontSize: 14, paddingX: 10, radius: 8 },
} as const

export type ButtonSizeKey = keyof typeof buttonSize
export type BadgeSizeKey = keyof typeof badgeSize
