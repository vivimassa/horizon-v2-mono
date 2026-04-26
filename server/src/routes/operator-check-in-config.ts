import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OperatorCheckInConfig } from '../models/OperatorCheckInConfig.js'

/**
 * 4.1.7.1 Crew Check-In/Out Configuration — admin config persistence.
 *
 *   GET  /operator-check-in-config?operatorId=…   → full doc (404 if not found)
 *   PUT  /operator-check-in-config                → upsert all sections
 *
 * Same partial-merge upsert pattern as 4.1.8.3 HOTAC config.
 */

const basicSchema = z
  .object({
    scope: z.enum(['pairing-start', 'every-duty', 'free']).optional(),
    earliestCheckInMinutesBeforeRrt: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .optional(),
  })
  .optional()

const lateInfoSchema = z
  .object({
    lateAfterMinutes: z.number().int().min(1).max(60).optional(),
    veryLateAfterMinutes: z.number().int().min(5).max(120).optional(),
    standbyLateAfterMinutes: z.number().int().min(1).max(60).optional(),
    noShowAfterMinutes: z.number().int().min(10).max(240).optional(),
  })
  .optional()

const delayedSchema = z
  .object({
    flagWhenRrtNotAmended: z.boolean().optional(),
    minimumDelayMinutes: z.number().int().min(0).max(480).optional(),
  })
  .optional()

const groundDutiesSchema = z
  .object({
    requireCheckInFor: z.array(z.string().min(1).max(20)).max(50).optional(),
    suppressOthersInPairing: z.boolean().optional(),
  })
  .optional()

const precheckInSchema = z
  .object({
    windowMinutesBeforeRrt: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .optional(),
    lateThresholdMinutesBeforeRrt: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .optional(),
  })
  .optional()

const upsertSchema = z.object({
  operatorId: z.string().min(1),
  basic: basicSchema,
  lateInfo: lateInfoSchema,
  delayed: delayedSchema,
  groundDuties: groundDutiesSchema,
  precheckIn: precheckInSchema,
})

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

export async function operatorCheckInConfigRoutes(app: FastifyInstance) {
  app.get('/operator-check-in-config', async (req, reply) => {
    const q = req.query as { operatorId?: string }
    const operatorId = q.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const doc = await OperatorCheckInConfig.findOne({ operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'No check-in config for this operator' })
    return doc
  })

  app.put('/operator-check-in-config', { preHandler: requireOpsRole }, async (req, reply) => {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = new Date().toISOString()
    const { operatorId } = parsed.data
    const existing = (await OperatorCheckInConfig.findOne({ operatorId }).lean()) as Record<string, unknown> | null

    const _id = (existing as { _id?: string } | null)?._id ?? crypto.randomUUID()
    const createdAt = (existing as { createdAt?: string } | null)?.createdAt ?? now

    const set: Record<string, unknown> = {
      operatorId,
      basic: { ...((existing?.basic as Record<string, unknown>) ?? {}), ...(parsed.data.basic ?? {}) },
      lateInfo: { ...((existing?.lateInfo as Record<string, unknown>) ?? {}), ...(parsed.data.lateInfo ?? {}) },
      delayed: { ...((existing?.delayed as Record<string, unknown>) ?? {}), ...(parsed.data.delayed ?? {}) },
      groundDuties: {
        ...((existing?.groundDuties as Record<string, unknown>) ?? {}),
        ...(parsed.data.groundDuties ?? {}),
      },
      precheckIn: { ...((existing?.precheckIn as Record<string, unknown>) ?? {}), ...(parsed.data.precheckIn ?? {}) },
      updatedAt: now,
    }

    await OperatorCheckInConfig.updateOne(
      { operatorId },
      { $set: set, $setOnInsert: { _id, createdAt } },
      { upsert: true },
    )

    const doc = await OperatorCheckInConfig.findOne({ operatorId }).lean()
    return doc
  })
}
