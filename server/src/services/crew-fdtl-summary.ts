import { CrewAssignment } from '../models/CrewAssignment.js'
import { Pairing } from '../models/Pairing.js'

/**
 * Lightweight FDTL summary for the crew mobile app.
 *
 * NOT a legality validator — that lives in `packages/logic/src/fdtl/` and is
 * run on the Crew Ops side when committing assignments. The mobile crew
 * member sees an *informational* summary of their FDP usage and rolling
 * duty windows. CAAV VAR 15 limits are encoded as constants below; an
 * operator-specific override layer can be wired in Phase C if any
 * operator deviates from CAAV defaults.
 */

const FDP_DAILY_LIMIT_MINUTES = 13 * 60 // CAAV §15.025(b) acclimatised, 1-2 sectors floor
const DUTY_7D_LIMIT_MINUTES = 60 * 60 // CAAV rolling 7-day max duty
const DUTY_28D_LIMIT_MINUTES = 190 * 60 // CAAV rolling 28-day max duty (~190h)
const MIN_REST_MINUTES = 12 * 60 // CAAV minimum rest before next duty

const DAY_MS = 86_400_000

interface AssignmentLite {
  pairingId: string
  startUtcMs: number
  endUtcMs: number
}

export interface FdtlSummary {
  computedAtMs: number
  fdpUsedMinutes: number
  fdpLimitMinutes: number
  duty7DayMinutes: number
  duty7DayLimitMinutes: number
  duty28DayMinutes: number
  duty28DayLimitMinutes: number
  minRestMinutes: number
  restStartUtcMs: number | null
  restEndUtcMs: number | null
  nextReportUtcMs: number | null
}

export async function computeFdtlSummary(operatorId: string, crewId: string, atMs: number): Promise<FdtlSummary> {
  // Fetch assignments in a 30-day window around `at`
  const winFrom = new Date(atMs - 30 * DAY_MS).toISOString()
  const winTo = new Date(atMs + 7 * DAY_MS).toISOString()

  const assignments = await CrewAssignment.find({
    operatorId,
    crewId,
    scenarioId: null,
    status: { $ne: 'cancelled' },
    startUtcIso: { $lte: winTo },
    endUtcIso: { $gte: winFrom },
  })
    .lean()
    .sort({ startUtcIso: 1 })

  const lite: AssignmentLite[] = assignments
    .map((a) => ({
      pairingId: a.pairingId,
      startUtcMs: a.startUtcIso ? Date.parse(a.startUtcIso) : NaN,
      endUtcMs: a.endUtcIso ? Date.parse(a.endUtcIso) : NaN,
    }))
    .filter((a) => Number.isFinite(a.startUtcMs) && Number.isFinite(a.endUtcMs))

  // Today's FDP — duration of any assignment overlapping today's local-day
  // (we use UTC day for simplicity in Phase B; tz-aware day comes Phase C)
  const dayStart = atMs - (atMs % DAY_MS)
  const dayEnd = dayStart + DAY_MS
  const todays = lite.filter((a) => a.startUtcMs < dayEnd && a.endUtcMs > dayStart)
  const fdpUsedMinutes = todays.reduce(
    (sum, a) => sum + Math.max(0, Math.min(a.endUtcMs, dayEnd) - Math.max(a.startUtcMs, dayStart)) / 60_000,
    0,
  )

  // 7-day rolling duty
  const w7Start = atMs - 7 * DAY_MS
  const duty7DayMinutes = lite.reduce(
    (sum, a) => sum + Math.max(0, Math.min(a.endUtcMs, atMs) - Math.max(a.startUtcMs, w7Start)) / 60_000,
    0,
  )

  // 28-day rolling duty
  const w28Start = atMs - 28 * DAY_MS
  const duty28DayMinutes = lite.reduce(
    (sum, a) => sum + Math.max(0, Math.min(a.endUtcMs, atMs) - Math.max(a.startUtcMs, w28Start)) / 60_000,
    0,
  )

  // Rest start = end of most-recent ended assignment
  // Next report = report time of next-upcoming assignment's pairing
  const past = lite.filter((a) => a.endUtcMs <= atMs).sort((a, b) => b.endUtcMs - a.endUtcMs)
  const future = lite.filter((a) => a.startUtcMs > atMs).sort((a, b) => a.startUtcMs - b.startUtcMs)

  const restStartUtcMs = past[0]?.endUtcMs ?? null
  let nextReportUtcMs: number | null = null
  if (future[0]) {
    const nextPairing = await Pairing.findOne({ operatorId, _id: future[0].pairingId }, { reportTime: 1 }).lean()
    nextReportUtcMs = nextPairing?.reportTime ? Date.parse(nextPairing.reportTime) : future[0].startUtcMs
  }
  const restEndUtcMs = nextReportUtcMs ?? (restStartUtcMs ? restStartUtcMs + MIN_REST_MINUTES * 60_000 : null)

  return {
    computedAtMs: atMs,
    fdpUsedMinutes: Math.round(fdpUsedMinutes),
    fdpLimitMinutes: FDP_DAILY_LIMIT_MINUTES,
    duty7DayMinutes: Math.round(duty7DayMinutes),
    duty7DayLimitMinutes: DUTY_7D_LIMIT_MINUTES,
    duty28DayMinutes: Math.round(duty28DayMinutes),
    duty28DayLimitMinutes: DUTY_28D_LIMIT_MINUTES,
    minRestMinutes: MIN_REST_MINUTES,
    restStartUtcMs,
    restEndUtcMs,
    nextReportUtcMs,
  }
}
