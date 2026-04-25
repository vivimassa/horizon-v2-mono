import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { TransportEmail } from '../models/TransportEmail.js'
import { CrewTransportVendor } from '../models/CrewTransportVendor.js'
import { OperatorHotacConfig } from '../models/OperatorHotacConfig.js'

/**
 * 4.1.8.2 Transport Email — held / released / sent state machine.
 *
 *   GET    /transport-emails?direction=&status=&vendorId=&threadId=&from=&to=
 *   GET    /transport-emails/held
 *   POST   /transport-emails              create
 *   PATCH  /transport-emails/:id          edit-while-held
 *   POST   /transport-emails/release      { ids[] }
 *   POST   /transport-emails/discard      { ids[] }
 *   POST   /transport-emails/inbound      webhook
 *
 * Mirrors hotel-emails.ts; reuses the operator's holdByDefault from
 * OperatorHotacConfig.email so the config screen gates both queues.
 */

const attachmentSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().nullable().optional(),
})

const createSchema = z.object({
  direction: z.enum(['outbound']).optional().default('outbound'),
  vendorId: z.string().nullable().optional(),
  vendorName: z.string().optional().default(''),
  tripIds: z.array(z.string()).max(200).optional().default([]),
  subject: z.string().max(300).optional().default(''),
  body: z.string().max(50_000).optional().default(''),
  recipients: z.array(z.string().email().or(z.string())).max(50).optional().default([]),
  attachments: z.array(attachmentSchema).max(20).optional().default([]),
  threadId: z.string().nullable().optional(),
  status: z.enum(['draft', 'held']).optional(),
})

const patchSchema = z.object({
  subject: z.string().max(300).optional(),
  body: z.string().max(50_000).optional(),
  recipients: z.array(z.string().min(1)).max(50).optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
  tripIds: z.array(z.string()).max(200).optional(),
  vendorId: z.string().nullable().optional(),
  vendorName: z.string().optional(),
})

const releaseSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

const discardSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

const inboundSchema = z.object({
  vendorId: z.string().nullable().optional(),
  fromAddress: z.string().min(1).max(200),
  subject: z.string().max(300).optional().default(''),
  body: z.string().max(100_000).optional().default(''),
  rawSource: z.string().max(200_000).optional().default(''),
  threadId: z.string().nullable().optional(),
})

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

