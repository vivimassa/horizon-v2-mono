import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { OperatorMessagingConfig } from '../models/OperatorMessagingConfig.js'
import { Operator } from '../models/Operator.js'

/**
 * 7.1.5.2 ACARS/MVT/LDM Transmission — admin config persistence.
 *
 *   GET  /operator-messaging-config?operatorId=…         → full doc
 *   PUT  /operator-messaging-config                      → upsert user-editable sections
 *   GET  /operator-messaging-config/inbound-token        → masked token + rotatedAt
 *   POST /operator-messaging-config/inbound-token/rotate → issue fresh token
 *   GET  /movement-messages/auto-transmit/status         → scheduler runtime state
 *
 * PUT + token rotate are gated by requireOpsRole (matches the
 * movement-messages write endpoints). Reads are open to any authenticated
 * user of the tenant.
 */

// ── Zod schemas ─────────────────────────────────────────────────────

const ACTION_CODES = ['AD', 'AA', 'ED', 'EA', 'NI', 'RR', 'FR'] as const

const autoTransmitSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMin: z.number().int().min(2).max(15).optional(),
    ageGateMin: z.number().int().min(0).max(10).optional(),
    actionAllow: z.array(z.enum(ACTION_CODES)).optional(),
    respectFilter: z.boolean().optional(),
  })
  .optional()

const validationSchema = z
  .object({
    rejectFutureTs: z.boolean().optional(),
    futureTsToleranceMin: z.number().int().min(0).max(60).optional(),
    rejectExcessiveDelay: z.boolean().optional(),
    delayThresholdHours: z.number().int().min(1).max(48).optional(),
    enforceSequence: z.boolean().optional(),
    touchAndGoGuardSec: z.number().int().min(0).max(600).optional(),
    blockTimeDiscrepancyPct: z.number().int().min(5).max(100).optional(),
    matchByReg: z.boolean().optional(),
  })
  .optional()

const overwriteSchema = z
  .object({
    acarsOverwriteManual: z.boolean().optional(),
    acarsOverwriteMvt: z.boolean().optional(),
    mvtOverwriteManual: z.boolean().optional(),
  })
  .optional()

// ── ASM/SSM (7.1.5.1) ───────────────────────────────────────────────

const ASM_ACTION_CODES = ['NEW', 'CNL', 'TIM', 'EQT', 'RPL', 'RRT', 'CON', 'RIN', 'FLT', 'SKD', 'ADM'] as const

const asmSsmGenerationSchema = z
  .object({
    asmEnabled: z.boolean().optional(),
    ssmEnabled: z.boolean().optional(),
    triggerOnCommit: z.boolean().optional(),
    triggerOnPlaygroundCommit: z.boolean().optional(),
    messageTypeAllow: z.array(z.enum(ASM_ACTION_CODES)).optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
  })
  .optional()

const asmSsmAutoReleaseSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMin: z.number().int().min(2).max(30).optional(),
    ageGateMin: z.number().int().min(0).max(60).optional(),
    actionAllow: z.array(z.enum(ASM_ACTION_CODES)).optional(),
  })
  .optional()

const asmSsmSchema = z
  .object({
    generation: asmSsmGenerationSchema,
    autoRelease: asmSsmAutoReleaseSchema,
  })
  .optional()

const upsertSchema = z.object({
  operatorId: z.string().min(1),
  autoTransmit: autoTransmitSchema,
  validation: validationSchema,
  overwrite: overwriteSchema,
  asmSsm: asmSsmSchema,
})

// Shared admin-write gate — matches movement-messages.ts pattern.
const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

function maskToken(token: string): string {
  if (token.length <= 8) return '••••••••'
  return `${token.slice(0, 4)}${'•'.repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`
}

