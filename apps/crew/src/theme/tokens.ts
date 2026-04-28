/**
 * SkyHub Crew design tokens — ported from CrewDeck reference design.
 * Single source of truth for colors and typography. Primitives consume `t`
 * (the resolved palette for the current scheme).
 */

export type Scheme = 'light' | 'dark'

export interface Palette {
  page: string
  card: string
  hover: string
  text: string
  textSec: string
  textTer: string
  border: string
  cardBorder: string
  accent: string
  accentSoft: string
  status: {
    ontime: { bg: string; fg: string }
    delayed: { bg: string; fg: string }
    cancelled: { bg: string; fg: string }
    departed: { bg: string; fg: string }
    scheduled: { bg: string; fg: string }
  }
  duty: {
    flight: string
    standby: string
    rest: string
    training: string
    ground: string
  }
  overlay: string
}

export const HORIZON: Record<Scheme, Palette> = {
  light: {
    page: '#ffffff',
    card: '#f5f5f5',
    hover: '#ebebeb',
    text: '#111111',
    textSec: '#888888',
    textTer: '#aaaaaa',
    border: '#e8e8e8',
    cardBorder: '#e8e8e8',
    accent: '#1e40af',
    accentSoft: '#dbe3f7',
    status: {
      ontime: { bg: '#dcfce7', fg: '#166534' },
      delayed: { bg: '#fef3c7', fg: '#92400e' },
      cancelled: { bg: '#fee2e2', fg: '#991b1b' },
      departed: { bg: '#dbeafe', fg: '#1e40af' },
      scheduled: { bg: '#f5f5f5', fg: '#555555' },
    },
    duty: {
      flight: '#3b82f6',
      standby: '#f59e0b',
      rest: '#8b5cf6',
      training: '#22c55e',
      ground: '#64748b',
    },
    overlay: 'rgba(17,17,17,0.04)',
  },
  dark: {
    page: '#1a1a1a',
    card: '#252525',
    hover: '#303030',
    text: '#f0f0f0',
    textSec: '#777777',
    textTer: '#555555',
    border: 'rgba(255,255,255,0.10)',
    cardBorder: 'rgba(255,255,255,0.10)',
    accent: '#60a5fa',
    accentSoft: 'rgba(96,165,250,0.15)',
    status: {
      ontime: { bg: 'rgba(22,163,74,0.15)', fg: '#4ade80' },
      delayed: { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24' },
      cancelled: { bg: 'rgba(220,38,38,0.15)', fg: '#f87171' },
      departed: { bg: 'rgba(30,64,175,0.25)', fg: '#60a5fa' },
      scheduled: { bg: '#303030', fg: '#999999' },
    },
    duty: {
      flight: '#60a5fa',
      standby: '#fbbf24',
      rest: '#a78bfa',
      training: '#4ade80',
      ground: '#94a3b8',
    },
    overlay: 'rgba(255,255,255,0.04)',
  },
}

export const TYPE = {
  pageTitle: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.4 },
  section: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.3 },
  cardTitle: { fontSize: 14, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  hint: { fontSize: 14, fontWeight: '400' as const },
  field: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  caption: { fontSize: 13, fontWeight: '400' as const },
  badge: { fontSize: 12, fontWeight: '600' as const },
}

export type Theme = Palette
