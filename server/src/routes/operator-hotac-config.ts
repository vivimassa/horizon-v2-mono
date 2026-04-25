import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OperatorHotacConfig } from '../models/OperatorHotacConfig.js'

/**
 * 4.1.8.3 HOTAC Configurations — admin config persistence.
 *
 *   GET  /operator-hotac-config?operatorId=…   → full doc (404 if not found — client uses defaults)
 *   PUT  /operator-hotac-config                → upsert all sections
 *
 * Mirrors operator-scheduling-config: one doc per operator, partial-merge on
 * PUT so unspecified sections retain their existing values.
 */

const layoverRuleSchema = z
  .object({
    layoverMinHours: z.number().int().min(1).max(24).optional(),
    excludeHomeBase: z.boolean().optional(),
    minSpanMidnightHours: z.number().int().min(0).max(12).optional(),
  })
  .optional()

const roomAllocationSchema = z
  .object({
    defaultOccupancy: z.enum(['single', 'double']).optional(),
    doubleOccupancyPositions: z.array(z.string().min(1).max(10)).max(20).optional(),
    contractCapBehaviour: z.enum(['reject', 'supplement']).optional(),
  })
  .optional()

const dispatchSchema = z
  .object({
    autoDispatchEnabled: z.boolean().optional(),
    autoDispatchTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    sendBeforeHours: z.number().int().min(0).max(96).optional(),
    confirmationSlaHours: z.number().int().min(1).max(24).optional(),
  })
  .optional()

const checkInSchema = z
  .object({
    autoCheckInOnArrivalDelayMinutes: z.number().int().min(0).max(240).optional(),
    noShowAfterHours: z.number().int().min(1).max(24).optional(),
  })
  .optional()

const emailSchema = z
  .object({
    fromAddress: z.string().max(200).optional(),
    replyTo: z.string().max(200).nullable().optional(),
    signature: z.string().max(2000).optional(),
    holdByDefault: z.boolean().optional(),
  })
  .optional()

const transportSchema = z
  .object({
    pickupMode: z.enum(['door-to-door', 'hub-shuttle']).optional(),
    hubLocation: z
      .object({
        name: z.string().max(120).optional(),
        addressLine: z.string().max(300).nullable().optional(),
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    bufferMinutes: z.number().int().min(0).max(120).optional(),
    batchingWindowMinutes: z.number().int().min(0).max(120).optional(),
    defaultTravelTimeMinutes: z.number().int().min(0).max(240).optional(),
    defaultVehicleTier: z.string().max(60).nullable().optional(),
    defaultVendorSlaMinutes: z.number().int().min(5).max(60).optional(),
    taxiVoucherEnabled: z.boolean().optional(),
    flightBookingMode: z.enum(['ticket-preferred', 'gendec-preferred']).optional(),
    layoverTransportProvider: z.enum(['hotel', 'vendor']).optional(),
  })
  .optional()

const upsertSchema = z.object({
  operatorId: z.string().min(1),
  layoverRule: layoverRuleSchema,
  roomAllocation: roomAllocationSchema,
  dispatch: dispatchSchema,
  checkIn: checkInSchema,
  transport: transportSchema,
  email: emailSchema,
})

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

export async function operatorHotacConfigRoutes(app: FastifyInstance) {
  app.get('/operator-hotac-config', async (req, reply) => {
    const q = req.query as { operatorId?: string }
    const operatorId = q.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const doc = await OperatorHotacConfig.findOne({ operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'No HOTAC config for this operator' })
    return doc
  })

  app.put('/operator-hotac-config', { preHandler: requireOpsRole }, async (req, reply) => {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = new Date().toISOString()
    const { operatorId } = parsed.data
    const existing = (await OperatorHotacConfig.findOne({ operatorId }).lean()) as Record<string, unknown> | null

    const _id = (existing as { _id?: string } | null)?._id ?? crypto.randomUUID()
    const createdAt = (existing as { createdAt?: string } | null)?.createdAt ?? now

    // Partial-merge each nested section so unspecified fields retain their
    // existing values (PATCH semantics on a PUT verb, mirroring 4.1.6.3).
    const set: Record<string, unknown> = {
      operatorId,
      layoverRule: {
        ...((existing?.layoverRule as Record<string, unknown>) ?? {}),
        ...(parsed.data.layoverRule ?? {}),
      },
      roomAllocation: {
        ...((existing?.roomAllocation as Record<string, unknown>) ?? {}),
        ...(parsed.data.roomAllocation ?? {}),
      },
      dispatch: {
        ...((existing?.dispatch as Record<string, unknown>) ?? {}),
        ...(parsed.data.dispatch ?? {}),
      },
      checkIn: {
        ...((existing?.checkIn as Record<string, unknown>) ?? {}),
        ...(parsed.data.checkIn ?? {}),
      },
      transport: {
        ...((existing?.transport as Record<string, unknown>) ?? {}),
        ...(parsed.data.transport ?? {}),
      },
      email: {
        ...((existing?.email as Record<string, unknown>) ?? {}),
        ...(parsed.data.email ?? {}),
      },
      updatedAt: now,
    }

    await OperatorHotacConfig.updateOne(
      { operatorId },
      { $set: set, $setOnInsert: { _id, createdAt } },
      { upsert: true },
    )

    const doc = await OperatorHotacConfig.findOne({ operatorId }).lean()
    return doc
  })
}
