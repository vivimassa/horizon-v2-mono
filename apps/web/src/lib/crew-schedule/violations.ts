import type {
  ActivityCodeRef,
  CrewActivityRef,
  CrewAssignmentRef,
  CrewFlightBookingRef,
  CrewMemberListItemRef,
  PairingRef,
} from '@skyhub/api'
import { validateCrewAssignment, buildScheduleDuties, buildCandidateDuty } from '@skyhub/logic'

/**
 * Rule violations checked *at assignment time* — the drag-drop drop
 * handler calls these before firing `POST /assignments`.
 *
 * Two severities:
 *   • `override` — planner can acknowledge and proceed; the override is
 *     persisted as an audit row (feeds Schedule Legality Check).
 *   • `hard_block` — never overridable; dialog has a single "OK" and
 *     aborts the assignment. No API call.
 *
 * Kinds so far:
 *   • `base_mismatch` (override) — crew.base !== pairing.baseAirport
 *   • `ac_type_not_qualified` (hard_block) — crew not rated for the
 *     pairing's aircraft type (and not covered by a same-family rating
 *     with `acFamilyQualified=true`).
 */
export type ViolationSeverity = 'override' | 'hard_block'

export interface AssignmentViolation {
  kind: string
  severity: ViolationSeverity
  title: string
  message: string
  detail: Record<string, unknown>
}

export interface CheckViolationsInput {
  crew: CrewMemberListItemRef
  pairing: PairingRef
  aircraftTypes?: Array<{ icaoType: string; family: string | null }>
  /** Temp-base assignments for THIS crew. When the pairing's date falls
   *  inside one whose `airportCode` matches the pairing base, the
   *  `base_mismatch` rule is suppressed. */
  tempBases?: Array<{ fromIso: string; toIso: string; airportCode: string }>
  /** Optional FDTL context — enables rest / cumulative checks as
   *  override-level violations (planner can ack). When absent, FDTL
   *  checks don't run. */
  assignments?: CrewAssignmentRef[]
  activities?: CrewActivityRef[]
  /** Activity-code master data — required for the FDTL validator to
   *  classify each activity as duty vs rest. Without this, all activities
   *  are conservatively treated as rest. */
  activityCodes?: ActivityCodeRef[]
  pairings?: PairingRef[]
  /** Crew flight bookings — positioning legs add duty time to the FDTL
   *  evaluator. Null/empty means the validator runs without them. */
  flightBookings?: CrewFlightBookingRef[]
  ruleSet?: unknown | null
}

