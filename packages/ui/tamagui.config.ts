import { createTamagui, createTokens, createFont, createMedia } from 'tamagui'
import { shorthands } from '@tamagui/config/v3'

// ─── Fonts ─────────────────────────────────────────────────
const interFont = createFont({
  family: 'System',
  size: {
    1: 11,  // badge min
    2: 12,  // caption, field label
    3: 13,  // secondary, card title
    4: 14,  // body
    5: 15,  // section heading
    6: 18,  // stat
    7: 20,  // page title
    8: 24,
    9: 28,
    true: 14,
  },
  lineHeight: {
    1: 14,
    2: 16,
    3: 18,
    4: 20,
    5: 20,
    6: 24,
    7: 26,
    8: 30,
    9: 34,
    true: 20,
  },
  weight: {
    1: '400',
    2: '500',
    3: '600',
    4: '700',
    true: '400',
  },
  letterSpacing: {
    1: 0,
    2: -0.3,
    3: 0.5,
    true: 0,
  },
  face: {
    400: { normal: 'System' },
    500: { normal: 'System' },
    600: { normal: 'System' },
    700: { normal: 'System' },
  },
})

// ─── Tokens ────────────────────────────────────────────────
const tokens = createTokens({
  size: {
    0: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    true: 16,
  },
  space: {
    0: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    true: 16,
  },
  radius: {
    0: 0,
    badge: 6,
    input: 10,
    card: 12,
    pill: 20,
    full: 9999,
    true: 12,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
    true: 0,
  },
  color: {
    // ── Light palette ──
    lightBackground: '#ffffff',
    lightBackgroundSecondary: '#f5f5f5',
    lightBackgroundHover: '#ebebeb',
    lightText: '#111111',
    lightTextSecondary: '#888888',
    lightTextTertiary: '#aaaaaa',
    lightBorder: '#e8e8e8',
    lightBorderSecondary: '#d4d4d4',
    lightCard: '#f5f5f5',
    lightCardBorder: '#e8e8e8',
    lightTabBar: '#ffffff',
    lightTabBarBorder: '#e8e8e8',
    lightTabInactive: '#888888',

    // ── Dark palette ──
    darkBackground: '#1a1a1a',
    darkBackgroundSecondary: '#252525',
    darkBackgroundHover: '#303030',
    darkText: '#f0f0f0',
    darkTextSecondary: '#777777',
    darkTextTertiary: '#555555',
    darkBorder: 'rgba(255,255,255,0.10)',
    darkBorderSecondary: 'rgba(255,255,255,0.15)',
    darkCard: '#252525',
    darkCardBorder: 'rgba(255,255,255,0.10)',
    darkTabBar: '#1a1a1a',
    darkTabBarBorder: 'rgba(255,255,255,0.10)',
    darkTabInactive: '#777777',

    // ── Status colors ──
    statusOnTimeBg: '#dcfce7',
    statusOnTimeText: '#166534',
    statusOnTimeDarkBg: 'rgba(22,163,74,0.15)',
    statusOnTimeDarkText: '#4ade80',

    statusDelayedBg: '#fef3c7',
    statusDelayedText: '#92400e',
    statusDelayedDarkBg: 'rgba(245,158,11,0.15)',
    statusDelayedDarkText: '#fbbf24',

    statusCancelledBg: '#fee2e2',
    statusCancelledText: '#991b1b',
    statusCancelledDarkBg: 'rgba(220,38,38,0.15)',
    statusCancelledDarkText: '#f87171',

    statusDepartedBg: '#dbeafe',
    statusDepartedText: '#1e40af',
    statusDepartedDarkBg: 'rgba(30,64,175,0.15)',
    statusDepartedDarkText: '#60a5fa',

    statusDivertedBg: '#f3e8ff',
    statusDivertedText: '#6b21a8',
    statusDivertedDarkBg: 'rgba(124,58,237,0.15)',
    statusDivertedDarkText: '#a78bfa',

    statusScheduledBg: '#f5f5f5',
    statusScheduledText: '#555555',
    statusScheduledDarkBg: '#303030',
    statusScheduledDarkText: '#999999',

    // ── Accent ──
    accent: '#1e40af',
    accentLight: 'rgba(30,64,175,0.12)',

    // ── Utility ──
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
    destructive: '#ef4444',
  },
})

// ─── Themes ────────────────────────────────────────────────
const lightTheme = {
  background: tokens.color.lightBackground,
  backgroundHover: tokens.color.lightBackgroundHover,
  backgroundPress: tokens.color.lightBackgroundHover,
  backgroundFocus: tokens.color.lightBackgroundHover,
  backgroundSecondary: tokens.color.lightBackgroundSecondary,
  color: tokens.color.lightText,
  colorSecondary: tokens.color.lightTextSecondary,
  colorTertiary: tokens.color.lightTextTertiary,
  borderColor: tokens.color.lightBorder,
  borderColorSecondary: tokens.color.lightBorderSecondary,
  cardBackground: tokens.color.lightCard,
  cardBorderColor: tokens.color.lightCardBorder,
  tabBar: tokens.color.lightTabBar,
  tabBarBorder: tokens.color.lightTabBarBorder,
  tabInactive: tokens.color.lightTabInactive,
  accentColor: tokens.color.accent,
  accentBackground: tokens.color.accentLight,
}

const darkTheme = {
  background: tokens.color.darkBackground,
  backgroundHover: tokens.color.darkBackgroundHover,
  backgroundPress: tokens.color.darkBackgroundHover,
  backgroundFocus: tokens.color.darkBackgroundHover,
  backgroundSecondary: tokens.color.darkBackgroundSecondary,
  color: tokens.color.darkText,
  colorSecondary: tokens.color.darkTextSecondary,
  colorTertiary: tokens.color.darkTextTertiary,
  borderColor: tokens.color.darkBorder,
  borderColorSecondary: tokens.color.darkBorderSecondary,
  cardBackground: tokens.color.darkCard,
  cardBorderColor: tokens.color.darkCardBorder,
  tabBar: tokens.color.darkTabBar,
  tabBarBorder: tokens.color.darkTabBarBorder,
  tabInactive: tokens.color.darkTabInactive,
  accentColor: tokens.color.accent,
  accentBackground: tokens.color.accentLight,
}

// ─── Media queries (responsive web) ────────────────────────
const media = createMedia({
  sm: { maxWidth: 640 },
  md: { maxWidth: 768 },
  lg: { maxWidth: 1024 },
  xl: { maxWidth: 1280 },
  gtSm: { minWidth: 641 },
  gtMd: { minWidth: 769 },
  gtLg: { minWidth: 1025 },
  gtXl: { minWidth: 1281 },
  short: { maxHeight: 820 },
  tall: { minHeight: 821 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
})

// ─── Config ────────────────────────────────────────────────
export const tamaguiConfig = createTamagui({
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  fonts: {
    heading: interFont,
    body: interFont,
    mono: interFont,
  },
  media,
  shorthands,
  defaultFont: 'body',
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: true,
})

export default tamaguiConfig
export type HorizonConfig = typeof tamaguiConfig
export type HorizonTheme = typeof lightTheme

// Required for TypeScript to pick up custom tokens
declare module 'tamagui' {
  interface TamaguiCustomConfig extends HorizonConfig {}
}
