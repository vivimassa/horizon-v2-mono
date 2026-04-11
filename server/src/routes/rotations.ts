import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { ScheduledFlight } from '../models/ScheduledFlight.js'

export async function rotationRoutes(app: FastifyInstance): Promise<void> {
  // ── Get rotation groups ──
  app.get('/rotations', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = { isActive: { $ne: false } }
    if (q.operatorId) filter.operatorId = q.operatorId
    if (q.seasonCode) filter.seasonCode = q.seasonCode
    if (q.scenarioId) filter.scenarioId = q.scenarioId

    const flights = await ScheduledFlight.find({ ...filter, rotationId: { $ne: null } })
      .sort({ rotationId: 1, rotationSequence: 1 })
      .lean()

    // Group by rotationId
    const groups = new Map<string, typeof flights>()
    for (const f of flights) {
      const rid = f.rotationId as string
      const arr = groups.get(rid) ?? []
      arr.push(f)
      groups.set(rid, arr)
    }

    return Array.from(groups.entries()).map(([rotationId, flts]) => ({
      rotationId,
      label: flts[0]?.rotationLabel ?? rotationId.slice(0, 8),
      aircraftTypeIcao: flts[0]?.aircraftTypeIcao,
      flightCount: flts.length,
      flights: flts.map((f) => f._id),
    }))
  })

  // ── Auto-generate rotations from unassigned flights ──
  app.post('/rotations/auto-generate', async (req, reply) => {
    const { operatorId, seasonCode, scenarioId } = req.body as Record<string, string>
    if (!operatorId || !seasonCode) return reply.code(400).send({ error: 'operatorId and seasonCode required' })

    const filter: Record<string, unknown> = {
      operatorId,
      seasonCode,
      isActive: { $ne: false },
      rotationId: null,
      status: { $ne: 'cancelled' },
    }
    if (scenarioId) filter.scenarioId = scenarioId

    const flights = await ScheduledFlight.find(filter).sort({ aircraftTypeIcao: 1, stdUtc: 1 }).lean()

    // Group by aircraft type, then chain by arr→dep matching
    const typeGroups = new Map<string, typeof flights>()
    for (const f of flights) {
      const key = (f.aircraftTypeIcao as string) ?? 'UNK'
      const arr = typeGroups.get(key) ?? []
      arr.push(f)
      typeGroups.set(key, arr)
    }

    let rotationCount = 0
    const now = new Date().toISOString()

    for (const [acType, typedFlights] of typeGroups) {
      const used = new Set<string>()
      let chainIdx = 1

      for (const seed of typedFlights) {
        if (used.has(seed._id as string)) continue

        const rotId = crypto.randomUUID()
        const chain: string[] = [seed._id as string]
        used.add(seed._id as string)

        // Greedy forward chaining: find next flight departing from current arrival
        let current = seed
        while (true) {
          const next = typedFlights.find(
            (f) => !used.has(f._id as string) && (f.depStation as string) === (current.arrStation as string),
          )
          if (!next) break
          chain.push(next._id as string)
          used.add(next._id as string)
          current = next
        }

        // Update all flights in this chain
        const label = `${chainIdx}-${acType}`
        const ops = chain.map((fid, seq) => ({
          updateOne: {
            filter: { _id: fid },
            update: { $set: { rotationId: rotId, rotationSequence: seq, rotationLabel: label, updatedAt: now } },
          },
        }))
        await ScheduledFlight.bulkWrite(ops)
        rotationCount++
        chainIdx++
      }
    }

    return { success: true, rotations: rotationCount }
  })

  // ── Reorder flights within a rotation ──
  app.patch('/rotations/:id/reorder', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { flightIds } = req.body as { flightIds: string[] }
    if (!Array.isArray(flightIds)) return reply.code(400).send({ error: 'flightIds array required' })

    const now = new Date().toISOString()
    const ops = flightIds.map((fid, seq) => ({
      updateOne: {
        filter: { _id: fid, rotationId: id },
        update: { $set: { rotationSequence: seq, updatedAt: now } },
      },
    }))
    await ScheduledFlight.bulkWrite(ops)
    return { success: true }
  })

  // ── Clear rotation assignment ──
  app.delete('/rotations/:id', async (req) => {
    const { id } = req.params as { id: string }
    await ScheduledFlight.updateMany(
      { rotationId: id },
      { $set: { rotationId: null, rotationSequence: null, rotationLabel: null, updatedAt: new Date().toISOString() } },
    )
    return { success: true }
  })
}
