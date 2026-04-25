/**
 * 4.1.6.3 Scheduling Configurations — soft-rule evaluator.
 *
 * Pure function. No React, no DB. Takes crew assignments + scheduling config,
 * returns a list of soft-rule violations. These are amber warnings — never
 * hard blocks. FDTL violations (red) are handled separately by the FDTL engine.
 */

export interface SoftRuleAssignment {
  pairingId: string
  startUtcIso: string
  endUtcIso: string
}

export interface SoftRulePairing {
  layoverStations: string[] // overnight airport ICAO codes for this pairing (one per layover night)
  layoverCountryCodes: string[] // ISO-2 country codes for each layover station
}

export type SoftRuleType =
  | 'maxDaysOff'
  | 'maxConsecutiveDuty'
  | 'morningRotation'
  | 'afternoonRotation'
  | 'destinationLayover'
  | 'destinationSeparation'

export interface SoftRuleViolation {
  rule: SoftRuleType
  severity: 'warning'
  message: string
  affectedDates: string[]
}

export interface SoftRulesConfig {
  daysOff: {
    maxPerPeriodDays: number
    maxConsecutiveDutyDays: number
    maxConsecutiveMorningDuties: number
    maxConsecutiveAfternoonDuties: number
  }
  destinationRules: Array<{
    scope: 'airport' | 'country'
    codes: string[]
    maxLayoversPerPeriod: number | null
    minSeparationDays: number | null
    enabled: boolean
  }>
}

/**
 * Check operator soft rules for a single crew member's assignments in a period.
 *
 * @param assignments - Assignments for this crew in the period (non-cancelled)
 * @param pairingsById - Pairing metadata keyed by pairingId (for destination checks)
 * @param config - Operator scheduling soft-rule config
 * @param periodFromIso - Period start date (YYYY-MM-DD)
 * @param periodToIso - Period end date inclusive (YYYY-MM-DD)
 * @param utcOffsetHours - Operator local UTC offset (e.g. 7 for UTC+7) for AM/PM classification
 */
