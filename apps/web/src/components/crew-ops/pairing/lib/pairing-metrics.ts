// Pure helpers for Pairing Details — kept free of React so they can be
// unit-tested and reused by the Inspector later if needed.

import type { Pairing, PairingFlight, PairingLegMeta } from '../types'
import type { SerializedRuleSetRef } from '@skyhub/api'

const DEFAULT_REPORT_MIN = 45
const DEFAULT_DEBRIEF_MIN = 30
const DEFAULT_REQUIRED_REST_MIN = 12 * 60

const NIGHT_WINDOW_START_MIN = 22 * 60
const NIGHT_WINDOW_END_MIN = 6 * 60 // wraps past midnight: 22:00 → 06:00 UTC

const MINUTES_PER_DAY = 24 * 60

/** Format minutes as "H:MM". Returns "—" when falsy/zero. */
export function minutesToHM(mins: number | null | undefined): string {
  if (!mins || !Number.isFinite(mins) || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

/** Format YYYY-MM-DD → DD/MM/YYYY. */
export function formatDMY(ymd: string): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/** Return UTC minutes-since-midnight for an ISO timestamp. */
function isoToMinutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** Overlap between [a0, a1) and [b0, b1) on a 0..1440 minute clock. */
function overlapMins(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/** Minutes of a single leg that fall in the UTC night window (22:00–06:00).
 *  Splits the block into same-day / next-day pieces and intersects each with
 *  the night window segments (22:00–24:00 today, 00:00–06:00 next day). */
export function computeNightMinutesForLeg(leg: PairingLegMeta): number {
  if (!leg.stdUtcIso || !leg.staUtcIso || !leg.blockMinutes) return 0
  const stdMin = isoToMinutesOfDay(leg.stdUtcIso)
  const duration = leg.blockMinutes
  const endMin = stdMin + duration

  let night = 0
  // Segment 1: same-day window 22:00–24:00
  night += overlapMins(stdMin, endMin, NIGHT_WINDOW_START_MIN, MINUTES_PER_DAY)
  // Segment 2: next-day window 00:00–06:00 (shift end into first-day coords)
  night += overlapMins(stdMin, endMin, MINUTES_PER_DAY, MINUTES_PER_DAY + NIGHT_WINDOW_END_MIN)
  // Segment 3: wrap-past-midnight — if we cross 24:00, the post-midnight hours
  // start from MINUTES_PER_DAY onward. Already captured above.
  return Math.min(night, duration)
}

/** Sum of night-window minutes across every leg of the pairing. */
export function computeNightHours(pairing: Pick<Pairing, 'legs'>): number {
  return pairing.legs.reduce((sum, l) => sum + computeNightMinutesForLeg(l), 0)
}

/** Deadhead hours — sum of blockMinutes for legs where isDeadhead === true. */
export function computeDhcHours(pairing: Pick<Pairing, 'legs' | 'deadheadFlightIds'>): number {
  const dh = new Set(pairing.deadheadFlightIds ?? [])
  return pairing.legs.reduce((sum, l) => {
    if (l.isDeadhead || dh.has(l.flightId)) return sum + (l.blockMinutes ?? 0)
    return sum
  }, 0)
}

/** TAFB (Time Away From Base) in minutes:
 *    (last-leg STA + debrief) − (first-leg STD − report)
 *  Uses report/debrief from the FDTL rule set if available, else defaults. */
export function computeTafb(pairing: Pick<Pairing, 'legs'>, ruleSet?: SerializedRuleSetRef | null): number {
  if (pairing.legs.length === 0) return 0
  const sorted = [...pairing.legs].sort((a, b) => a.legOrder - b.legOrder)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (!first.stdUtcIso || !last.staUtcIso) return 0

  const report = ruleSet?.defaultReportMinutes ?? DEFAULT_REPORT_MIN
  const debrief = ruleSet?.defaultDebriefMinutes ?? DEFAULT_DEBRIEF_MIN
  const reportTime = new Date(first.stdUtcIso).getTime() - report * 60000
  const debriefTime = new Date(last.staUtcIso).getTime() + debrief * 60000
  return Math.max(0, Math.round((debriefTime - reportTime) / 60000))
}

/** Efficiency = block / TAFB (matches AIMS formula). 0..1. */
export function computeEfficiency(blockMinutes: number, tafbMinutes: number): number {
  if (!tafbMinutes || !Number.isFinite(blockMinutes)) return 0
  return blockMinutes / tafbMinutes
}

/**
 * Required rest after the pairing.
 *
 * Operational rule (ported from V1 GCS DutyDetailDialog / DutyDaySummary):
 *   reqRest = clamp(dutyMinutes + 120, 10h, 12h)
 * i.e. at least 10 hours, capped at 12 hours, basis = duty + 2h. This matches
 * how CAAV-style regs scale rest with duty length.
 *
 * If a more specific operator rule is configured in the FDTL rule set (e.g.
 * FRMS-approved company minimum), that takes precedence.
 */
export function resolveRequiredRestMinutes(ruleSet?: SerializedRuleSetRef | null, dutyMinutes?: number): number {
  // 1. Prefer explicit operator rule from the FDTL rule set.
  if (ruleSet) {
    const rule = ruleSet.rules.find(
      (r) => r.code === 'REST_MIN_HOURS' || r.code === 'MIN_REST_AFTER_DUTY' || r.code === 'MIN_REST',
    )
    if (rule) {
      const v = rule.value.trim()
      const hhmm = v.match(/^(\d+):(\d{2})$/)
      if (hhmm) return parseInt(hhmm[1], 10) * 60 + parseInt(hhmm[2], 10)
      const n = parseFloat(v)
      if (Number.isFinite(n)) return rule.unit === 'minutes' ? Math.round(n) : Math.round(n * 60)
    }
  }
  // 2. Adaptive default: duty + 2h, clamped to [10h, 12h].
  if (Number.isFinite(dutyMinutes) && (dutyMinutes ?? 0) > 0) {
    return Math.min(Math.max((dutyMinutes as number) + 120, 600), 720)
  }
  // 3. Hard fallback.
  return DEFAULT_REQUIRED_REST_MIN
}

/** "Fri 05 Apr at 05:13" — next earliest duty after the pairing. */
export function formatNextPossibleDuty(
  pairing: Pick<Pairing, 'legs' | 'totalDutyMinutes'>,
  ruleSet?: SerializedRuleSetRef | null,
): string {
  if (pairing.legs.length === 0) return '—'
  const sorted = [...pairing.legs].sort((a, b) => a.legOrder - b.legOrder)
  const last = sorted[sorted.length - 1]
  if (!last.staUtcIso) return '—'
  const debrief = ruleSet?.defaultDebriefMinutes ?? DEFAULT_DEBRIEF_MIN
  const rest = resolveRequiredRestMinutes(ruleSet, pairing.totalDutyMinutes)
  const next = new Date(new Date(last.staUtcIso).getTime() + (debrief + rest) * 60000)
  const weekday = next.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  const day = String(next.getUTCDate()).padStart(2, '0')
  const month = next.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  const hh = String(next.getUTCHours()).padStart(2, '0')
  const mm = String(next.getUTCMinutes()).padStart(2, '0')
  return `${weekday} ${day} ${month} at ${hh}:${mm}`
}

/** Compact crew complement string: "1CP 1FO 1PU 5CA". Dashes when empty. */
export function formatCrewComplement(counts: Record<string, number> | null): string {
  if (!counts) return '—'
  // Stable order matching VJ / V1 convention: cockpit first, then cabin.
  const order = ['CP', 'FO', 'SO', 'CM', 'PU', 'SA', 'FA', 'CA', 'BA']
  const parts: string[] = []
  for (const k of order) {
    const n = counts[k]
    if (typeof n === 'number' && n > 0) parts.push(`${n}${k}`)
  }
  // Append any unknown positions the operator uses
  for (const k of Object.keys(counts)) {
    if (!order.includes(k) && counts[k] > 0) parts.push(`${counts[k]}${k}`)
  }
  return parts.length > 0 ? parts.join(' ') : '—'
}

/** Route ID — for 1-day pairings: the turnaround station (most distant from
 *  base in the chain). Multi-day: the primary overnight station. Falls back
 *  to the base airport. */
export function computeRouteId(pairing: Pick<Pairing, 'legs' | 'baseAirport' | 'pairingDays'>): string {
  if (pairing.legs.length === 0) return pairing.baseAirport || '—'
  const sorted = [...pairing.legs].sort((a, b) => a.legOrder - b.legOrder)

  // Find longest overnight gap — station where the crew layovers the longest.
  if (pairing.pairingDays > 1) {
    let bestGapMin = 0
    let overnightStation = ''
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const cur = sorted[i]
      const nxt = sorted[i + 1]
      if (!cur.staUtcIso || !nxt.stdUtcIso) continue
      if (cur.arrStation !== nxt.depStation) continue
      const gap = (new Date(nxt.stdUtcIso).getTime() - new Date(cur.staUtcIso).getTime()) / 60000
      if (gap > bestGapMin) {
        bestGapMin = gap
        overnightStation = cur.arrStation
      }
    }
    if (overnightStation) return overnightStation
  }

  // 1-day: turnaround = arrival of the outbound half. Midpoint of the chain.
  const mid = Math.floor(sorted.length / 2) - 1
  const mv = sorted[Math.max(0, mid)]
  const candidate = mv?.arrStation
  return candidate && candidate !== pairing.baseAirport ? candidate : pairing.baseAirport || '—'
}

/** Resolve each pairing leg to its full flight instance from the store pool. */
export function resolvePairingFlights(pairing: Pick<Pairing, 'legs'>, pool: PairingFlight[]): PairingFlight[] {
  return pairing.legs.map((l) => pool.find((f) => f.id === l.flightId)).filter((x): x is PairingFlight => !!x)
}

/**
 * Derive the actual operating date for each leg by chaining sequentially.
 *
 * Why this is needed: scheduled-flight data sometimes stores a leg's UTC
 * timestamps on the ROTATION ANCHOR DAY even when operationally that leg runs
 * on the next calendar day (e.g. SH100 departs 00:40 UTC but belongs to the
 * rotation that started 21:00 the previous day — the SSIM import keeps
 * `departureDayOffset = 1` and stores `stdUtcIso = anchor + "T00:40:00Z"`).
 *
 * The fix: walk the legs in order; if a leg's stored STD is earlier than the
 * previous leg's stored STA, shift it forward by whole 24-hour steps until it
 * sits after the previous STA. The shift is then applied to STA too so the
 * next iteration stays consistent.
 *
 * Returns one derived `YYYY-MM-DD` operating date per leg, in the same order.
 */
export function deriveOperatingDates(legs: PairingLegMeta[]): {
  dates: string[]
  stdIsoShifted: string[]
  staIsoShifted: string[]
} {
  const sorted = [...legs].sort((a, b) => a.legOrder - b.legOrder)
  const dates: string[] = new Array(sorted.length).fill('')
  const stdShifted: string[] = new Array(sorted.length).fill('')
  const staShifted: string[] = new Array(sorted.length).fill('')

  let prevEndMs = 0
  for (let i = 0; i < sorted.length; i += 1) {
    const leg = sorted[i]
    const storedStdMs = Date.parse(leg.stdUtcIso ?? '')
    const storedStaMs = Date.parse(leg.staUtcIso ?? '')
    if (!Number.isFinite(storedStdMs) || !Number.isFinite(storedStaMs)) {
      dates[i] = leg.flightDate ?? ''
      stdShifted[i] = leg.stdUtcIso ?? ''
      staShifted[i] = leg.staUtcIso ?? ''
      continue
    }
    let shiftDays = 0
    // 1. Push forward until this leg starts at-or-after the previous leg ends.
    while (i > 0 && storedStdMs + shiftDays * MS_PER_DAY < prevEndMs) {
      shiftDays += 1
    }
    const shiftMs = shiftDays * MS_PER_DAY
    const effStdMs = storedStdMs + shiftMs
    const effStaMs = storedStaMs + shiftMs
    dates[i] = new Date(effStdMs).toISOString().slice(0, 10)
    stdShifted[i] = new Date(effStdMs).toISOString()
    staShifted[i] = new Date(effStaMs).toISOString()
    prevEndMs = effStaMs
  }
  return { dates, stdIsoShifted: stdShifted, staIsoShifted: staShifted }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const PAIRING_METRICS_DEFAULTS = {
  reportMin: DEFAULT_REPORT_MIN,
  debriefMin: DEFAULT_DEBRIEF_MIN,
  requiredRestMin: DEFAULT_REQUIRED_REST_MIN,
}
