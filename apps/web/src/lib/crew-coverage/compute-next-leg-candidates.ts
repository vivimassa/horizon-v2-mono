import type { PairingFlight } from '@/components/crew-ops/pairing/types'
import type { GanttAircraftType } from '@/lib/gantt/types'

export interface NextLegCandidatesResult {
  /** Flight ids eligible to append after the current chain. */
  candidateIds: Set<string>
  /** Nearest (earliest-STD) candidate. null when none. */
  nearestFlightId: string | null
  /** Tail/registration hosting the nearest candidate — for pin-to-top. */
  nearestRegistration: string | null
}

interface Args {
  /** Build-mode chain in chronological order (must have at least 1 leg). */
  chain: PairingFlight[]
  /** Full flight pool to consider as candidates. */
  pool: PairingFlight[]
  /** ICAO → family map for compatibility check. */
  aircraftTypeFamilies: Record<string, string | null>
  /** AC types — for TAT min ground time lookup. */
  aircraftTypes: GanttAircraftType[]
  /** How many days ahead of chain's last STA to include. */
  daysAhead: number
  /** Maximum FDP in minutes for the chain's complement (e.g. 600 standard, 780 aug1, 900 aug2).
   *  Candidates that would push chain FDP past this limit are dropped. */
  fdpLimitMinutes: number
}

const DEFAULT_TAT_MIN = 30
const REPORT_MIN = 45
const DEBRIEF_MIN = 30
const NEW_DUTY_GAP_MIN = 10 * 60 // ≥10h gap between legs ⇒ rest ⇒ new duty day
const MS_PER_MIN = 60_000
const MS_PER_DAY = 86_400_000

function utcDayStartMs(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Compute legal next-leg candidates for a pairing build chain.
 * Rules: station continuity + family match + ≥ TAT ground gap + within N-day window.
 * Excludes deadhead (operating only) and flights already covered by another pairing.
 */
export function computeNextLegCandidates({
  chain,
  pool,
  aircraftTypeFamilies,
  aircraftTypes,
  daysAhead,
  fdpLimitMinutes,
}: Args): NextLegCandidatesResult {
  if (chain.length === 0) {
    return { candidateIds: new Set(), nearestFlightId: null, nearestRegistration: null }
  }
  const last = chain[chain.length - 1]
  const lastStaMs = Date.parse(last.staUtc)
  if (!Number.isFinite(lastStaMs)) {
    return { candidateIds: new Set(), nearestFlightId: null, nearestRegistration: null }
  }
  const lastFamily = aircraftTypeFamilies[last.aircraftType] ?? null
  const lastArr = last.arrivalAirport
  const chainIds = new Set(chain.map((f) => f.id))

  // Note: coverage by another pairing is NOT excluded here — AIMS-parity.
  // The planner sees the operationally-next leg even if currently bound to
  // another pairing; the backend handles conflicts on save.

  const tatMin = aircraftTypes.find((t) => t.icaoType === last.aircraftType)?.tatDefaultMinutes ?? DEFAULT_TAT_MIN
  const minStdMs = lastStaMs + tatMin * MS_PER_MIN

  // Days semantics (AIMS-parity): Days=1 = chain-last-leg calendar day only;
  // Days=2 = that day + next; up to Days=7. Compare by UTC calendar date.
  const lastDayStart = utcDayStartMs(lastStaMs)
  const maxDayEnd = lastDayStart + daysAhead * MS_PER_DAY - 1

  // FDP anchor for the CURRENT duty day: walk the chain backward; if any
  // intra-chain gap ≥ NEW_DUTY_GAP_MIN, the duty resets after that gap.
  let currentDutyStartMs = Date.parse(chain[0].stdUtc)
  for (let i = 1; i < chain.length; i += 1) {
    const prev = chain[i - 1]
    const cur = chain[i]
    const prevStaMs = Date.parse(prev.staUtc)
    const curStdMs = Date.parse(cur.stdUtc)
    if (!Number.isFinite(prevStaMs) || !Number.isFinite(curStdMs)) continue
    const gapMin = (curStdMs - prevStaMs) / MS_PER_MIN
    if (gapMin >= NEW_DUTY_GAP_MIN) currentDutyStartMs = curStdMs
  }
  const fdpAnchorMs = Number.isFinite(currentDutyStartMs) ? currentDutyStartMs - REPORT_MIN * MS_PER_MIN : null

  const hits: Array<{ id: string; reg: string | null; stdMs: number }> = []
  for (const f of pool) {
    if (chainIds.has(f.id)) continue
    if (f.departureAirport !== lastArr) continue
    const fam = aircraftTypeFamilies[f.aircraftType] ?? null
    if (lastFamily != null && fam != null && fam !== lastFamily) continue
    const stdMs = Date.parse(f.stdUtc)
    if (!Number.isFinite(stdMs)) continue
    if (stdMs < minStdMs) continue
    if (stdMs > maxDayEnd) continue

    // FDP pre-filter — when candidate continues the CURRENT duty (gap from
    // last-leg STA < rest threshold), its STA+debrief against the current
    // duty's anchor must fit inside the complement's max FDP. If the gap is
    // ≥ rest threshold, candidate starts a NEW duty day — skip the FDP check
    // (its own duty-day FDP just started).
    const gapFromLastMin = (stdMs - lastStaMs) / MS_PER_MIN
    if (gapFromLastMin < NEW_DUTY_GAP_MIN && fdpAnchorMs != null) {
      const candidateStaMs = stdMs + f.blockMinutes * MS_PER_MIN
      const fdpEndMs = candidateStaMs + DEBRIEF_MIN * MS_PER_MIN
      const fdpMin = (fdpEndMs - fdpAnchorMs) / MS_PER_MIN
      if (fdpMin > fdpLimitMinutes) continue
    }
    hits.push({ id: f.id, reg: f.tailNumber ?? null, stdMs })
  }
  hits.sort((a, b) => a.stdMs - b.stdMs)
  const nearest = hits[0] ?? null
  return {
    candidateIds: new Set(hits.map((h) => h.id)),
    nearestFlightId: nearest?.id ?? null,
    nearestRegistration: nearest?.reg ?? null,
  }
}
