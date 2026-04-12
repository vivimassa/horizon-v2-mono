import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MovementMessageLog } from '../models/MovementMessageLog.js'

// ── Zod Schemas ────────────────────────────────────────────

const messageLogQuery = z.object({
  operatorId: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']).optional(),
  actionCodes: z.string().optional(),
  status: z.string().optional(),
  flightNumber: z.string().optional(),
  flightDateFrom: z.string().optional(),
  flightDateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const batchIdsSchema = z.object({
  messageIds: z.array(z.string().min(1)),
})

// ── Routes ─────────────────────────────────────────────────

export async function movementMessageRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /movement-messages — Paginated message log ──
  app.get('/movement-messages', async (req) => {
    const q = messageLogQuery.parse(req.query)

    const filter: Record<string, unknown> = { operatorId: q.operatorId }
    if (q.direction) filter.direction = q.direction
    if (q.status) filter.status = q.status
    if (q.actionCodes) filter.actionCode = { $in: q.actionCodes.split(',') }
    if (q.flightNumber) {
      filter.flightNumber = { $regex: q.flightNumber, $options: 'i' }
    }
    if (q.flightDateFrom || q.flightDateTo) {
      const range: Record<string, string> = {}
      if (q.flightDateFrom) range.$gte = q.flightDateFrom
      if (q.flightDateTo) range.$lte = q.flightDateTo
      filter.flightDate = range
    }

    const [messages, total] = await Promise.all([
      MovementMessageLog.find(filter).sort({ createdAtUtc: -1 }).skip(q.offset).limit(q.limit).lean(),
      MovementMessageLog.countDocuments(filter),
    ])

    return { messages, total }
  })

  // ── GET /movement-messages/stats — Aggregate counts ──
  app.get('/movement-messages/stats', async (req) => {
    const { operatorId } = z.object({ operatorId: z.string().min(1) }).parse(req.query)

    const pipeline = [{ $match: { operatorId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]
    const agg = await MovementMessageLog.aggregate(pipeline)
    const counts: Record<string, number> = {}
    for (const row of agg) counts[row._id as string] = row.count as number

    return {
      total: Object.values(counts).reduce((s, c) => s + c, 0),
      held: counts.held ?? 0,
      pending: counts.pending ?? 0,
      sent: counts.sent ?? 0,
    }
  })

  // ── GET /movement-messages/held — All held outbound ──
  app.get('/movement-messages/held', async (req) => {
    const { operatorId } = z.object({ operatorId: z.string().min(1) }).parse(req.query)
    const messages = await MovementMessageLog.find({
      operatorId,
      status: 'held',
      direction: 'outbound',
    })
      .sort({ createdAtUtc: -1 })
      .lean()

    return { messages }
  })

  // ── POST /movement-messages/release — Batch release held → pending ──
  app.post('/movement-messages/release', async (req) => {
    const { messageIds } = batchIdsSchema.parse(req.body)
    const now = new Date().toISOString()

    const result = await MovementMessageLog.updateMany(
      { _id: { $in: messageIds }, status: 'held' },
      { $set: { status: 'pending', scenarioId: null, updatedAtUtc: now } },
    )

    return { released: result.modifiedCount }
  })

  // ── POST /movement-messages/discard — Batch discard held ──
  app.post('/movement-messages/discard', async (req) => {
    const { messageIds } = batchIdsSchema.parse(req.body)
    const now = new Date().toISOString()

    const result = await MovementMessageLog.updateMany(
      { _id: { $in: messageIds }, status: 'held' },
      { $set: { status: 'discarded', updatedAtUtc: now } },
    )

    return { discarded: result.modifiedCount }
  })
}
