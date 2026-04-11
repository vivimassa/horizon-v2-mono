import { ZOOM_CONFIG, type ZoomLevel, type TickMark } from './types'

/**
 * Pixels per hour for the given container width and zoom level.
 * The zoom level determines how many days fit in the viewport width.
 */
export function computePixelsPerHour(containerWidth: number, zoom: ZoomLevel): number {
  const { days } = ZOOM_CONFIG[zoom]
  const pph = containerWidth / (days * 24)
  return Math.max(pph, 0.3)
}

/**
 * Total canvas width in pixels for the full rendered period.
 */
export function computeTotalWidth(periodDays: number, pph: number): number {
  return periodDays * 24 * pph
}

/**
 * X position in pixels for a given UTC epoch timestamp.
 * startMs = epoch of the period start date (midnight UTC).
 */
export function utcToX(utcMs: number, startMs: number, pph: number): number {
  const diffHours = (utcMs - startMs) / 3_600_000
  return diffHours * pph
}

/**
 * Convert an X pixel position back to UTC epoch ms.
 */
export function xToUtc(x: number, startMs: number, pph: number): number {
  const diffHours = x / pph
  return startMs + diffHours * 3_600_000
}

/**
 * Generate tick marks for the time header.
 * Returns both day boundary ticks (major) and hour ticks (minor).
 */
export function computeTicks(startMs: number, periodDays: number, pph: number, zoom: ZoomLevel): TickMark[] {
  const { hoursPerTick } = ZOOM_CONFIG[zoom]
  const ticks: TickMark[] = []
  const totalHours = periodDays * 24

  // Auto-adjust tick spacing based on pixels-per-hour to avoid label overlap
  const effectiveTickHours = pph > 40 ? 1 : pph > 15 ? 2 : pph > 8 ? 6 : pph > 3 ? 12 : pph > 1 ? 24 : 168
  const tickH = Math.max(hoursPerTick, effectiveTickHours)

  for (let h = 0; h < totalHours; h += tickH) {
    const x = h * pph
    const tickMs = startMs + h * 3_600_000
    const d = new Date(tickMs)
    const hour = d.getUTCHours()
    const isMajor = hour === 0

    let label: string
    if (isMajor) {
      const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getUTCDay()]
      const day = String(d.getUTCDate()).padStart(2, '0')
      const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getUTCMonth()]
      // < 7D: "MON 13 APR", >= 7D: "13 APR"
      const { days } = ZOOM_CONFIG[zoom]
      label = days < 7 ? `${dow} ${day} ${mon}` : `${day} ${mon}`
    } else {
      label = String(hour).padStart(2, '0')
    }

    ticks.push({ x, label, isMajor, date: isMajor ? d.toISOString().slice(0, 10) : undefined })
  }

  return ticks
}

/**
 * X position of the now-line.
 * Returns null if current time is outside the visible period.
 */
export function computeNowLineX(startMs: number, periodDays: number, pph: number): number | null {
  const now = Date.now()
  const endMs = startMs + periodDays * 86_400_000
  if (now < startMs || now > endMs) return null
  return utcToX(now, startMs, pph)
}

/**
 * Parse a date string "2026-04-07" to UTC midnight epoch ms.
 */
export function dateToMs(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getTime()
}

/**
 * Format UTC epoch ms to "HH:MM" in UTC.
 */
export function formatUtcTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
