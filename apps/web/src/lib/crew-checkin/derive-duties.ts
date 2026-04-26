/**
 * Duty derivation for 4.1.7.1 Crew Check-In/Out.
 *
 * Input: pairings + assignments + crew + positions from `getCrewSchedule`.
 * Output: one `CheckInDutyRow` per pairing (= duty trip), with the leg-level
 * detail collapsed for the grid header. Crew rows for a duty are looked up
 * separately via `getCrewForDuty`.
 *
 * Each duty's RRT is computed via `computeRrtMs`. Late state is computed
 * per-crew (not per-duty) because individual crew members may report at
 * different times.
 */
import type { CrewAssignmentRef, CrewMemberListItemRef, CrewPositionRef, PairingRef } from '@skyhub/api'
import { computeRrtMs } from './compute-rrt'

export interface CheckInDutyRow {
  pairingId: string
  pairingCode: string
  /** Departure ICAO of the first leg (the station where crew reports). */
  baseAirport: string
  rrtMs: number | null
  /** STD of the first leg (UTC ms). */
  stdMs: number | null
  /** STA of the LAST leg (UTC ms) — for "departed" status sweeps. */
  lastStaMs: number | null
  flightNumber: string
  arrStation: string
  aircraftTypeIcao: string | null
  tailNumber: string | null
  /** Number of legs in this duty. */
  legCount: number
  /** Total assigned crew count (after filters). */
  crewCount: number
  /** Aggregate: how many of those crew are checked-in. */
  checkedInCount: number
  /** True when all assigned crew have checked-in (drives row green-fill). */
  allCheckedIn: boolean
  /** True when at least one crew is past Very Late. */
  hasVeryLate: boolean
  /** True when STD has passed. */
  departed: boolean
}

export interface CheckInCrewRow {
  assignmentId: string
  pairingId: string
  crewId: string
  positionCode: string
  positionRank: number
  crewIdNumber: string
  fullName: string
  trainingFlag: boolean
  isDeadhead: boolean
  rrtMs: number | null
  stdMs: number | null
  checkInUtcMs: number | null | undefined
}

interface DeriveInput {
  pairings: PairingRef[]
  assignments: CrewAssignmentRef[]
  crew: CrewMemberListItemRef[]
  positions: CrewPositionRef[]
  /** Station filter — duty's first-leg dep station (matched as either IATA or
   *  ICAO) must be in this list. Empty = all stations. */
  stations?: string[]
  /** Threshold (minutes past RRT) above which crew is considered Very Late. */
  veryLateAfterMinutes?: number
  /** When set, only duties whose first-leg STD or RRT falls on this UTC date
   *  (YYYY-MM-DD) are returned. */
  onDateUtc?: string
}

interface IndexedData {
  duties: CheckInDutyRow[]
  /** assignments indexed by pairingId for fast crew lookup. */
  byPairing: Map<string, CrewAssignmentRef[]>
  /** crew indexed by _id. */
  crewById: Map<string, CrewMemberListItemRef>
  /** positions indexed by _id. */
  positionsById: Map<string, CrewPositionRef>
  /** pairings indexed by _id (so getCrewForDuty can resolve leg deadhead flag). */
  pairingsById: Map<string, PairingRef>
}

