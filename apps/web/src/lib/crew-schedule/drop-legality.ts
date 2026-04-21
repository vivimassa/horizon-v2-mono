import type { CrewAssignmentRef, CrewMemberListItemRef, CrewPositionRef, PairingRef } from '@skyhub/api'
import { isEligibleForSeat } from './seat-eligibility'

export type DropLegalityLevel = 'legal' | 'warning' | 'violation'

export interface DropLegalityResult {
  level: DropLegalityLevel
  /** Human-readable reason — shown in the drag tooltip. */
  reason: string
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
    return { level: 'violation', reason: `${crewPosCode} cannot cover ${seat.code}` }
  }

  // Already on the same pairing?
  const sameAssign = assignments.find(
    (a) => a.crewId === targetCrew._id && a.pairingId === pairing._id && a.status !== 'cancelled',
  )
  if (sameAssign) {
    return { level: 'violation', reason: 'Already on this pairing' }
  }

  // Overlap check — does the target crew have ANY non-cancelled assignment
  // whose window intersects this pairing's window?
  const pairingStart = new Date(pairing.reportTime ?? pairing.startDate + 'T00:00:00Z').getTime()
  const lastLeg = pairing.legs[pairing.legs.length - 1]
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
    return { level: 'violation', reason: `Overlaps ${code}` }
  }

  // Downrank? Eligible but non-exact match → warning so the planner sees
  // the crew is working above/below their rank.
  const crewPos = targetCrew.position ? positionsById.get(targetCrew.position) : null
  if (crewPos && crewPos._id !== seat._id) {
    return { level: 'warning', reason: `${crewPos.code} covering ${seat.code} (downrank)` }
  }

  return { level: 'legal', reason: 'Legal' }
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

  // Overlap?
  const pairingStart = new Date(pairing.reportTime ?? pairing.startDate + 'T00:00:00Z').getTime()
  const lastLeg = pairing.legs[pairing.legs.length - 1]
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

  if (exact) {
    return { level: 'legal', reason: `Assign ${pick.seat.code}`, pickedSeat }
  }
  const crewPos = crewPosId ? positionsById.get(crewPosId) : null
  return {
    level: 'warning',
    reason: `${crewPos?.code ?? '?'} covering ${pick.seat.code} (downrank)`,
    pickedSeat,
  }
}
