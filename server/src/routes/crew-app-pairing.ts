import type { FastifyInstance } from 'fastify'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { CrewMember } from '../models/CrewMember.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'

interface CrewListEntry {
  crewId: string
  firstName: string
  lastName: string
  employeeId: string
  positionCode: string | null
  positionLabel: string | null
  seatIndex: number
}

export async function crewAppPairingRoutes(app: FastifyInstance) {
  /**
   * GET /crew-app/pairings/:pairingId/crew
   *
   * Returns the other crew assigned to a pairing the caller is on. Strict
   * tenant + presence check — only crew rostered on the same pairing get
   * the list. No address / phone exposed; just name + EID + position.
   */
  app.get<{ Params: { pairingId: string } }>(
    '/crew-app/pairings/:pairingId/crew',
    { preHandler: requireCrewAuth },
    async (req, reply) => {
      const { pairingId } = req.params
      const operatorId = req.crewOperatorId
      const callerCrewId = req.crewId

      // Verify caller is on the pairing
      const own = await CrewAssignment.findOne({
        operatorId,
        crewId: callerCrewId,
        pairingId,
        scenarioId: null,
        status: { $ne: 'cancelled' },
      }).lean()
      if (!own) return reply.code(403).send({ error: 'Not assigned to this pairing' })

      const assignments = await CrewAssignment.find({
        operatorId,
        pairingId,
        scenarioId: null,
        status: { $ne: 'cancelled' },
      })
        .sort({ seatIndex: 1 })
        .lean()

      const crewIds = Array.from(new Set(assignments.map((a) => a.crewId)))
      const positionIds = Array.from(new Set(assignments.map((a) => a.seatPositionId).filter(Boolean) as string[]))

      const [members, positions] = await Promise.all([
        CrewMember.find(
          { _id: { $in: crewIds }, operatorId },
          { _id: 1, firstName: 1, lastName: 1, employeeId: 1 },
        ).lean(),
        positionIds.length
          ? CrewPosition.find({ _id: { $in: positionIds }, operatorId }, { _id: 1, code: 1, name: 1 }).lean()
          : [],
      ])
      const memberById = new Map(members.map((m) => [m._id as string, m]))
      const positionById = new Map(positions.map((p) => [p._id as string, p]))

      const list: CrewListEntry[] = assignments.map((a) => {
        const m = memberById.get(a.crewId)
        const pos = positionById.get(a.seatPositionId)
        return {
          crewId: a.crewId,
          firstName: m?.firstName ?? '?',
          lastName: m?.lastName ?? '?',
          employeeId: m?.employeeId ?? '',
          positionCode: pos?.code ?? null,
          positionLabel: pos?.name ?? null,
          seatIndex: a.seatIndex,
        }
      })

      return { pairingId, crew: list }
    },
  )
}