export function deriveCheckInData({
  pairings,
  assignments,
  crew,
  positions,
  stations,
  veryLateAfterMinutes = 20,
  onDateUtc,
}: DeriveInput): IndexedData {
  const stationSet = stations && stations.length > 0 ? new Set(stations.map((s) => s.toUpperCase())) : null
  // Scope duties to a single UTC operational day when set. Compare against
  // the date portion of the first-leg STD or the RRT, so a duty that reports
  // 23:30 today and operates at 00:30 tomorrow still surfaces today.
  const dayMatcher = onDateUtc
    ? (ms: number | null) => (ms == null ? false : new Date(ms).toISOString().slice(0, 10) === onDateUtc)
    : null
  const crewById = new Map(crew.map((c) => [c._id, c]))
  const positionsById = new Map(positions.map((p) => [p._id, p]))
  const pairingsById = new Map(pairings.map((p) => [p._id, p]))

  const byPairing = new Map<string, CrewAssignmentRef[]>()
  for (const a of assignments) {
    if (a.status === 'cancelled') continue
    const list = byPairing.get(a.pairingId)
    if (list) list.push(a)
    else byPairing.set(a.pairingId, [a])
  }

  const nowMs = Date.now()
  const duties: CheckInDutyRow[] = []

  for (const p of pairings) {
    const firstLeg = p.legs[0]
    const lastLeg = p.legs[p.legs.length - 1]
    if (!firstLeg) continue

    // Match station filter against BOTH the pairing's home base and the
    // first-leg dep station. AIMS planners think of "SGN crew" as crew based
    // at SGN — the pairing.baseAirport — even when the duty's first leg is
    // a deadhead departing from elsewhere. Falling back to depStation covers
    // out-and-back duties where baseAirport is empty.
    const dutyBase = p.baseAirport || firstLeg.depStation
    if (
      stationSet &&
      !stationSet.has((p.baseAirport ?? '').toUpperCase()) &&
      !stationSet.has(firstLeg.depStation.toUpperCase())
    ) {
      continue
    }

    const rrtMs = computeRrtMs(p)
    const stdMs = firstLeg.stdUtcIso ? Date.parse(firstLeg.stdUtcIso) : null
    const lastStaMs = lastLeg?.staUtcIso ? Date.parse(lastLeg.staUtcIso) : null

    if (dayMatcher && !dayMatcher(stdMs) && !dayMatcher(rrtMs)) continue

    const dutyAssignments = byPairing.get(p._id) ?? []
    const crewCount = dutyAssignments.length
    let checkedInCount = 0
    let hasVeryLate = false
    for (const a of dutyAssignments) {
      if (a.checkInUtcMs != null) {
        checkedInCount += 1
        if (rrtMs != null && a.checkInUtcMs - rrtMs > veryLateAfterMinutes * 60_000) hasVeryLate = true
      } else if (rrtMs != null && nowMs - rrtMs > veryLateAfterMinutes * 60_000) {
        hasVeryLate = true
      }
    }

    duties.push({
      pairingId: p._id,
      pairingCode: p.pairingCode,
      baseAirport: dutyBase,
      rrtMs,
      stdMs,
      lastStaMs,
      flightNumber: firstLeg.flightNumber,
      arrStation: firstLeg.arrStation,
      aircraftTypeIcao: p.aircraftTypeIcao,
      tailNumber: firstLeg.tailNumber ?? null,
      legCount: p.legs.length,
      crewCount,
      checkedInCount,
      allCheckedIn: crewCount > 0 && checkedInCount === crewCount,
      hasVeryLate,
      departed: stdMs != null && nowMs > stdMs,
    })
  }

  duties.sort((a, b) => (a.stdMs ?? 0) - (b.stdMs ?? 0))

  return { duties, byPairing, crewById, positionsById, pairingsById }
}

export function getCrewForDuty(
  pairingId: string,
  data: Pick<IndexedData, 'byPairing' | 'crewById' | 'positionsById' | 'pairingsById'>,
): CheckInCrewRow[] {
  const assignments = data.byPairing.get(pairingId) ?? []
  const pairing = data.pairingsById.get(pairingId)
  const rrtMs = pairing ? computeRrtMs(pairing) : null
  const stdMs = pairing?.legs[0]?.stdUtcIso ? Date.parse(pairing.legs[0].stdUtcIso) : null

  const rows: CheckInCrewRow[] = []
  for (const a of assignments) {
    const crew = data.crewById.get(a.crewId)
    const seat = data.positionsById.get(a.seatPositionId)
    const firstLeg = pairing?.legs[0]
    rows.push({
      assignmentId: a._id,
      pairingId: a.pairingId,
      crewId: a.crewId,
      positionCode: seat?.code ?? '—',
      positionRank: seat?.rankOrder ?? 99,
      crewIdNumber: crew?.employeeId ?? a.crewId.slice(0, 6),
      fullName: crew ? `${crew.lastName.toUpperCase()}, ${crew.firstName}` : '—',
      trainingFlag: false,
      isDeadhead: !!firstLeg?.isDeadhead,
      rrtMs,
      stdMs,
      checkInUtcMs: a.checkInUtcMs,
    })
  }
  rows.sort((a, b) => a.positionRank - b.positionRank || a.fullName.localeCompare(b.fullName))
  return rows
}
