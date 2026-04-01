// SkyHub — Shadow Tokens
import { Platform } from 'react-native'

export const shadowClasses = {
  card: 'shadow-sm',
  cardPressed: 'shadow-none',
  floating: 'shadow-xl',
  sticky: 'shadow-sm',
  input: 'shadow-sm',
} as const

export const shadowStyles = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {},
  }),
  cardPressed: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: { elevation: 0 },
    default: {},
  }),
  floating: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  }),
  sticky: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  }),
  input: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
    },
    android: { elevation: 1 },
    default: {},
  }),
} as const

export type ShadowKey = keyof typeof shadowClasses
