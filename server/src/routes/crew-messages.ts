import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CrewMessage } from '../models/CrewMessage.js'

/**
 * 4.1.7.1 Crew Message routes.
 *
 *   POST  /crew-messages             — controller sends a message to N crew
 *   GET   /crew-messages?pairingId=… or ?crewId=… — fetch threads
 *   POST  /crew-messages/:id/ack     — crew app acknowledges receipt
 *
 * No role gate; any ops user with operatorId scope can send.
 */

const createSchema = z.object({
  pairingId: z.string().min(1).nullable().optional(),
  recipientCrewIds: z.array(z.string().min(1)).min(1),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(4000),
  channel: z.enum(['inApp', 'sms', 'email']).optional(),
})

const ackSchema = z.object({
  crewId: z.string().min(1),
  status: z.enum(['delivered', 'read', 'failed']),
  at: z.number().int().nonnegative().optional(),
  error: z.string().max(500).nullable().optional(),
})

export async function crewMessageRoutes(app: FastifyInstance) {
  app.post('/crew-messages', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })

    const operatorId = req.operatorId
    const senderUserId = req.userId ?? 'unknown'
    const now = new Date().toISOString()
    const _id = crypto.randomUUID()

    const doc = {
      _id,
      operatorId,
      pairingId: parsed.data.pairingId ?? null,
      senderUserId,
      recipientCrewIds: parsed.data.recipientCrewIds,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      channel: parsed.data.channel ?? 'inApp',
      deliveries: parsed.data.recipientCrewIds.map((crewId) => ({
        crewId,
        status: 'queued' as const,
        deliveredAtUtcMs: null,
        readAtUtcMs: null,
        error: null,
      })),
      createdAt: now,
      updatedAt: now,
    }

    await CrewMessage.create(doc)
    return doc
  })

  app.get('/crew-messages', async (req, reply) => {
    const q = req.query as { pairingId?: string; crewId?: string; limit?: string }
    if (!q.pairingId && !q.crewId) {
      return reply.code(400).send({ error: 'pairingId or crewId required' })
    }
    const operatorId = req.operatorId
    const filter: Record<string, unknown> = { operatorId }
    if (q.pairingId) filter.pairingId = q.pairingId
    if (q.crewId) filter.recipientCrewIds = q.crewId
    const limit = Math.min(Number(q.limit) || 200, 500)
    const rows = await CrewMessage.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    return rows
  })

  app.post('/crew-messages/:id/ack', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = ackSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const operatorId = req.operatorId
    const at = parsed.data.at ?? Date.now()

    const update: Record<string, unknown> = {
      'deliveries.$.status': parsed.data.status,
      updatedAt: new Date().toISOString(),
    }
    if (parsed.data.status === 'delivered' || parsed.data.status === 'read') {
      update['deliveries.$.deliveredAtUtcMs'] = at
    }
    if (parsed.data.status === 'read') update['deliveries.$.readAtUtcMs'] = at
    if (parsed.data.status === 'failed' && parsed.data.error) update['deliveries.$.error'] = parsed.data.error

    const updated = await CrewMessage.findOneAndUpdate(
      { _id: id, operatorId, 'deliveries.crewId': parsed.data.crewId },
      { $set: update },
      { new: true },
    ).lean()
    if (!updated) return reply.code(404).send({ error: 'Message or recipient not found' })
    return updated
  })
}
