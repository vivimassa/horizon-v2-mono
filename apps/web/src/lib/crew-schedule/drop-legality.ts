import type {
  ActivityCodeRef,
  CrewActivityRef,
  CrewAssignmentRef,
  CrewFlightBookingRef,
  CrewMemberListItemRef,
  CrewPositionRef,
  PairingRef,
} from '@skyhub/api'
import { isEligibleForSeat } from './seat-eligibility'
import { validateCrewAssignment, buildScheduleDuties, buildCandidateDuty } from '@skyhub/logic'

export type DropLegalityLevel = 'legal' | 'warning' | 'violation'

export interface DropLegalityResult {
  level: DropLegalityLevel
  /** Human-readable reason — shown in the drag tooltip. */
  reason: string
  /** Failing FDTL / rule checks at this drop target — drives the
   *  compact Legality Check mini-panel. Only populated when one or
   *  more rules fired; empty otherwise. */
  checks?: Array<{
    label: string
    actual: string
    limit: string
    status: 'warning' | 'violation'
  }>
  /** True when the violation is a FDTL rule violation (overridable by
   *  commander discretion). False / undefined = genuine hard block
   *  (seat eligibility, AC type, duplicate, overlap). Drop handler
   *  uses this to decide whether to block outright or route through
   *  override flow. */
  overridable?: boolean
}

export interface ComputeDropLegalityInput {
  targetCrew: CrewMemberListItemRef
  pairing: PairingRef
  seatPositionId: string
  /** Whether this drop would create a duplicate for the source crew
   *  (Copy flow) vs replacing the source's assignment (Move flow). In
   *  Move mode we allow the same crew (it's a no-op). */
  mode: 'move' | 'copy'
  sourceCrewId: string
  positionsById: Map<string, CrewPositionRef>
  /** All current assignments — used to detect overlaps on the target crew. */
  assignments: CrewAssignmentRef[]
  pairingsById: Map<string, PairingRef>
  /** Optional context for FDTL roster-level checks. When absent, the
   *  pre-FDP rest / cumulative duty / cumulative block / rest-after-aug
   *  checks simply don't run (never false positives). */
  activities?: CrewActivityRef[]
  /** Activity-code master data — needed for the FDTL validator to
   *  classify activities (annual leave, day off, training…) as duty vs
   *  rest. Without this, all activities default to rest. */
  activityCodes?: ActivityCodeRef[]
  /** Crew flight bookings — positioning legs add duty time to FDTL. */
  flightBookings?: CrewFlightBookingRef[]
  ruleSet?: unknown | null
}

/**
 * Client-side "would this drop be legal?" check that runs on every
 * mousemove during a drag. Three signals:
 *
 *   - **violation** (red)  — ineligible seat, target already on pairing,
 *                            or overlapping pairing already assigned.
 *   - **warning**   (orange) — eligible but would need downrank, or
 *                              FDTL would bind (currently stubbed).
 *   - **legal**     (green)  — all checks pass.
 *
 * Deliberately lightweight: full FDTL check happens on the server. This
 * is for immediate drag feedback so planners don't drop into impossible
 * slots.
 */
