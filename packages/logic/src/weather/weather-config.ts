// logic/weather/weather-config.ts

// ─── NOAA Aviation Weather Center API ───
export const NOAA_AWC_API = 'https://aviationweather.gov/api/data'

// ─── CheckWX fallback API (free tier, needs API key) ───
export const CHECKWX_API = 'https://api.checkwx.com'

// ─── Polling config ───
export const WEATHER_POLL_INTERVAL_MIN = 15
export const METAR_RETENTION_HOURS = 72

// ─── Two-tier alert system ───
// WARN (red): requires action — hold, divert, delay decision
// CAUTION (orange): awareness — monitor TAF trend
// NONE: VFR, no visual indicator shown
export type WeatherAlertTier = 'warn' | 'caution' | 'none'

export function computeAlertTier(
  flightCategory: string,
  windSpeedKts: number | null,
  windGustKts: number | null,
  visibilityMeters: number | null,
  ceilingFeet: number | null,
  weatherPhenomena: string[]
): WeatherAlertTier {
  // ── WARN tier ──
  if (flightCategory === 'IFR' || flightCategory === 'LIFR') return 'warn'
  const warnWx = ['TS', 'TSRA', '+TSRA', 'FC', 'VA', 'FZRA', 'FZFG', 'SS']
  if (weatherPhenomena.some(w => warnWx.includes(w))) return 'warn'
  if (visibilityMeters != null && visibilityMeters < 1600) return 'warn'
  if (ceilingFeet != null && ceilingFeet < 500) return 'warn'
  if (windGustKts != null && windGustKts >= 35) return 'warn'

  // ── CAUTION tier ──
  if (flightCategory === 'MVFR') return 'caution'
  if (visibilityMeters != null && visibilityMeters < 5000) return 'caution'
  if (ceilingFeet != null && ceilingFeet < 1500) return 'caution'
  if (windSpeedKts != null && windSpeedKts >= 20) return 'caution'
  const cautionWx = ['-RA', 'BR', 'HZ', '-SN', 'BCFG']
  if (weatherPhenomena.some(w => cautionWx.includes(w))) return 'caution'

  return 'none'
}

// ─── Tier display config (for UI components) ───
export const ALERT_TIER_CONFIG = {
  warn: {
    label: 'WARN',
    dotColor: '#ef4444',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    description: 'Action required',
  },
  caution: {
    label: 'CAUTION',
    dotColor: '#f59e0b',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    description: 'Monitor trend',
  },
  none: {
    label: '',
    dotColor: 'transparent',
    bg: '',
    border: '',
    text: '',
    description: '',
  },
} as const

// ─── Flight category colors (standard aviation) ───
export const FLIGHT_CATEGORY_CONFIG = {
  VFR:  { label: 'VFR',  dot: '#22c55e', bg: 'bg-green-500/15',  border: 'border-green-500/25',  text: 'text-green-600 dark:text-green-400'  },
  MVFR: { label: 'MVFR', dot: '#3b82f6', bg: 'bg-blue-500/15',   border: 'border-blue-500/25',   text: 'text-blue-600 dark:text-blue-400'    },
  IFR:  { label: 'IFR',  dot: '#ef4444', bg: 'bg-red-500/15',    border: 'border-red-500/25',    text: 'text-red-600 dark:text-red-400'      },
  LIFR: { label: 'LIFR', dot: '#a855f7', bg: 'bg-purple-500/15', border: 'border-purple-500/25', text: 'text-purple-600 dark:text-purple-400' },
} as const

// ─── Weather phenomena significance ───
export const SIGNIFICANT_WEATHER = new Set([
  'TS', '+RA', 'TSRA', '+TSRA', 'FG', 'FZRA', 'FZFG', '+SN', 'SQ', 'FC', 'VA', 'SS',
])
