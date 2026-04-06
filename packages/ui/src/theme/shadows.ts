// SkyHub — Shadow Tokens (Core Design System 6-Level Elevation)
import { Platform } from 'react-native'

/** Shadow color from Core Design System — neutral blue-gray, not pure black */
const SHADOW_COLOR = '#606170'

export const shadowStyles = {
  /** Level 01 — Resting cards, list items */
  card: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 0.5 }, shadowOpacity: 0.06, shadowRadius: 1 },
    android: { elevation: 1 },
    default: {},
  }),

  /** Level 01 — Pressed state (flatten) */
  cardPressed: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0 },
    android: { elevation: 0 },
    default: {},
  }),

  /** Level 02 — Hovered cards, raised inputs */
  cardHover: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 2 },
    android: { elevation: 2 },
    default: {},
  }),

  /** Level 03 — Dropdowns, popovers, floating action cards */
  raised: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 4 },
    android: { elevation: 4 },
    default: {},
  }),

  /** Level 04 — Floating panels, search bars, sticky headers */
  floating: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 8 },
    android: { elevation: 8 },
    default: {},
  }),

  /** Level 05 — Modals, dialogs, bottom sheets */
  modal: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.14, shadowRadius: 12 },
    android: { elevation: 12 },
    default: {},
  }),

  /** Level 06 — Top-level overlays, toasts */
  overlay: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 16 },
    android: { elevation: 16 },
    default: {},
  }),

  /** Inputs, search bars — Level 02 equivalent */
  input: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 2 },
    android: { elevation: 2 },
    default: {},
  }),

  /** Tab bar, sticky headers — Level 02 equivalent */
  sticky: Platform.select({
    ios: { shadowColor: SHADOW_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 2 },
    android: { elevation: 2 },
    default: {},
  }),
} as const

/** NativeWind shadow class equivalents */
export const shadowClasses = {
  card: 'shadow-sm',
  cardPressed: 'shadow-none',
  cardHover: 'shadow',
  raised: 'shadow-md',
  floating: 'shadow-lg',
  modal: 'shadow-xl',
  overlay: 'shadow-2xl',
  input: 'shadow-sm',
  sticky: 'shadow-sm',
} as const

export type ShadowLevel = keyof typeof shadowStyles
/** @deprecated Use ShadowLevel */
export type ShadowKey = ShadowLevel
