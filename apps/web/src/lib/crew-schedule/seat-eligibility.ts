import type { CrewMemberListItemRef, CrewPositionRef } from '@skyhub/api'

/**
 * Module 4.1.6 — strict seat eligibility with downrank.
 *
 * Rules (user spec 2026-04-21):
 *   1. category must match: cockpit cannot cover cabin, and vice versa.
 *   2. exact match (crew.position === seat) → eligible.
 *   3. downrank: higher-ranked crew may fill a lower-ranked seat only when
 *      their own position has `canDownrank = true`.
 *   4. Lower rank never covers higher rank.
 *
 * Convention: lower `rankOrder` = higher rank (Captain=1, FO=2, PU=3, CA=4).
 *
 * Server mirror: server/src/routes/crew-schedule.ts — keep in sync.
 */
export function isEligibleForSeat(
  crew: CrewMemberListItemRef,
  seat: CrewPositionRef,
  positionsById: Map<string, CrewPositionRef>,
): boolean {
  if (!crew.position) return false
  const crewPos = positionsById.get(crew.position)
  if (!crewPos) return false
  if (crewPos.category !== seat.category) return false
  if (crewPos._id === seat._id) return true
  if (crewPos.rankOrder < seat.rankOrder && crewPos.canDownrank) return true
  return false
}
