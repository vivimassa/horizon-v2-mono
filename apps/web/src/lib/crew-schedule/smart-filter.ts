import type { CrewActivityRef, CrewAssignmentRef, CrewMemberListItemRef, PairingRef } from '@skyhub/api'

export interface SmartFilterCriteria {
  hasRuleViolation: boolean
  hasExpiryAlert: boolean
  hasAnyDuty: boolean
  hasNoDuties: boolean
  activityCodeIds: string[]
  acTypes: string[]
  languages: string[]
  mode: 'show-only' | 'highlight' | 'exclude'
  combinator: 'any' | 'all'
}

export interface SmartFilterContext {
  assignments: CrewAssignmentRef[]
  activities: CrewActivityRef[]
  pairings: PairingRef[]
}

/** Returns true when any criterion slot is enabled — drives "active"
 *  badge on the toolbar button and whether we bother to filter. */
export function isSmartFilterActive(sf: SmartFilterCriteria): boolean {
  return (
    sf.hasRuleViolation ||
    sf.hasExpiryAlert ||
    sf.hasAnyDuty ||
    sf.hasNoDuties ||
    sf.activityCodeIds.length > 0 ||
    sf.acTypes.length > 0 ||
    sf.languages.length > 0
  )
}

/** Returns true if the crew member matches the criteria per combinator.
 *  Each criterion is evaluated independently; the final decision is
 *  `some` vs `every` depending on `combinator`. */
export function matchesSmartFilter(
  crew: CrewMemberListItemRef,
  sf: SmartFilterCriteria,
  ctx: SmartFilterContext,
): boolean {
  const checks: boolean[] = []

  if (sf.hasRuleViolation) {
    const pairingIds = ctx.assignments.filter((a) => a.crewId === crew._id).map((a) => a.pairingId)
    const pairingIdSet = new Set(pairingIds)
    const hasV = ctx.pairings.some((p) => pairingIdSet.has(p._id) && p.fdtlStatus === 'violation')
    checks.push(hasV)
  }
  if (sf.hasExpiryAlert) {
    checks.push((crew.expiryAlertCount ?? 0) > 0)
  }
  if (sf.hasAnyDuty) {
    const any =
      ctx.assignments.some((a) => a.crewId === crew._id && a.status !== 'cancelled') ||
      ctx.activities.some((a) => a.crewId === crew._id)
    checks.push(any)
  }
  if (sf.hasNoDuties) {
    const none =
      !ctx.assignments.some((a) => a.crewId === crew._id && a.status !== 'cancelled') &&
      !ctx.activities.some((a) => a.crewId === crew._id)
    checks.push(none)
  }
  if (sf.activityCodeIds.length > 0) {
    const codeSet = new Set(sf.activityCodeIds)
    const hit = ctx.activities.some((a) => a.crewId === crew._id && codeSet.has(a.activityCodeId))
    checks.push(hit)
  }
  if (sf.acTypes.length > 0) {
    const wanted = new Set(sf.acTypes)
    const hit = (crew.acTypes ?? []).some((t) => wanted.has(t))
    checks.push(hit)
  }
  if (sf.languages.length > 0) {
    const wanted = new Set(sf.languages.map((l) => l.toLowerCase()))
    const hit = (crew.languages ?? []).some((l) => wanted.has(l.toLowerCase()))
    checks.push(hit)
  }

  if (checks.length === 0) return true // no criteria selected = everyone matches
  return sf.combinator === 'all' ? checks.every(Boolean) : checks.some(Boolean)
}
