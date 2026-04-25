import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { CrewFlightBooking } from '../models/CrewFlightBooking.js'
import { CarrierCode } from '../models/CarrierCode.js'
import {
  persistFlightBookingAttachment,
  deleteFlightBookingAttachmentFile,
} from '../services/crew-flight-attachments.js'

/**
 * 4.1.8.2 Crew Flight Bookings — deadhead positioning persistence.
 *
 *   GET    /crew-flight-bookings?from=&to=&pairingId=&status[]=&method[]=
 *   POST   /crew-flight-bookings                  create (ticket | gendec)
 *   PATCH  /crew-flight-bookings/:id              edit; method swap allowed only when status='pending'
 *   POST   /crew-flight-bookings/:id/cancel       → status='cancelled'
 *   DELETE /crew-flight-bookings/:id              hard delete (only when status='pending')
 *
 *   POST   /crew-flight-bookings/:id/attachments  multipart upload (image|PDF)
 *   DELETE /crew-flight-bookings/:id/attachments/:attachmentId
 */

const STATUSES = ['pending', 'booked', 'confirmed', 'cancelled'] as const
const METHODS = ['ticket', 'gendec'] as const
const GENDEC_POSITIONS = ['cockpit-jumpseat', 'cabin-jumpseat', 'pax-seat'] as const
const BOOKING_CLASSES = ['Y', 'J', 'F', 'C', 'W'] as const

const baseFields = z.object({
  pairingId: z.string().min(1),
  legId: z.string().min(1),
  pairingCode: z.string().optional().default(''),
  crewIds: z.array(z.string()).max(50).optional().default([]),
  notes: z.string().nullable().optional(),
})

const ticketFields = z.object({
  carrierCode: z.string().min(1),
  flightNumber: z.string().nullable().optional(),
  flightDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'flightDate must be YYYY-MM-DD')
    .nullable()
    .optional(),
  depStation: z.string().nullable().optional(),
  arrStation: z.string().nullable().optional(),
  bookingClass: z.enum(BOOKING_CLASSES).nullable().optional(),
  pnr: z.string().nullable().optional(),
  ticketNumbers: z.array(z.string()).max(20).optional().default([]),
  fareCost: z.number().nullable().optional(),
  fareCurrency: z.string().optional().default('USD'),
})

const createSchema = z.discriminatedUnion('method', [
  baseFields.extend({ method: z.literal('ticket') }).merge(ticketFields),
  baseFields.extend({
    method: z.literal('gendec'),
    gendecPosition: z.enum(GENDEC_POSITIONS),
    /** Carrier defaults to operator IATA on the client; optional here. */
    carrierCode: z.string().nullable().optional(),
    flightNumber: z.string().nullable().optional(),
    flightDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'flightDate must be YYYY-MM-DD')
      .nullable()
      .optional(),
    depStation: z.string().nullable().optional(),
    arrStation: z.string().nullable().optional(),
  }),
])

const patchSchema = z.object({
  method: z.enum(METHODS).optional(),
  carrierCode: z.string().nullable().optional(),
  flightNumber: z.string().nullable().optional(),
  flightDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  depStation: z.string().nullable().optional(),
  arrStation: z.string().nullable().optional(),
  bookingClass: z.enum(BOOKING_CLASSES).nullable().optional(),
  pnr: z.string().nullable().optional(),
  ticketNumbers: z.array(z.string()).max(20).optional(),
  fareCost: z.number().nullable().optional(),
  fareCurrency: z.string().optional(),
  gendecPosition: z.enum(GENDEC_POSITIONS).nullable().optional(),
  crewIds: z.array(z.string()).max(50).optional(),
  status: z.enum(STATUSES).optional(),
  notes: z.string().nullable().optional(),
})

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

async function carrierExists(operatorId: string, code: string): Promise<boolean> {
  if (!code) return false
  const c = await CarrierCode.findOne({
    operatorId,
    $or: [{ iataCode: code.toUpperCase() }, { icaoCode: code.toUpperCase() }],
    isActive: { $ne: false },
  }).lean()
  return !!c
}

