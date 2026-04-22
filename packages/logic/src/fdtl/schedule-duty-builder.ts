// Canonical ScheduleDuty builder. Single source of truth for converting
// (assignments + activities + pairings) → ScheduleDuty[]. Used by:
//   • client drop-legality (drag-time roster check)
//   • client violations (assign-time override check)
//   • server evaluate-crew-roster (nightly sweep + on-demand)
//   • auto-assign solver (future)
//
// Deliberately structural: takes only the fields the validator needs,
// accepts any shape as long as those fields are present. Callers adapt
// their domain shapes via the minimal interfaces exported here.

import type { ScheduleDuty } from './crew-schedule-validator-types'

export interface AssignmentLike {
  _id: string
  crewId: string
  pairingId: string
  seatPositionId?: string
  startUtcIso: string
  endUtcIso: string
  status: string
  /** True when this assignment was accepted under commander discretion
   *  (override dialog ack + server-persisted audit row). */
  commanderDiscretion?: boolean
}

export interface PairingLike {
  _id: string
  pairingCode?: string | null
  totalDutyMinutes?: number | null
  totalBlockMinutes?: number | null
  complementKey?: string | null
  legs?: Array<{ depStation?: string | null; arrStation?: string | null; stdUtcIso?: string; staUtcIso?: string }>
}

export interface ActivityLike {
  _id: string
  crewId: string
  startUtcIso: string
  endUtcIso: string
}

export interface BuildScheduleDutiesInput {
  crewId: string
  assignments: AssignmentLike[]
  activities: ActivityLike[]
  pairingsById: Map<string, PairingLike>
}

export function buildScheduleDuties(input: BuildScheduleDutiesInput): ScheduleDuty[] {
  const out: ScheduleDuty[] = []
  for (const a of input.assignments) {
    if (a.crewId !== input.crewId) continue
    if (a.status === 'cancelled') continue
    const p = input.pairingsById.get(a.pairingId)
    const startMs = new Date(a.startUtcIso).getTime()
    const endMs = new Date(a.endUtcIso).getTime()
    const legs = p?.legs ?? []
    const firstLeg = legs[0]
    const lastLeg = legs[legs.length - 1]
    out.push({
      id: a._id,
      kind: 'pairing',
      startUtcMs: startMs,
      endUtcMs: endMs,
      dutyMinutes: p?.totalDutyMinutes ?? Math.max(0, (endMs - startMs) / 60_000),
      blockMinutes: p?.totalBlockMinutes ?? 0,
      fdpMinutes: p?.totalDutyMinutes ?? 0,
      landings: legs.length,
      departureStation: firstLeg?.depStation ?? null,
      arrivalStation: lastLeg?.arrStation ?? null,
      isAugmented: p?.complementKey === 'aug1' || p?.complementKey === 'aug2',
      label: p?.pairingCode ?? 'pairing',
      commanderDiscretion: a.commanderDiscretion === true,
    })
  }
  for (const act of input.activities) {
    if (act.crewId !== input.crewId) continue
    const startMs = new Date(act.startUtcIso).getTime()
    const endMs = new Date(act.endUtcIso).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    const durMin = Math.max(0, (endMs - startMs) / 60_000)
    out.push({
      id: act._id,
      kind: 'activity',
      startUtcMs: startMs,
      endUtcMs: endMs,
      dutyMinutes: durMin,
      blockMinutes: 0,
      fdpMinutes: 0,
      landings: 0,
      departureStation: null,
      arrivalStation: null,
      isAugmented: false,
      label: 'activity',
    })
  }
  return out
}

/** Build a ScheduleDuty for a candidate pairing not yet assigned.
 *  Mirrors `buildScheduleDuties` for a single pairing + its legs.
 *  Returns null when the pairing has no legs AND no reportTime (cannot
 *  derive duty window). */
export function buildCandidateDuty(
  pairing: PairingLike & {
    reportTime?: string | null
    startDate?: string
  },
): ScheduleDuty | null {
  const legs = pairing.legs ?? []
  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]
  let startMs: number | null = null
  let endMs: number | null = null
  if (pairing.reportTime) {
    startMs = new Date(pairing.reportTime).getTime()
  } else if (firstLeg?.stdUtcIso) {
    startMs = new Date(firstLeg.stdUtcIso).getTime() - 60 * 60_000
  }
  if (lastLeg?.staUtcIso) {
    endMs = new Date(lastLeg.staUtcIso).getTime() + 30 * 60_000
  }
  if (startMs == null || endMs == null) return null
  return {
    id: pairing._id,
    kind: 'pairing',
    startUtcMs: startMs,
    endUtcMs: endMs,
    dutyMinutes: pairing.totalDutyMinutes ?? Math.max(0, (endMs - startMs) / 60_000),
    blockMinutes: pairing.totalBlockMinutes ?? 0,
    fdpMinutes: pairing.totalDutyMinutes ?? 0,
    landings: legs.length,
    departureStation: firstLeg?.depStation ?? null,
    arrivalStation: lastLeg?.arrStation ?? null,
    isAugmented: pairing.complementKey === 'aug1' || pairing.complementKey === 'aug2',
    label: pairing.pairingCode ?? 'candidate',
  }
}