export function checkSoftRules(
  assignments: SoftRuleAssignment[],
  pairingsById: Map<string, SoftRulePairing>,
  config: SoftRulesConfig,
  periodFromIso: string,
  periodToIso: string,
  utcOffsetHours: number,
): SoftRuleViolation[] {
  const violations: SoftRuleViolation[] = []

  const periodDates = buildDateRange(periodFromIso, periodToIso)

  // Build a set of dates (YYYY-MM-DD) on which this crew has a duty starting
  const dutyDateSet = new Set<string>()
  for (const a of assignments) {
    const dateStr = a.startUtcIso.slice(0, 10)
    dutyDateSet.add(dateStr)
  }

  // ── 1. Max days off in period — REMOVED ───────────────────────────────
  // maxPerPeriodDays is a solver target, not a GCS legality rule. Empty
  // rosters (pre-assignment) would flag every crew as "30 days off > 10".
  // Still used by the auto-roster day-off runner as an assignment cap.

  // ── 2. Max consecutive duty days ─────────────────────────────────────────
  const consecutiveDutyRuns = findConsecutiveRuns(periodDates, (d) => dutyDateSet.has(d))
  for (const run of consecutiveDutyRuns) {
    if (run.length > config.daysOff.maxConsecutiveDutyDays) {
      violations.push({
        rule: 'maxConsecutiveDuty',
        severity: 'warning',
        message: `${run.length} consecutive duty days exceeds max of ${config.daysOff.maxConsecutiveDutyDays}`,
        affectedDates: run.slice(config.daysOff.maxConsecutiveDutyDays),
      })
    }
  }

  // ── 3. Morning / afternoon rotation ──────────────────────────────────────
  // Classify each duty date as morning (local hour < 12), afternoon (12–18), or other
  const dutyByDate = new Map<string, 'morning' | 'afternoon' | 'other'>()
  for (const a of assignments) {
    const dateStr = a.startUtcIso.slice(0, 10)
    if (dutyByDate.has(dateStr)) continue // first assignment wins for that date
    const localHour = utcHourToLocal(a.startUtcIso, utcOffsetHours)
    if (localHour < 12) dutyByDate.set(dateStr, 'morning')
    else if (localHour < 18) dutyByDate.set(dateStr, 'afternoon')
    else dutyByDate.set(dateStr, 'other')
  }

  const morningRuns = findConsecutiveRuns(periodDates, (d) => dutyByDate.get(d) === 'morning')
  for (const run of morningRuns) {
    if (run.length > config.daysOff.maxConsecutiveMorningDuties) {
      violations.push({
        rule: 'morningRotation',
        severity: 'warning',
        message: `${run.length} consecutive morning duties exceeds max of ${config.daysOff.maxConsecutiveMorningDuties}`,
        affectedDates: run.slice(config.daysOff.maxConsecutiveMorningDuties),
      })
    }
  }

  const afternoonRuns = findConsecutiveRuns(periodDates, (d) => dutyByDate.get(d) === 'afternoon')
  for (const run of afternoonRuns) {
    if (run.length > config.daysOff.maxConsecutiveAfternoonDuties) {
      violations.push({
        rule: 'afternoonRotation',
        severity: 'warning',
        message: `${run.length} consecutive afternoon duties exceeds max of ${config.daysOff.maxConsecutiveAfternoonDuties}`,
        affectedDates: run.slice(config.daysOff.maxConsecutiveAfternoonDuties),
      })
    }
  }

  // ── 4 & 5. Destination rules ─────────────────────────────────────────────
  const enabledDestRules = config.destinationRules.filter((r) => r.enabled)
  if (enabledDestRules.length > 0) {
    // Build per-assignment layover info
    const assignmentLayovers: Array<{ startDate: string; stations: string[]; countries: string[] }> = []
    for (const a of assignments) {
      const pairing = pairingsById.get(a.pairingId)
      if (!pairing) continue
      assignmentLayovers.push({
        startDate: a.startUtcIso.slice(0, 10),
        stations: pairing.layoverStations,
        countries: pairing.layoverCountryCodes,
      })
    }

    for (const rule of enabledDestRules) {
      const codeSet = new Set(rule.codes)
      const matchingAssignments = assignmentLayovers.filter((al) => {
        const haystack = rule.scope === 'airport' ? al.stations : al.countries
        return haystack.some((c) => codeSet.has(c))
      })
      const codeLabel = rule.codes.join(', ')

      // Max layovers per period
      if (rule.maxLayoversPerPeriod !== null && matchingAssignments.length > rule.maxLayoversPerPeriod) {
        violations.push({
          rule: 'destinationLayover',
          severity: 'warning',
          message: `${matchingAssignments.length} layovers at ${codeLabel} exceeds max of ${rule.maxLayoversPerPeriod}`,
          affectedDates: matchingAssignments.slice(rule.maxLayoversPerPeriod).map((a) => a.startDate),
        })
      }

      // Min separation between visits
      if (rule.minSeparationDays !== null && rule.minSeparationDays > 0) {
        const visitDates = matchingAssignments.map((a) => a.startDate).sort()
        for (let i = 1; i < visitDates.length; i++) {
          const gap = daysBetween(visitDates[i - 1], visitDates[i])
          if (gap < rule.minSeparationDays) {
            violations.push({
              rule: 'destinationSeparation',
              severity: 'warning',
              message: `Only ${gap}d gap between ${codeLabel} duties (min ${rule.minSeparationDays}d)`,
              affectedDates: [visitDates[i]],
            })
          }
        }
      }
    }
  }

  return violations
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDateRange(fromIso: string, toIso: string): string[] {
  const dates: string[] = []
  const cur = new Date(`${fromIso}T00:00:00Z`)
  const end = new Date(`${toIso}T00:00:00Z`)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

function findConsecutiveRuns(dates: string[], predicate: (d: string) => boolean): string[][] {
  const runs: string[][] = []
  let current: string[] = []
  for (const d of dates) {
    if (predicate(d)) {
      current.push(d)
    } else {
      if (current.length > 0) {
        runs.push(current)
        current = []
      }
    }
  }
  if (current.length > 0) runs.push(current)
  return runs
}

function utcHourToLocal(utcIso: string, offsetHours: number): number {
  const utcHour = parseInt(utcIso.slice(11, 13), 10)
  return (((utcHour + Math.round(offsetHours)) % 24) + 24) % 24
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(`${isoA}T00:00:00Z`).getTime()
  const b = new Date(`${isoB}T00:00:00Z`).getTime()
  return Math.round(Math.abs(b - a) / 86_400_000)
}