export function computeDropLegality(input: ComputeDropLegalityInput): DropLegalityResult {
  const { targetCrew, pairing, seatPositionId, mode, sourceCrewId, positionsById, assignments, pairingsById } = input

  // Self-drop in Move mode = no-op, technically legal.
  if (mode === 'move' && targetCrew._id === sourceCrewId) {
    return { level: 'legal', reason: 'Same crew — no change' }
  }
  // Self-drop in Copy mode = would create a duplicate for the same crew.
  if (mode === 'copy' && targetCrew._id === sourceCrewId) {
    return { level: 'violation', reason: 'Source and target crew are the same' }
  }

  const seat = positionsById.get(seatPositionId)
  if (!seat) return { level: 'violation', reason: 'Unknown seat position' }

  if (!isEligibleForSeat(targetCrew, seat, positionsById)) {
    const crewPos = targetCrew.position ? positionsById.get(targetCrew.position) : null
    const crewPosCode = crewPos?.code ?? '?'
    return {
      level: 'violation',
      reason: `${crewPosCode} cannot cover ${seat.code}`,
      checks: [{ label: 'Seat eligibility', actual: crewPosCode, limit: seat.code, status: 'violation' }],
    }
  }

  // Already on the same pairing?
  const sameAssign = assignments.find(
    (a) => a.crewId === targetCrew._id && a.pairingId === pairing._id && a.status !== 'cancelled',
  )
  if (sameAssign) {
    return {
      level: 'violation',
      reason: 'Already on this pairing',
      checks: [{ label: 'Duplicate pairing', actual: '1', limit: '0', status: 'violation' }],
    }
  }

  // Overlap check — does the target crew have ANY non-cancelled assignment
  // whose window intersects this pairing's window? Window is derived from
  // first leg STD (minus 60-min brief fallback if reportTime null) to last
  // leg STA + 30-min debrief. Using `startDate + T00:00:00Z` as a fallback
  // was wrong — it pulled the window back to midnight UTC and flagged
  // overlaps that don't exist.
  const firstLeg = pairing.legs[0]
  const lastLeg = pairing.legs[pairing.legs.length - 1]
  const pairingStart = pairing.reportTime
    ? new Date(pairing.reportTime).getTime()
    : firstLeg
      ? new Date(firstLeg.stdUtcIso).getTime() - 60 * 60_000
      : new Date(pairing.startDate + 'T00:00:00Z').getTime()
  const pairingEnd = lastLeg
    ? new Date(lastLeg.staUtcIso).getTime() + 30 * 60_000
    : new Date(pairing.endDate + 'T23:59:00Z').getTime()

  for (const a of assignments) {
    if (a.crewId !== targetCrew._id) continue
    if (a.status === 'cancelled') continue
    const aStart = new Date(a.startUtcIso).getTime()
    const aEnd = new Date(a.endUtcIso).getTime()
    if (aEnd <= pairingStart || aStart >= pairingEnd) continue
    const other = pairingsById.get(a.pairingId)
    const code = other?.pairingCode ?? a.pairingId.slice(0, 6)
    return {
      level: 'violation',
      reason: `Overlaps ${code}`,
      checks: [{ label: 'Time overlap', actual: code, limit: 'no overlap', status: 'violation' }],
    }
  }

  // FDTL roster-level checks (rest before, rest after augmented, cumulative
  // duty/block/FDP). Skipped silently when ruleSet missing.
  const fdtl = runFdtlChecks({
    targetCrew: input.targetCrew,
    pairing: input.pairing,
    assignments: input.assignments,
    activities: input.activities,
    activityCodes: input.activityCodes,
    pairingsById: input.pairingsById,
    flightBookings: input.flightBookings,
    ruleSet: input.ruleSet ?? null,
  })
  if (fdtl && fdtl.level === 'violation') {
    return { level: 'violation', reason: fdtl.reason, checks: fdtl.checks, overridable: true }
  }

  // Downrank? Eligible but non-exact match → warning so the planner sees
  // the crew is working above/below their rank.
  const crewPos = targetCrew.position ? positionsById.get(targetCrew.position) : null
  if (crewPos && crewPos._id !== seat._id) {
    return { level: 'warning', reason: `${crewPos.code} covering ${seat.code} (downrank)` }
  }

  if (fdtl && fdtl.level === 'warning') {
    return { level: 'warning', reason: fdtl.reason, checks: fdtl.checks }
  }

  return { level: 'legal', reason: 'Legal' }
}

// ── FDTL roster-level helper ──────────────────────────────────────────────────

interface FdtlCheckInput {
  targetCrew: CrewMemberListItemRef
  pairing: PairingRef
  assignments: CrewAssignmentRef[]
  activities?: CrewActivityRef[]
  activityCodes?: ActivityCodeRef[]
  pairingsById: Map<string, PairingRef>
  flightBookings?: CrewFlightBookingRef[]
  ruleSet: unknown | null
}

function runFdtlChecks(
  input: FdtlCheckInput,
): { level: DropLegalityLevel; reason: string; checks: DropLegalityResult['checks'] } | null {
  if (!input.ruleSet) return null
  const activityCodesById = input.activityCodes
    ? new Map(input.activityCodes.map((c) => [c._id, { flags: c.flags ?? [] }]))
    : undefined
  const existing = buildScheduleDuties({
    crewId: input.targetCrew._id,
    assignments: input.assignments,
    activities: input.activities ?? [],
    pairingsById: input.pairingsById,
    activityCodesById,
    bookings: input.flightBookings,
  })
  const candidate = buildCandidateDuty(input.pairing)
  if (!candidate) return null
  const homeBase = (input.targetCrew.baseLabel ?? '').toUpperCase()
  const result = validateCrewAssignment({
    candidate,
    existing,
    homeBase,
    ruleSet: input.ruleSet as Parameters<typeof validateCrewAssignment>[0]['ruleSet'],
  })
  if (result.overall === 'pass') return null
  const level: DropLegalityLevel = result.overall === 'violation' ? 'violation' : 'warning'
  const checks = result.checks
    .filter((c) => c.status === 'warning' || c.status === 'violation')
    .map((c) => ({
      label: c.label,
      actual: c.actual,
      limit: c.limit,
      status: c.status as 'warning' | 'violation',
    }))
  return { level, reason: result.headline ?? 'FDTL check', checks }
}

// ── Assign-from-Uncrewed drop ───────────────────────────────────────────

export interface MissingSeatRef {
  seatPositionId: string
  seatCode: string
  count: number
}

export interface ComputeAssignFromUncrewedInput {
  targetCrew: CrewMemberListItemRef
  pairing: PairingRef
  missingSeats: MissingSeatRef[]
  positionsById: Map<string, CrewPositionRef>
  assignments: CrewAssignmentRef[]
  pairingsById: Map<string, PairingRef>
  activities?: CrewActivityRef[]
  activityCodes?: ActivityCodeRef[]
  flightBookings?: CrewFlightBookingRef[]
  ruleSet?: unknown | null
}

