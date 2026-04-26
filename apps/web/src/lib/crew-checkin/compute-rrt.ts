/**
 * Required Reporting Time (RRT) computation for 4.1.7.1.
 *
 *   Source of truth: pairing.reportTime when set explicitly by the
 *   roster planner. Otherwise fall back to firstLeg.stdUtcIso − 60min
 *   (matches server `computeAssignmentWindow` brief default).
 */
import type { PairingRef } from '@skyhub/api'

const DEFAULT_BRIEF_MINUTES = 60

export function computeRrtMs(pairing: PairingRef): number | null {
  if (pairing.reportTime) {
    const t = Date.parse(pairing.reportTime)
    if (Number.isFinite(t)) return t
  }
  const firstLeg = pairing.legs[0]
  if (!firstLeg?.stdUtcIso) return null
  const std = Date.parse(firstLeg.stdUtcIso)
  if (!Number.isFinite(std)) return null
  return std - DEFAULT_BRIEF_MINUTES * 60_000
}