export async function operatorMessagingConfigRoutes(app: FastifyInstance) {
  // ── GET config (returns 404 + client falls back to defaults) ──
  app.get('/operator-messaging-config', async (req, reply) => {
    const q = req.query as { operatorId?: string }
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const doc = await OperatorMessagingConfig.findOne({ operatorId: q.operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'No config for this operator' })
    return doc
  })

  // ── PUT config (upsert user-editable sections only) ──
  app.put('/operator-messaging-config', { preHandler: requireOpsRole }, async (req, reply) => {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = new Date().toISOString()
    const existing = await OperatorMessagingConfig.findOne({
      operatorId: parsed.data.operatorId,
    }).lean()
    const _id = (existing as { _id?: string } | null)?._id ?? crypto.randomUUID()
    const createdAt = (existing as { createdAt?: string } | null)?.createdAt ?? now

    // Preserve scheduler runtime state (lastRunAtUtc, counters) if it exists —
    // only write user-editable autoTransmit fields.
    const existingState = (existing as { autoTransmit?: Record<string, unknown> } | null)?.autoTransmit ?? {}
    const autoTransmitMerged = parsed.data.autoTransmit
      ? {
          ...existingState,
          ...parsed.data.autoTransmit,
        }
      : existingState

    // Same preservation pattern for asmSsm.autoRelease scheduler state.
    const existingAsmSsm =
      (
        existing as {
          asmSsm?: { generation?: Record<string, unknown>; autoRelease?: Record<string, unknown> }
        } | null
      )?.asmSsm ?? {}
    const existingAutoRelease = existingAsmSsm.autoRelease ?? {}
    const asmSsmMerged = parsed.data.asmSsm
      ? {
          generation: {
            ...(existingAsmSsm.generation ?? {}),
            ...(parsed.data.asmSsm.generation ?? {}),
          },
          autoRelease: {
            ...existingAutoRelease,
            ...(parsed.data.asmSsm.autoRelease ?? {}),
          },
        }
      : existingAsmSsm

    await OperatorMessagingConfig.updateOne(
      { operatorId: parsed.data.operatorId },
      {
        $set: {
          _id,
          operatorId: parsed.data.operatorId,
          autoTransmit: autoTransmitMerged,
          validation: parsed.data.validation ?? {},
          overwrite: parsed.data.overwrite ?? {},
          asmSsm: asmSsmMerged,
          createdAt,
          updatedAt: now,
        },
      },
      { upsert: true },
    )

    const doc = await OperatorMessagingConfig.findOne({
      operatorId: parsed.data.operatorId,
    }).lean()
    return doc
  })

  // ── GET inbound token (masked + rotatedAt) ──
  app.get('/operator-messaging-config/inbound-token', async (req, reply) => {
    if (!req.operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const op = (await Operator.findById(req.operatorId).lean()) as {
      inboundMessageToken?: string | null
      inboundMessageTokenRotatedAt?: string | null
    } | null
    if (!op) return reply.code(404).send({ error: 'Operator not found' })
    return {
      exists: Boolean(op.inboundMessageToken),
      masked: op.inboundMessageToken ? maskToken(op.inboundMessageToken) : null,
      rotatedAt: op.inboundMessageTokenRotatedAt ?? null,
    }
  })

  // ── POST rotate token (returns raw token ONCE) ──
  app.post('/operator-messaging-config/inbound-token/rotate', { preHandler: requireOpsRole }, async (req, reply) => {
    if (!req.operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const token = crypto.randomBytes(24).toString('base64url')
    const now = new Date().toISOString()
    await Operator.updateOne(
      { _id: req.operatorId },
      { $set: { inboundMessageToken: token, inboundMessageTokenRotatedAt: now } },
    )
    return { token, masked: maskToken(token), rotatedAt: now }
  })

  // ── GET scheduler status (for the Communication Deck armed banner) ──
  app.get('/movement-messages/auto-transmit/status', async (req, reply) => {
    if (!req.operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const cfg = (await OperatorMessagingConfig.findOne({ operatorId: req.operatorId }, { autoTransmit: 1 }).lean()) as {
      autoTransmit?: Record<string, unknown>
    } | null
    const a = (cfg?.autoTransmit ?? {}) as {
      enabled?: boolean
      intervalMin?: number
      lastRunAtUtc?: number | null
      lastMatched?: number
      lastSent?: number
      lastFailed?: number
    }
    const enabled = Boolean(a.enabled)
    const intervalMin = a.intervalMin ?? 5
    const lastRunAtUtc = a.lastRunAtUtc ?? null
    const nextRunAtUtc = enabled && lastRunAtUtc ? lastRunAtUtc + intervalMin * 60_000 : null
    return {
      enabled,
      intervalMin,
      lastRunAtUtc,
      nextRunAtUtc,
      lastMatched: a.lastMatched ?? 0,
      lastSent: a.lastSent ?? 0,
      lastFailed: a.lastFailed ?? 0,
    }
  })
}
