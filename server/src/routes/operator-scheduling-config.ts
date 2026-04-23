import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OperatorSchedulingConfig } from '../models/OperatorSchedulingConfig.js'

/**
 * 4.1.6.3 Scheduling Configurations — admin config persistence.
 *
 *   GET  /operator-scheduling-config?operatorId=…   → full doc (404 if not found — client uses defaults)
 *   PUT  /operator-scheduling-config                → upsert all sections
 *
 * PUT gated by requireOpsRole. Reads open to any authenticated tenant user.
 */

const destinationRuleSchema = z.object({
  _id: z.string().min(1),
  scope: z.enum(['airport', 'country']),
  code: z.string().min(1).max(10),
  maxLayoversPerPeriod: z.number().int().min(0).max(99).nullable().optional(),
  minSeparationDays: z.number().int().min(0).max(90).nullable().optional(),
  enabled: z.boolean().optional(),
})

const daysOffSchema = z
  .object({
    minPerPeriodDays: z.number().int().min(0).max(31).optional(),
    maxPerPeriodDays: z.number().int().min(0).max(31).optional(),
    maxConsecutiveDutyDays: z.number().int().min(1).max(14).optional(),
    maxConsecutiveMorningDuties: z.number().int().min(1).max(14).optional(),
    maxConsecutiveAfternoonDuties: z.number().int().min(1).max(14).optional(),
  })
  .optional()

const standbySchema = z
  .object({
    usePercentage: z.boolean().optional(),
    minPerDayFlat: z.number().int().min(0).max(100).optional(),
    minPerDayPct: z.number().min(0).max(100).optional(),
    homeStandbyRatioPct: z.number().min(0).max(100).optional(),
    startTimeMode: z.enum(['auto', 'fixed']).optional(),
    autoLeadTimeMin: z.number().int().min(0).max(480).optional(),
    fixedStartTimes: z.array(z.string()).max(10).optional(),
    minDurationMin: z.number().int().min(60).max(1440).optional(),
    maxDurationMin: z.number().int().min(60).max(1440).optional(),
    requireLegalRestAfter: z.boolean().optional(),
    extraRestAfterMin: z.number().int().min(0).max(480).optional(),
  })
  .optional()

const objectivesSchema = z
  .object({
    genderBalanceOnLayovers: z.boolean().optional(),
    genderBalanceWeight: z.number().int().min(0).max(100).optional(),
    priorityOrder: z.array(z.string().min(1).max(50)).max(10).optional(),
  })
  .optional()

const upsertSchema = z.object({
  operatorId: z.string().min(1),
  carrierMode: z.enum(['lcc', 'legacy']).optional(),
  daysOff: daysOffSchema,
  standby: standbySchema,
  destinationRules: z.array(destinationRuleSchema).optional(),
  objectives: objectivesSchema,
})

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

export async function operatorSchedulingConfigRoutes(app: FastifyInstance) {
  // Per-user config with operator-level fallback. Each scheduler owns their
  // own soft-rule preferences; when they haven't saved anything yet, the
  // operator default (userId=null) applies. If even the default is missing,
  // 404 — client uses compiled defaults.
  app.get('/operator-scheduling-config', async (req, reply) => {
    const q = req.query as { operatorId?: string }
    const operatorId = q.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const userId = req.userId

    const userDoc = userId ? await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean() : null
    if (userDoc) return userDoc

    const fallback = await OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
    if (!fallback) return reply.code(404).send({ error: 'No config for this operator' })
    return fallback
  })

  app.put('/operator-scheduling-config', { preHandler: requireOpsRole }, async (req, reply) => {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = new Date().toISOString()
    const operatorId = parsed.data.operatorId
    // Persist per-user. Unauthenticated PUTs are already blocked by requireOpsRole;
    // if userId is missing for some reason, write as operator-level default.
    const userId = req.userId ?? null

    // Merge against the user's own doc when it exists, else the operator default
    // (so first-time user save inherits tenant-wide defaults), else empty.
    const existingUserDoc = userId ? await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean() : null
    const existingDefault = existingUserDoc
      ? null
      : await OperatorSchedulingConfig.findOne({ operatorId, userId: null }).lean()
    const existing = (existingUserDoc ?? existingDefault) as Record<string, unknown> | null

    const _id = (existingUserDoc as { _id?: string } | null)?._id ?? crypto.randomUUID()
    const createdAt = (existingUserDoc as { createdAt?: string } | null)?.createdAt ?? now

    const mergedDaysOff = {
      ...((existing?.daysOff as Record<string, unknown>) ?? {}),
      ...(parsed.data.daysOff ?? {}),
    }
    const mergedStandby = {
      ...((existing?.standby as Record<string, unknown>) ?? {}),
      ...(parsed.data.standby ?? {}),
    }
    const mergedObjectives = {
      ...((existing?.objectives as Record<string, unknown>) ?? {}),
      ...(parsed.data.objectives ?? {}),
    }

    const set: Record<string, unknown> = {
      operatorId,
      userId,
      daysOff: mergedDaysOff,
      standby: mergedStandby,
      objectives: mergedObjectives,
      updatedAt: now,
    }

    if (parsed.data.carrierMode !== undefined) {
      set.carrierMode = parsed.data.carrierMode
    } else if (existing?.carrierMode !== undefined) {
      set.carrierMode = existing.carrierMode
    }
    if (parsed.data.destinationRules !== undefined) {
      set.destinationRules = parsed.data.destinationRules
    } else if (existing?.destinationRules !== undefined) {
      set.destinationRules = existing.destinationRules
    }

    await OperatorSchedulingConfig.updateOne(
      { operatorId, userId },
      { $set: set, $setOnInsert: { _id, createdAt } },
      { upsert: true },
    )

    const doc = await OperatorSchedulingConfig.findOne({ operatorId, userId }).lean()
    return doc
  })
}
