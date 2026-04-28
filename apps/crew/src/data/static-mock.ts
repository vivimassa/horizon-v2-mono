/**
 * DEMO data — clearly labelled stand-ins for stuff the crew sync envelope
 * doesn't yet expose. Every field surfaced from this file should be
 * accompanied by a small `DEMO` chip in the UI so the user knows it's
 * placeholder. Phase B replaces these with real server-computed values.
 */

export const FDTL_DEMO = {
  fdpUsed: 8.5,
  fdpLimit: 13,
  d7: 42,
  d7Limit: 60,
  d28: 78,
  d28Limit: 100,
  minRest: 12,
  restStart: '19:20L',
  restEnd: '07:20L+1',
  nextReport: '07:50L+1',
} as const

export const STATS_DEMO = {
  blockMonth: 68.5,
  dutyMonth: 142,
  sectors: 48,
  nights: 6,
  daysOff: 8,
  avgBlock: 3.2,
  weekly: [
    { w: 'W1', h: 16.2 },
    { w: 'W2', h: 18.5 },
    { w: 'W3', h: 14.8 },
    { w: 'W4', h: 19.0 },
  ],
} as const

export const REST_DEMO = {
  startLocal: '19:20L',
  endLocal: '07:20L+1',
  nextReportLocal: '07:50L+1',
  minHours: 12,
} as const