export async function transportEmailRoutes(app: FastifyInstance) {
  // ── List ──
  app.get('/transport-emails', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const q = req.query as {
      direction?: 'outbound' | 'inbound'
      status?: string
      vendorId?: string
      threadId?: string
      from?: string
      to?: string
    }

    const filter: Record<string, unknown> = { operatorId }
    if (q.direction) filter.direction = q.direction
    if (q.status) filter.status = q.status
    if (q.vendorId) filter.vendorId = q.vendorId
    if (q.threadId) filter.threadId = q.threadId
    if (q.from || q.to) {
      const range: Record<string, number> = {}
      if (q.from) {
        const ms = Date.parse(q.from)
        if (Number.isFinite(ms)) range.$gte = ms
      }
      if (q.to) {
        const ms = Date.parse(q.to)
        if (Number.isFinite(ms)) range.$lte = ms + 86_400_000
      }
      if (Object.keys(range).length > 0) filter.updatedAtUtcMs = range
    }

    const docs = await TransportEmail.find(filter).sort({ updatedAtUtcMs: -1 }).limit(500).lean()
    return docs
  })

  // ── List held outbound ──
  app.get('/transport-emails/held', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const docs = await TransportEmail.find({ operatorId, status: 'held', direction: 'outbound' })
      .sort({ updatedAtUtcMs: -1 })
      .lean()
    return docs
  })

  // ── Create ──
  app.post('/transport-emails', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const cfg = await OperatorHotacConfig.findOne({ operatorId }).lean()
    const holdByDefault = (cfg?.email?.holdByDefault ?? true) as boolean
    const initialStatus = parsed.data.status ?? (holdByDefault ? 'held' : 'draft')

    const now = Date.now()
    const userId = req.userId ?? null
    const _id = crypto.randomUUID()
    const threadId = parsed.data.threadId ?? _id

    const doc = await TransportEmail.create({
      _id,
      operatorId,
      direction: 'outbound',
      status: initialStatus,
      vendorId: parsed.data.vendorId ?? null,
      vendorName: parsed.data.vendorName,
      tripIds: parsed.data.tripIds,
      subject: parsed.data.subject,
      body: parsed.data.body,
      recipients: parsed.data.recipients,
      attachments: parsed.data.attachments,
      threadId,
      heldAtUtcMs: initialStatus === 'held' ? now : null,
      heldByUserId: initialStatus === 'held' ? userId : null,
      createdAtUtcMs: now,
      updatedAtUtcMs: now,
      createdByUserId: userId,
    })

    return doc.toObject()
  })

  // ── Patch ──
  app.patch('/transport-emails/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const existing = (await TransportEmail.findOne({ _id: id, operatorId }).lean()) as Record<string, unknown> | null
    if (!existing) return reply.code(404).send({ error: 'Email not found' })

    const status = existing.status as string
    if (status !== 'draft' && status !== 'held') {
      return reply.code(409).send({ error: `Cannot edit email in status '${status}'` })
    }

    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const set = { ...parsed.data, updatedAtUtcMs: Date.now() }
    const result = await TransportEmail.findOneAndUpdate({ _id: id, operatorId }, { $set: set }, { new: true }).lean()
    return result
  })

  // ── Release ──
  app.post('/transport-emails/release', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = releaseSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const userId = req.userId ?? null
    let released = 0
    let skipped = 0

    for (const id of parsed.data.ids) {
      const doc = (await TransportEmail.findOne({ _id: id, operatorId }).lean()) as Record<string, unknown> | null
      if (!doc) {
        skipped += 1
        continue
      }
      if (doc.status !== 'held' && doc.status !== 'draft') {
        skipped += 1
        continue
      }

      let recipients = (doc.recipients as string[] | undefined) ?? []
      if (recipients.length === 0 && doc.vendorId) {
        const vendor = (await CrewTransportVendor.findOne({ _id: doc.vendorId, operatorId }).lean()) as Record<
          string,
          unknown
        > | null
        const emails = (vendor?.emails as Array<{ address?: string }> | undefined) ?? []
        recipients = emails.map((e) => e.address ?? '').filter((s) => s.length > 0)
      }

      if (recipients.length === 0) {
        await TransportEmail.updateOne(
          { _id: id, operatorId },
          {
            $set: {
              status: 'failed',
              releasedAtUtcMs: now,
              releasedByUserId: userId,
              updatedAtUtcMs: now,
              deliveries: [],
            },
          },
        )
        skipped += 1
        continue
      }

      const deliveries = recipients.map((r) => ({
        recipient: r,
        status: 'pending' as const,
        attemptCount: 0,
        lastAttemptAtUtcMs: null,
        deliveredAtUtcMs: null,
        errorDetail: null,
        externalRef: null,
      }))

      await TransportEmail.updateOne(
        { _id: id, operatorId },
        {
          $set: {
            status: 'pending',
            recipients,
            deliveries,
            releasedAtUtcMs: now,
            releasedByUserId: userId,
            updatedAtUtcMs: now,
          },
        },
      )
      released += 1
    }

    return { released, skipped }
  })

  // ── Discard ──
  app.post('/transport-emails/discard', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = discardSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const userId = req.userId ?? null

    const result = await TransportEmail.updateMany(
      { _id: { $in: parsed.data.ids }, operatorId, status: { $in: ['draft', 'held'] } },
      {
        $set: {
          status: 'discarded',
          discardedAtUtcMs: now,
          discardedByUserId: userId,
          updatedAtUtcMs: now,
        },
      },
    )

    return { discarded: result.modifiedCount ?? 0 }
  })

  // ── Inbound webhook ──
  app.post('/transport-emails/inbound', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = inboundSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const _id = crypto.randomUUID()
    const threadId = parsed.data.threadId ?? _id

    const doc = await TransportEmail.create({
      _id,
      operatorId,
      direction: 'inbound',
      status: 'received',
      vendorId: parsed.data.vendorId ?? null,
      vendorName: '',
      tripIds: [],
      subject: parsed.data.subject,
      body: parsed.data.body,
      recipients: [parsed.data.fromAddress],
      attachments: [],
      rawSource: parsed.data.rawSource,
      threadId,
      createdAtUtcMs: now,
      updatedAtUtcMs: now,
    })

    return doc.toObject()
  })
}
