import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OperatorPairingConfig } from '../models/OperatorPairingConfig.js'

/**
 * 4.1.5.4 Pairing Configurations — admin config persistence.
 *
 *   GET  /operator-pairing-config?operatorId=…   → full doc (404 → defaults client-side)
 *   PUT  /operator-pairing-config                → upsert user-editable sections
 *
 * PUT is gated by requireOpsRole (matches operator-messaging-config).
 * Reads are open to any authenticated tenant user.
 */

const aircraftChangeGroundTimeSchema = z
  .object({
    domToDomMin: z.number().int().min(0).max(1440).optional(),
    domToIntlMin: z.number().int().min(0).max(1440).optional(),
    intlToDomMin: z.number().int().min(0).max(1440).optional(),
    intlToIntlMin: z.number().int().min(0).max(1440).optional(),
  })
  .optional()

const upsertSchema = z.object({
  operatorId: z.string().min(1),
  aircraftChangeGroundTime: aircraftChangeGroundTimeSchema,
})

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

export async function operatorPairingConfigRoutes(app: FastifyInstance) {
  app.get('/operator-pairing-config', async (req, reply) => {
    const q = req.query as { operatorId?: string }
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const doc = await OperatorPairingConfig.findOne({ operatorId: q.operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'No config for this operator' })
    return doc
  })

  app.put('/operator-pairing-config', { preHandler: requireOpsRole }, async (req, reply) => {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = new Date().toISOString()
    const existing = await OperatorPairingConfig.findOne({
      operatorId: parsed.data.operatorId,
    }).lean()
    const _id = (existing as { _id?: string } | null)?._id ?? crypto.randomUUID()
    const createdAt = (existing as { createdAt?: string } | null)?.createdAt ?? now

    const existingGround =
      (existing as { aircraftChangeGroundTime?: Record<string, unknown> } | null)?.aircraftChangeGroundTime ?? {}
    const groundMerged = {
      ...existingGround,
      ...(parsed.data.aircraftChangeGroundTime ?? {}),
    }

    await OperatorPairingConfig.updateOne(
      { operatorId: parsed.data.operatorId },
      {
        $set: {
          _id,
          operatorId: parsed.data.operatorId,
          aircraftChangeGroundTime: groundMerged,
          createdAt,
          updatedAt: now,
        },
      },
      { upsert: true },
    )

    const doc = await OperatorPairingConfig.findOne({
      operatorId: parsed.data.operatorId,
    }).lean()
    return doc
  })
}