export function checkAssignmentViolations({
  crew,
  pairing,
  aircraftTypes,
  tempBases,
  assignments,
  activities,
  activityCodes,
  pairings,
  flightBookings,
  ruleSet,
}: CheckViolationsInput): AssignmentViolation[] {
  const list: AssignmentViolation[] = []

  // AC type qualification (hard block). If the pairing has an aircraft
  // type, the crew must either be rated on that exact ICAO, or rated on
  // another type in the same AC FAMILY with `acFamilyQualified=true`.
  const pairingIcao = (pairing.aircraftTypeIcao ?? '').trim()
  if (pairingIcao) {
    const quals = crew.qualifications ?? []
    const exact = quals.some((q) => q.aircraftType === pairingIcao)
    if (!exact) {
      const familyByIcao = new Map((aircraftTypes ?? []).map((t) => [t.icaoType, t.family ?? null]))
      const pairingFamily = familyByIcao.get(pairingIcao) ?? null
      const familyOk =
        !!pairingFamily &&
        quals.some((q) => q.acFamilyQualified && (familyByIcao.get(q.aircraftType) ?? null) === pairingFamily)
      if (!familyOk) {
        list.push({
          kind: 'ac_type_not_qualified',
          severity: 'hard_block',
          title: 'Crew not qualified on AC Type',
          message: `Crew member is not qualified to operate ${pairingIcao}.`,
          detail: {
            crewId: crew._id,
            pairingId: pairing._id,
            pairingAircraftType: pairingIcao,
            crewAcTypes: quals.map((q) => q.aircraftType),
          },
        })
      }
    }
  }

  // Base mismatch (override). Compare the crew's *effective* base for
  // the pairing date against the pairing's base. The effective base is
  // the temp-base airport when the pairing date falls inside one, else
  // the crew's master-data base label. Both IATA codes. Null-safe.
  const homeBase = (crew.baseLabel ?? '').trim()
  const pairingBase = (pairing.baseAirport ?? '').trim()
  const pairingDayIso = pairing.startDate ? pairing.startDate.slice(0, 10) : null
  const activeTempBase = pairingDayIso
    ? (tempBases ?? []).find((t) => t.fromIso <= pairingDayIso && t.toIso >= pairingDayIso)
    : undefined
  const effectiveBase = activeTempBase ? activeTempBase.airportCode.trim().toUpperCase() : homeBase
  if (effectiveBase && pairingBase && effectiveBase.toUpperCase() !== pairingBase.toUpperCase()) {
    const crewBaseLabel = activeTempBase ? `${effectiveBase} (temp base)` : effectiveBase
    list.push({
      kind: 'base_mismatch',
      severity: 'override',
      title: 'Invalid Duty Assignment due to Base Mismatch',
      message: `Duty assigned is in ${pairingBase}, Crew member base is in ${crewBaseLabel}.`,
      detail: {
        crewBase: effectiveBase,
        homeBase,
        pairingBase,
        tempBase: activeTempBase?.airportCode ?? null,
        crewId: crew._id,
        pairingId: pairing._id,
      },
    })
  }

  // FDTL roster-level (rest / cumulative). All classified 'override' so
  // the planner can still proceed with a commander-discretion audit row.
  if (ruleSet && assignments && pairings) {
    const pairingsById = new Map(pairings.map((p) => [p._id, p]))
    const activityCodesById = activityCodes
      ? new Map(activityCodes.map((c) => [c._id, { flags: c.flags ?? [] }]))
      : undefined
    const existing = buildScheduleDuties({
      crewId: crew._id,
      assignments,
      activities: activities ?? [],
      pairingsById,
      activityCodesById,
      bookings: flightBookings,
    })
    const candidate = buildCandidateDuty(pairing)
    if (candidate) {
      const result = validateCrewAssignment({
        candidate,
        existing,
        homeBase: (crew.baseLabel ?? '').toUpperCase(),
        ruleSet: ruleSet as Parameters<typeof validateCrewAssignment>[0]['ruleSet'],
      })
      for (const chk of result.checks) {
        if (chk.status !== 'violation' && chk.status !== 'warning') continue
        list.push({
          kind: `fdtl_${chk.ruleCode ?? 'rule'}`.toLowerCase(),
          severity: 'override',
          title: chk.label,
          message: `${chk.shortReason}${chk.legalReference ? ` — ${chk.legalReference}` : ''}`,
          detail: {
            ruleCode: chk.ruleCode,
            actual: chk.actual,
            limit: chk.limit,
            actualNum: chk.actualNum,
            limitNum: chk.limitNum,
            status: chk.status,
            legalReference: chk.legalReference ?? null,
            crewId: crew._id,
            pairingId: pairing._id,
          },
        })
      }
    }
  }

  return list
}

/** Split a violation list into hard-blocks and overridables. */
export function partitionViolations(list: AssignmentViolation[]): {
  hardBlocks: AssignmentViolation[]
  overridable: AssignmentViolation[]
} {
  const hardBlocks: AssignmentViolation[] = []
  const overridable: AssignmentViolation[] = []
  for (const v of list) {
    if (v.severity === 'hard_block') hardBlocks.push(v)
    else overridable.push(v)
  }
  return { hardBlocks, overridable }
}