export async function crewFlightBookingRoutes(app: FastifyInstance) {
  // ── List ──
  app.get('/crew-flight-bookings', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const q = req.query as {
      from?: string
      to?: string
      pairingId?: string
      status?: string | string[]
      method?: string | string[]
    }

    const filter: Record<string, unknown> = { operatorId }
    if (q.pairingId) filter.pairingId = q.pairingId
    if (q.status) {
      const arr = Array.isArray(q.status) ? q.status : [q.status]
      if (arr.length > 0) filter.status = { $in: arr }
    }
    if (q.method) {
      const arr = Array.isArray(q.method) ? q.method : [q.method]
      if (arr.length > 0) filter.method = { $in: arr }
    }
    if (q.from || q.to) {
      // Filter by flightDate string range — works because YYYY-MM-DD sorts lex.
      const range: Record<string, string> = {}
      if (q.from) range.$gte = q.from.slice(0, 10)
      if (q.to) range.$lte = q.to.slice(0, 10)
      if (Object.keys(range).length > 0) filter.flightDate = range
    }

    return CrewFlightBooking.find(filter).sort({ flightDate: 1, updatedAtUtcMs: -1 }).lean()
  })

  // ── Create ──
  app.post('/crew-flight-bookings', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    // Carrier-code FK enforcement when method='ticket'.
    if (parsed.data.method === 'ticket') {
      const ok = await carrierExists(operatorId, parsed.data.carrierCode)
      if (!ok) {
        return reply
          .code(400)
          .send({ error: `Carrier code '${parsed.data.carrierCode}' not found in /admin/carrier-codes` })
      }
    } else if (parsed.data.method === 'gendec' && parsed.data.carrierCode) {
      // Optional carrier on GENDEC — but if provided, must be a real one.
      const ok = await carrierExists(operatorId, parsed.data.carrierCode)
      if (!ok) {
        return reply.code(400).send({ error: `Carrier code '${parsed.data.carrierCode}' not found` })
      }
    }

    const now = Date.now()
    const userId = req.userId ?? null
    const _id = crypto.randomUUID()

    try {
      const doc = await CrewFlightBooking.create({
        _id,
        operatorId,
        pairingId: parsed.data.pairingId,
        legId: parsed.data.legId,
        pairingCode: parsed.data.pairingCode,
        crewIds: parsed.data.crewIds,
        method: parsed.data.method,
        carrierCode:
          parsed.data.method === 'ticket'
            ? parsed.data.carrierCode.toUpperCase()
            : (parsed.data.carrierCode?.toUpperCase() ?? null),
        flightNumber: parsed.data.flightNumber ?? null,
        flightDate: parsed.data.flightDate ?? null,
        depStation: parsed.data.depStation ?? null,
        arrStation: parsed.data.arrStation ?? null,
        bookingClass: parsed.data.method === 'ticket' ? (parsed.data.bookingClass ?? null) : null,
        pnr: parsed.data.method === 'ticket' ? (parsed.data.pnr ?? null) : null,
        ticketNumbers: parsed.data.method === 'ticket' ? parsed.data.ticketNumbers : [],
        fareCost: parsed.data.method === 'ticket' ? (parsed.data.fareCost ?? null) : null,
        fareCurrency: parsed.data.method === 'ticket' ? parsed.data.fareCurrency : 'USD',
        gendecPosition: parsed.data.method === 'gendec' ? parsed.data.gendecPosition : null,
        notes: parsed.data.notes ?? null,
        status: 'booked',
        bookedAtUtcMs: now,
        bookedByUserId: userId,
        createdAtUtcMs: now,
        updatedAtUtcMs: now,
        createdByUserId: userId,
      })
      return doc.toObject()
    } catch (err) {
      // Likely E11000 dup-key on (pairingId, legId).
      if (err instanceof Error && /E11000/.test(err.message)) {
        return reply.code(409).send({ error: 'A booking already exists for this leg' })
      }
      throw err
    }
  })

  // ── Patch ──
  app.patch('/crew-flight-bookings/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const existing = (await CrewFlightBooking.findOne({ _id: id, operatorId }).lean()) as Record<string, unknown> | null
    if (!existing) return reply.code(404).send({ error: 'Booking not found' })

    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    // Method swap is only allowed before the booking has a confirmation.
    if (parsed.data.method && parsed.data.method !== existing.method) {
      if (existing.status !== 'pending' && existing.status !== 'booked') {
        return reply.code(409).send({ error: `Cannot change method on booking in status '${existing.status}'` })
      }
    }

    // Carrier FK validation on patch.
    const finalMethod = parsed.data.method ?? (existing.method as string)
    const finalCarrier =
      parsed.data.carrierCode !== undefined ? parsed.data.carrierCode : (existing.carrierCode as string | null)

    if (finalMethod === 'ticket') {
      if (!finalCarrier) {
        return reply.code(400).send({ error: 'carrierCode is required when method=ticket' })
      }
      const ok = await carrierExists(operatorId, finalCarrier)
      if (!ok) {
        return reply.code(400).send({ error: `Carrier code '${finalCarrier}' not found` })
      }
    }

    const set: Record<string, unknown> = {
      ...parsed.data,
      ...(parsed.data.carrierCode != null ? { carrierCode: parsed.data.carrierCode.toUpperCase() } : {}),
      updatedAtUtcMs: Date.now(),
    }

    const result = await CrewFlightBooking.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: set },
      { new: true },
    ).lean()
    return result
  })

  // ── Cancel ──
  app.post('/crew-flight-bookings/:id/cancel', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const now = Date.now()
    const result = await CrewFlightBooking.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { status: 'cancelled', cancelledAtUtcMs: now, updatedAtUtcMs: now } },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Booking not found' })
    return result
  })

  // ── Hard delete (only when pending) ──
  app.delete('/crew-flight-bookings/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const existing = (await CrewFlightBooking.findOne({ _id: id, operatorId }).lean()) as Record<string, unknown> | null
    if (!existing) return reply.code(404).send({ error: 'Booking not found' })
    if (existing.status !== 'pending') {
      return reply.code(409).send({ error: 'Only pending bookings can be deleted; cancel instead' })
    }

    // Best-effort attachment cleanup on disk.
    const atts = (existing.attachments as Array<{ url?: string }> | undefined) ?? []
    for (const a of atts) {
      if (a.url) {
        deleteFlightBookingAttachmentFile({ operatorId, bookingId: id, attachmentUrl: a.url })
      }
    }
    await CrewFlightBooking.deleteOne({ _id: id, operatorId })
    return { success: true }
  })

  // ── Upload attachment (image | PDF) ──
  app.post('/crew-flight-bookings/:id/attachments', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const existing = await CrewFlightBooking.findOne({ _id: id, operatorId }).lean()
    if (!existing) return reply.code(404).send({ error: 'Booking not found' })

    const mp = await req.file()
    if (!mp) return reply.code(400).send({ error: 'No file uploaded' })

    try {
      const att = await persistFlightBookingAttachment(mp, {
        operatorId,
        bookingId: id,
        uploadedBy: req.userId ?? null,
      })
      const result = await CrewFlightBooking.findOneAndUpdate(
        { _id: id, operatorId },
        { $push: { attachments: att }, $set: { updatedAtUtcMs: Date.now() } },
        { new: true },
      ).lean()
      return reply.code(201).send(result)
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message })
    }
  })

  // ── Delete attachment ──
  app.delete(
    '/crew-flight-bookings/:id/attachments/:attachmentId',
    { preHandler: requireOpsRole },
    async (req, reply) => {
      const operatorId = req.operatorId
      const { id, attachmentId } = req.params as { id: string; attachmentId: string }
      if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

      const existing = (await CrewFlightBooking.findOne({ _id: id, operatorId }).lean()) as Record<
        string,
        unknown
      > | null
      if (!existing) return reply.code(404).send({ error: 'Booking not found' })

      const atts = (existing.attachments as Array<{ _id?: string; url?: string }> | undefined) ?? []
      const target = atts.find((a) => a._id === attachmentId)
      if (!target) return reply.code(404).send({ error: 'Attachment not found' })

      if (target.url) {
        deleteFlightBookingAttachmentFile({ operatorId, bookingId: id, attachmentUrl: target.url })
      }

      const result = await CrewFlightBooking.findOneAndUpdate(
        { _id: id, operatorId },
        { $pull: { attachments: { _id: attachmentId } }, $set: { updatedAtUtcMs: Date.now() } },
        { new: true },
      ).lean()
      return result
    },
  )
}