export interface AssignFromUncrewedResult extends DropLegalityResult {
  /** The seat the dropper would fill. Only set when level !== 'violation'. */
  pickedSeat: {
    seatPositionId: string
    seatCode: string
    seatIndex: number
  } | null
}

/**
 * Drop-legality for dragging an uncrewed pairing onto a crew row.
 *
 * Algorithm:
 *   1. Double-book on same pairing → violation
 *   2. Overlap with another assignment → violation
 *   3. No eligible missing seat → violation
 *   4. Prefer exact position match; else highest-rankOrder eligible seat
 *      (most conservative downrank)
 *   5. Exact match → legal; downrank → warning
 */
export function computeAssignFromUncrewedLegality(input: ComputeAssignFromUncrewedInput): AssignFromUncrewedResult {
  const { targetCrew, pairing, missingSeats, positionsById, assignments, pairingsById } = input

  // Already on this pairing?
  const sameAssign = assignments.find(
    (a) => a.crewId === targetCrew._id && a.pairingId === pairing._id && a.status !== 'cancelled',
  )
  if (sameAssign) {
    return { level: 'violation', reason: 'Already on this pairing', pickedSeat: null }
  }

  // Overlap? Window: first leg STD - 60min brief fallback → last leg STA
  // + 30min debrief. Avoid midnight-UTC fallback (false positives).
  const firstLeg = pairing.legs[0]
  const lastLeg = pairing.legs[pairing.legs.length - 1]
  const pairingStart = pairing.reportTime
    ? new Date(pairing.reportTime).getTime()
    : firstLeg
      ? new Date(firstLeg.stdUtcIso).getTime() - 60 * 60_000
      : new Date(pairing.startDate + 'T00:00:00Z').getTime()
  const pairingEnd = lastLeg
    ? new Date(lastLeg.staUtcIso).getTime() + 30 * 60_000
    : new Date(pairing.endDate + 'T23:59:00Z').getTime()
  for (const a of assignments) {
    if (a.crewId !== targetCrew._id) continue
    if (a.status === 'cancelled') continue
    const aStart = new Date(a.startUtcIso).getTime()
    const aEnd = new Date(a.endUtcIso).getTime()
    if (aEnd <= pairingStart || aStart >= pairingEnd) continue
    const other = pairingsById.get(a.pairingId)
    const code = other?.pairingCode ?? a.pairingId.slice(0, 6)
    return { level: 'violation', reason: `Overlaps ${code}`, pickedSeat: null }
  }

  // Find all eligible seats from the missing list.
  const eligible: Array<{ seat: CrewPositionRef; missing: MissingSeatRef }> = []
  for (const m of missingSeats) {
    const seat = positionsById.get(m.seatPositionId)
    if (!seat) continue
    if (isEligibleForSeat(targetCrew, seat, positionsById)) {
      eligible.push({ seat, missing: m })
    }
  }
  if (eligible.length === 0) {
    const crewPos = targetCrew.position ? positionsById.get(targetCrew.position) : null
    const crewPosCode = crewPos?.code ?? '?'
    return { level: 'violation', reason: `No eligible seat for ${crewPosCode}`, pickedSeat: null }
  }

  // Prefer exact match on the crew's own position.
  const crewPosId = targetCrew.position
  const exact = eligible.find((e) => e.seat._id === crewPosId)
  // Otherwise pick the highest-rankOrder (lowest rank) eligible seat —
  // most conservative downrank fill.
  const pick = exact ?? eligible.slice().sort((a, b) => b.seat.rankOrder - a.seat.rankOrder)[0]

  // seatIndex = count of existing non-cancelled assignments for this
  // pairing+seat; the drop fills the first free slot.
  let seatIndex = 0
  for (const a of assignments) {
    if (a.pairingId !== pairing._id) continue
    if (a.seatPositionId !== pick.seat._id) continue
    if (a.status === 'cancelled') continue
    seatIndex += 1
  }

  const pickedSeat = {
    seatPositionId: pick.seat._id,
    seatCode: pick.seat.code,
    seatIndex,
  }

  // FDTL roster checks.
  const fdtl = runFdtlChecks({
    targetCrew: input.targetCrew,
    pairing: input.pairing,
    assignments: input.assignments,
    activities: input.activities,
    activityCodes: input.activityCodes,
    pairingsById: input.pairingsById,
    flightBookings: input.flightBookings,
    ruleSet: input.ruleSet ?? null,
  })
  if (fdtl && fdtl.level === 'violation') {
    return { level: 'violation', reason: fdtl.reason, checks: fdtl.checks, pickedSeat: null, overridable: true }
  }

  if (exact) {
    if (fdtl && fdtl.level === 'warning') {
      return { level: 'warning', reason: fdtl.reason, checks: fdtl.checks, pickedSeat }
    }
    return { level: 'legal', reason: `Assign ${pick.seat.code}`, pickedSeat }
  }
  const crewPos = crewPosId ? positionsById.get(crewPosId) : null
  return {
    level: 'warning',
    reason:
      fdtl && fdtl.level === 'warning' ? fdtl.reason : `${crewPos?.code ?? '?'} covering ${pick.seat.code} (downrank)`,
    checks: fdtl?.checks,
    pickedSeat,
  }
}
