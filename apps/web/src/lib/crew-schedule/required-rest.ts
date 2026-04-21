import type { PairingRef } from '@skyhub/api'

export interface RestRules {
  /** Minimum rest when the pairing ends at the crew's home base (minutes). */
  homeBaseMinMinutes: number
  /** Minimum rest when the pairing ends away from home base (minutes). */
  awayMinMinutes: number
}

/**
 * Mandatory rest period that must follow a pairing, per CAAV-style rules:
 *
 *     rest = max(minHoursForBaseType, precedingDutyMinutes)
 *
 * The "match or exceed preceding duty" clause applies to both home-base
 * and away-base rest rules (CAAV VAR 15 §15.037 — MIN_REST_HOME_BASE_RULE
 * is `max(preceding_duty, 12h)`; the away-base rule mirrors that intent).
 *
 * Returns 0 when the FDTL scheme isn't loaded (rules both 0) — the UI
 * then renders no rest strip and the absence becomes an immediate,
 * unambiguous signal that the operator's FDTL data isn't wired in.
 */
export function computeRequiredRestMinutes(pairing: PairingRef, rules: RestRules): number {
  if (rules.homeBaseMinMinutes <= 0 && rules.awayMinMinutes <= 0) return 0
  // Home base iff the pairing's final leg lands at the pairing's base.
  const lastLeg = pairing.legs[pairing.legs.length - 1]
  const endsAtBase = !!lastLeg && !!pairing.baseAirport && lastLeg.arrStation === pairing.baseAirport
  const min = endsAtBase ? rules.homeBaseMinMinutes : rules.awayMinMinutes
  const duty = Math.max(0, pairing.totalDutyMinutes ?? 0)
  return Math.max(min, duty)
}
