import { Pairing } from '../models/Pairing.js'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewMember } from '../models/CrewMember.js'
import { CrewPosition } from '../models/CrewPosition.js'

export interface ResolvedCrewMember {
  employeeId: string
  crewId: string
  role: string
  name: string
  pairingId: string
  pairingCode: string
  status: 'planned' | 'confirmed' | 'rostered' | 'cancelled'
  sourceRunId: string | null
  seatIndex: number
}

export interface ResolvedPairing {
  id: string
  code: string
}

export interface ResolvedFlightCrew {
  crew: ResolvedCrewMember[]
  pairings: ResolvedPairing[]
}

const EMPTY: ResolvedFlightCrew = { crew: [], pairings: [] }

/**
 * Computes rostered crew for a single flight by joining
 * Pairing.legs[].flightId → Pairing._id → CrewAssignment.pairingId.
 *
 * Read-only. Does NOT write to FlightInstance.crew[] (which is reserved
 * for operational check-in overrides). Used by GET /gantt/flight-detail
 * to surface roster output in the Movement Control Crew tab.
 */
export async function resolveCrewForFlight(
  operatorId: string,
  scheduledFlightId: string,
  opDate: string,
  scenarioId: string | null = null,
): Promise<ResolvedFlightCrew> {
  const pairings = await Pairing.find({
    operatorId,
    scenarioId,
    'legs.flightId': scheduledFlightId,
    'legs.flightDate': opDate,
  })
    .lean()
    .select({ _id: 1, pairingCode: 1, legs: 1 })

  if (pairings.length === 0) return EMPTY

  const pairingIds = pairings.map((p) => p._id)

  const assignments = await CrewAssignment.find({
    operatorId,
    scenarioId,
    pairingId: { $in: pairingIds },
    status: { $ne: 'cancelled' },
  }).lean()

  if (assignments.length === 0) {
    return {
      crew: [],
      pairings: pairings.map((p) => ({ id: p._id, code: p.pairingCode })),
    }
  }

  const crewIds = Array.from(new Set(assignments.map((a) => a.crewId)))
  const seatIds = Array.from(new Set(assignments.map((a) => a.seatPositionId)))

  const [members, seats] = await Promise.all([
    CrewMember.find({ operatorId, _id: { $in: crewIds } })
      .lean()
      .select({ _id: 1, employeeId: 1, firstName: 1, lastName: 1 }),
    CrewPosition.find({ operatorId, _id: { $in: seatIds } })
      .lean()
      .select({ _id: 1, code: 1 }),
  ])

  const memberById = new Map(members.map((m) => [m._id, m]))
  const seatCodeById = new Map(seats.map((s) => [s._id, s.code]))
  const pairingCodeById = new Map(pairings.map((p) => [p._id, p.pairingCode]))

  const crew: ResolvedCrewMember[] = assignments.flatMap((a) => {
    const m = memberById.get(a.crewId)
    if (!m) return []
    return [
      {
        employeeId: m.employeeId,
        crewId: a.crewId,
        role: seatCodeById.get(a.seatPositionId) ?? 'UNK',
        name: `${m.firstName} ${m.lastName}`.trim(),
        pairingId: a.pairingId,
        pairingCode: pairingCodeById.get(a.pairingId) ?? '',
        status: a.status as ResolvedCrewMember['status'],
        sourceRunId: a.sourceRunId ?? null,
        seatIndex: a.seatIndex ?? 0,
      },
    ]
  })

  return {
    crew,
    pairings: pairings.map((p) => ({ id: p._id, code: p.pairingCode })),
  }
}
