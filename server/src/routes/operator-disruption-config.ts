import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { OperatorDisruptionConfig } from '../models/OperatorDisruptionConfig.js'

// ── Zod schema for PUT payload. All sections optional; missing = defaults. ──

const slaSchema = z
  .object({
    critical: z.number().int().positive().nullable().optional(),
    warning: z.number().int().positive().nullable().optional(),
    info: z.number().int().positive().nullable().optional(),
  })
  .optional()

const uiSchema = z
  .object({
    defaultFeedStatus: z
      .enum(['active', 'open', 'assigned', 'in_progress', 'resolved', 'closed', 'all'])
      .nullable()
      .optional(),
    rollingPeriodStops: z.array(z.number().int().positive()).optional(),
    openBacklogThreshold: z.number().int().positive().nullable().optional(),
  })
  .optional()

const resolutionTypeSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().default(''),
  enabled: z.boolean().default(true),
})

const vocabularySchema = z
  .object({
    categoryLabels: z.record(z.string(), z.string()).optional(),
    statusLabels: z.record(z.string(), z.string()).optional(),
    resolutionTypes: z.array(resolutionTypeSchema).optional(),
  })
  .optional()

const upsertSchema = z.object({
  operatorId: z.string().min(1),
  sla: slaSchema,
  ui: uiSchema,
  vocabulary: vocabularySchema,
  refresh: z.unknown().optional(),
  notifications: z.unknown().optional(),
  coverage: z.unknown().optional(),
  overrides: z.unknown().optional(),
})

export async function operatorDisruptionConfigRoutes(app: FastifyInstance) {
  // ── GET /operator-disruption-config?operatorId=… ──
  // Returns config doc if present; 404 → client uses hardcoded defaults.
  app.get('/operator-disruption-config', async (req, reply) => {
    const q = req.query as { operatorId?: string }
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const doc = await OperatorDisruptionConfig.findOne({ operatorId: q.operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'No config for this operator' })
    return doc
  })

  // ── PUT /operator-disruption-config ──
  // Upsert — single destructive overwrite. Keeps server logic trivial.
  app.put('/operator-disruption-config', async (req, reply) => {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = new Date().toISOString()
    const existing = await OperatorDisruptionConfig.findOne({ operatorId: parsed.data.operatorId }).lean()
    const _id = (existing as { _id?: string } | null)?._id ?? crypto.randomUUID()
    const createdAt = (existing as { createdAt?: string } | null)?.createdAt ?? now

    await OperatorDisruptionConfig.updateOne(
      { operatorId: parsed.data.operatorId },
      {
        $set: {
          _id,
          operatorId: parsed.data.operatorId,
          sla: parsed.data.sla,
          ui: parsed.data.ui,
          vocabulary: parsed.data.vocabulary,
          refresh: parsed.data.refresh,
          notifications: parsed.data.notifications,
          coverage: parsed.data.coverage,
          overrides: parsed.data.overrides,
          createdAt,
          updatedAt: now,
        },
      },
      { upsert: true },
    )

    const doc = await OperatorDisruptionConfig.findOne({ operatorId: parsed.data.operatorId }).lean()
    return doc
  })
}
