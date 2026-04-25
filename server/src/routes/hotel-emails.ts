import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { HotelEmail } from '../models/HotelEmail.js'
import { CrewHotel } from '../models/CrewHotel.js'
import { OperatorHotacConfig } from '../models/OperatorHotacConfig.js'

/**
 * 4.1.8.1 Hotel Email — held / released / sent state machine.
 *
 *   GET    /hotel-emails?direction=&status=&hotelId=&threadId=&from=&to=
 *   GET    /hotel-emails/held         → outbound held only (default Communication view)
 *   POST   /hotel-emails              create — body picks initial status (draft|held)
 *   PATCH  /hotel-emails/:id          edit-while-held; 409 once status > held
 *   POST   /hotel-emails/release      { ids[] } → status='pending', deliveries[] populated
 *   POST   /hotel-emails/discard      { ids[] } → status='discarded'
 *   POST   /hotel-emails/inbound      webhook: { hotelId?, fromAddress, subject, body, threadId? }
 *
 * Pattern mirrors ScheduleMessageLog routes — but transport is plain SMTP.
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
  hotelId: z.string().nullable().optional(),
  hotelName: z.string().optional().default(''),
  bookingIds: z.array(z.string()).max(200).optional().default([]),
  subject: z.string().max(300).optional().default(''),
  body: z.string().max(50_000).optional().default(''),
  recipients: z.array(z.string().email().or(z.string())).max(50).optional().default([]),
  attachments: z.array(attachmentSchema).max(20).optional().default([]),
  threadId: z.string().nullable().optional(),
  /** Initial status — 'draft' or 'held'. Defaults to held when operator config has holdByDefault. */
  status: z.enum(['draft', 'held']).optional(),
})

const patchSchema = z.object({
  subject: z.string().max(300).optional(),
  body: z.string().max(50_000).optional(),
  recipients: z.array(z.string().min(1)).max(50).optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
  bookingIds: z.array(z.string()).max(200).optional(),
  hotelId: z.string().nullable().optional(),
  hotelName: z.string().optional(),
})

const releaseSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

const discardSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

const inboundSchema = z.object({
  hotelId: z.string().nullable().optional(),
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

export async function hotelEmailRoutes(app: FastifyInstance) {
  // ── List ──
  app.get('/hotel-emails', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const q = req.query as {
      direction?: 'outbound' | 'inbound'
      status?: string
      hotelId?: string
      threadId?: string
      from?: string
      to?: string
    }

    const filter: Record<string, unknown> = { operatorId }
    if (q.direction) filter.direction = q.direction
    if (q.status) filter.status = q.status
    if (q.hotelId) filter.hotelId = q.hotelId
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

    const docs = await HotelEmail.find(filter).sort({ updatedAtUtcMs: -1 }).limit(500).lean()
    return docs
  })

  // ── List held outbound (Communication view default) ──
  app.get('/hotel-emails/held', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const docs = await HotelEmail.find({ operatorId, status: 'held', direction: 'outbound' })
      .sort({ updatedAtUtcMs: -1 })
      .lean()
    return docs
  })

  // ── Create ──
  app.post('/hotel-emails', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    // Default status = config.email.holdByDefault ? 'held' : 'draft'
    const cfg = await OperatorHotacConfig.findOne({ operatorId }).lean()
    const holdByDefault = (cfg?.email?.holdByDefault ?? true) as boolean
    const initialStatus = parsed.data.status ?? (holdByDefault ? 'held' : 'draft')

    const now = Date.now()
    const userId = req.userId ?? null
    const _id = crypto.randomUUID()
    const threadId = parsed.data.threadId ?? _id

    const doc = await HotelEmail.create({
      _id,
      operatorId,
      direction: 'outbound',
      status: initialStatus,
      hotelId: parsed.data.hotelId ?? null,
      hotelName: parsed.data.hotelName,
      bookingIds: parsed.data.bookingIds,
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

  // ── Patch (edit while draft|held only) ──
  app.patch('/hotel-emails/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const existing = (await HotelEmail.findOne({ _id: id, operatorId }).lean()) as Record<string, unknown> | null
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
    const result = await HotelEmail.findOneAndUpdate({ _id: id, operatorId }, { $set: set }, { new: true }).lean()
    return result
  })

  // ── Release (held → pending, fan-out recipients[] into deliveries[]) ──
  app.post('/hotel-emails/release', { preHandler: requireOpsRole }, async (req, reply) => {
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
      const doc = (await HotelEmail.findOne({ _id: id, operatorId }).lean()) as Record<string, unknown> | null
      if (!doc) {
        skipped += 1
        continue
      }
      if (doc.status !== 'held' && doc.status !== 'draft') {
        skipped += 1
        continue
      }

      // Resolve recipients: prefer the email's own recipients[], else hotel master data emails.
      let recipients = (doc.recipients as string[] | undefined) ?? []
      if (recipients.length === 0 && doc.hotelId) {
        const hotel = (await CrewHotel.findOne({ _id: doc.hotelId, operatorId }).lean()) as Record<
          string,
          unknown
        > | null
        const emails = (hotel?.emails as Array<{ address?: string }> | undefined) ?? []
        recipients = emails.map((e) => e.address ?? '').filter((s) => s.length > 0)
      }

      if (recipients.length === 0) {
        // Mark as failed — nothing to send to.
        await HotelEmail.updateOne(
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

      await HotelEmail.updateOne(
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

  // ── Discard (held → discarded) ──
  app.post('/hotel-emails/discard', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = discardSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const userId = req.userId ?? null

    const result = await HotelEmail.updateMany(
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

  // ── Inbound webhook (hotel reply) ──
  app.post('/hotel-emails/inbound', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = inboundSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const _id = crypto.randomUUID()
    const threadId = parsed.data.threadId ?? _id

    const doc = await HotelEmail.create({
      _id,
      operatorId,
      direction: 'inbound',
      status: 'received',
      hotelId: parsed.data.hotelId ?? null,
      hotelName: '',
      bookingIds: [],
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
