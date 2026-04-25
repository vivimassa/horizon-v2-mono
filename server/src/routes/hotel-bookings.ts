import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { HotelBooking } from '../models/HotelBooking.js'

/**
 * 4.1.8.1 Crew Hotel Management — booking persistence.
 *
 *   GET    /hotel-bookings?from=…&to=…&station[]=…&status[]=…
 *   POST   /hotel-bookings/upsert-batch    body: { rows: DerivedBooking[] }
 *   POST   /hotel-bookings                 body: ad-hoc manual booking
 *   PATCH  /hotel-bookings/:id             partial edit (rooms, notes, status, …)
 *   POST   /hotel-bookings/:id/check-in    { at?, by? }
 *   POST   /hotel-bookings/:id/check-out   { at? }
 *   POST   /hotel-bookings/:id/no-show
 *   DELETE /hotel-bookings/:id             soft-delete → status='cancelled'
 *
 * Tenant-scoped by `req.operatorId`. Write actions gated by ops role.
 */

const BOOKING_STATUSES = [
  'demand',
  'forecast',
  'pending',
  'sent',
  'confirmed',
  'in-house',
  'departed',
  'cancelled',
  'no-show',
] as const

const DISRUPTION_FLAGS = [
  'inbound-cancelled',
  'outbound-cancelled',
  'inbound-delayed',
  'outbound-delayed',
  'extend-night',
  'overdue-confirmation',
] as const

const derivedRowSchema = z.object({
  pairingId: z.string().min(1),
  pairingCode: z.string().optional().default(''),
  airportIcao: z.string().min(3).max(4),
  layoverNightUtcMs: z.number(),
  arrFlight: z.string().nullable().optional(),
  arrStaUtcIso: z.string().nullable().optional(),
  depFlight: z.string().nullable().optional(),
  depStdUtcIso: z.string().nullable().optional(),
  layoverHours: z.number().optional().default(0),
  hotelId: z.string().nullable().optional(),
  hotelName: z.string().optional().default(''),
  hotelPriority: z.number().nullable().optional(),
  hotelDistance: z.number().nullable().optional(),
  rooms: z.number().int().min(0).optional().default(0),
  occupancy: z.enum(['single', 'double']).optional().default('single'),
  pax: z.number().int().min(0).optional().default(0),
  crewByPosition: z.record(z.string(), z.number()).optional().default({}),
  crewIds: z.array(z.string()).optional().default([]),
  costMinor: z.number().optional().default(0),
  costCurrency: z.string().optional().default('USD'),
  shuttle: z.enum(['Y', 'N', 'walking']).nullable().optional(),
})

const upsertBatchSchema = z.object({
  rows: z.array(derivedRowSchema).max(2000),
  /** Fingerprint for the run; used as `sourceRunId` on inserts. */
  runId: z.string().optional(),
})

const patchSchema = z.object({
  rooms: z.number().int().min(0).max(500).optional(),
  occupancy: z.enum(['single', 'double']).optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  confirmationNumber: z.string().nullable().optional(),
  hotelId: z.string().nullable().optional(),
  hotelName: z.string().optional(),
  contractId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  costMinor: z.number().optional(),
  costCurrency: z.string().optional(),
  shuttle: z.enum(['Y', 'N', 'walking']).nullable().optional(),
  disruptionFlags: z.array(z.enum(DISRUPTION_FLAGS)).optional(),
})

const createSchema = z.object({
  pairingId: z.string().min(1),
  pairingCode: z.string().optional().default(''),
  airportIcao: z.string().min(3).max(4),
  layoverNightUtcMs: z.number(),
  hotelId: z.string().nullable().optional(),
  hotelName: z.string().optional().default(''),
  rooms: z.number().int().min(0).max(500).optional().default(0),
  occupancy: z.enum(['single', 'double']).optional().default('single'),
  notes: z.string().nullable().optional(),
})

const checkInSchema = z
  .object({
    at: z.number().optional(),
    by: z.enum(['crew', 'hotac', 'hotel']).optional(),
  })
  .optional()

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

/** Fields the planner is allowed to edit. The upsert-batch path leaves
 *  these alone when they already differ from the derived defaults. */
const MANUAL_OVERRIDABLE_FIELDS = [
  'status',
  'confirmationNumber',
  'contractId',
  'notes',
  'costMinor',
  'costCurrency',
  'hotelId',
  'hotelName',
  'shuttle',
] as const

/** Statuses that indicate the planner has progressed the booking past
 *  the pre-Enlist demand state — never overwrite these. */
const STICKY_STATUSES = new Set(['pending', 'sent', 'confirmed', 'in-house', 'departed', 'cancelled', 'no-show'])

export async function hotelBookingRoutes(app: FastifyInstance) {
  // ── List ──
  app.get('/hotel-bookings', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const q = req.query as {
      from?: string
      to?: string
      station?: string | string[]
      status?: string | string[]
    }

    const filter: Record<string, unknown> = { operatorId }
    if (q.from || q.to) {
      const range: Record<string, number> = {}
      if (q.from) {
        const fromMs = Date.parse(q.from)
        if (Number.isFinite(fromMs)) range.$gte = fromMs
      }
      if (q.to) {
        const toMs = Date.parse(q.to)
        if (Number.isFinite(toMs)) range.$lte = toMs + 86_400_000 // include the whole `to` day
      }
      if (Object.keys(range).length > 0) filter.layoverNightUtcMs = range
    }
    if (q.station) {
      const arr = Array.isArray(q.station) ? q.station : [q.station]
      if (arr.length > 0) filter.airportIcao = { $in: arr }
    }
    if (q.status) {
      const arr = Array.isArray(q.status) ? q.status : [q.status]
      if (arr.length > 0) filter.status = { $in: arr }
    }

    const docs = await HotelBooking.find(filter).lean()
    return docs
  })

  // ── Bulk upsert from derivation ──
  app.post('/hotel-bookings/upsert-batch', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = upsertBatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const runId = parsed.data.runId ?? crypto.randomUUID()
    const userId = req.userId ?? null

    let upserted = 0
    let preservedManual = 0
    const upsertedDocs: unknown[] = []

    for (const row of parsed.data.rows) {
      const key = {
        operatorId,
        pairingId: row.pairingId,
        airportIcao: row.airportIcao,
        layoverNightUtcMs: row.layoverNightUtcMs,
      }

      const existing = (await HotelBooking.findOne(key).lean()) as Record<string, unknown> | null

      // Build the derived patch — fields safe to overwrite from a fresh
      // Crew Schedule fetch (pairing context, crew composition, hotel match).
      const derivedFields: Record<string, unknown> = {
        pairingCode: row.pairingCode,
        arrFlight: row.arrFlight ?? null,
        arrStaUtcIso: row.arrStaUtcIso ?? null,
        depFlight: row.depFlight ?? null,
        depStdUtcIso: row.depStdUtcIso ?? null,
        layoverHours: row.layoverHours,
        hotelPriority: row.hotelPriority ?? null,
        hotelDistance: row.hotelDistance ?? null,
        pax: row.pax,
        rooms: row.rooms,
        occupancy: row.occupancy,
        crewByPosition: row.crewByPosition,
        crewIds: row.crewIds,
        updatedAtUtcMs: now,
      }

      if (existing) {
        // Preserve manual edits — never overwrite a "sticky" status, and keep
        // any field on the manual-overridable list that's already non-default.
        if (!STICKY_STATUSES.has(existing.status as string)) {
          // Pre-Enlist row → safe to refresh status from derivation (always
          // 'demand' from the client). Don't downgrade 'forecast' though —
          // that's what Enlist sets and it's a manual signal.
          if (existing.status !== 'forecast') {
            // existing 'demand' → leave as 'demand'
            derivedFields.status = 'demand'
          }
        } else {
          preservedManual += 1
        }

        // Hotel/contract/cost: only overwrite when the planner hasn't picked
        // a different hotel manually.
        const planSetHotel =
          existing.hotelId &&
          row.hotelId !== null &&
          existing.hotelId !== row.hotelId &&
          STICKY_STATUSES.has(existing.status as string)
        if (!planSetHotel) {
          derivedFields.hotelId = row.hotelId ?? null
          derivedFields.hotelName = row.hotelName
          derivedFields.costMinor = row.costMinor
          derivedFields.costCurrency = row.costCurrency
          if (row.shuttle !== undefined) derivedFields.shuttle = row.shuttle
        }

        await HotelBooking.updateOne(key, { $set: derivedFields })
      } else {
        const doc = {
          _id: crypto.randomUUID(),
          operatorId,
          pairingId: row.pairingId,
          airportIcao: row.airportIcao,
          layoverNightUtcMs: row.layoverNightUtcMs,
          pairingCode: row.pairingCode,
          arrFlight: row.arrFlight ?? null,
          arrStaUtcIso: row.arrStaUtcIso ?? null,
          depFlight: row.depFlight ?? null,
          depStdUtcIso: row.depStdUtcIso ?? null,
          layoverHours: row.layoverHours,
          hotelId: row.hotelId ?? null,
          hotelName: row.hotelName,
          hotelPriority: row.hotelPriority ?? null,
          hotelDistance: row.hotelDistance ?? null,
          contractId: null,
          rooms: row.rooms,
          occupancy: row.occupancy,
          pax: row.pax,
          crewByPosition: row.crewByPosition,
          crewIds: row.crewIds,
          costMinor: row.costMinor,
          costCurrency: row.costCurrency,
          status: 'demand' as const,
          confirmationNumber: null,
          shuttle: row.shuttle ?? null,
          notes: null,
          disruptionFlags: [],
          checkedInAtUtcMs: null,
          checkedInBy: null,
          checkedOutAtUtcMs: null,
          createdAtUtcMs: now,
          updatedAtUtcMs: now,
          createdByUserId: userId,
          sourceRunId: runId,
        }
        await HotelBooking.create(doc)
      }
      upserted += 1
      upsertedDocs.push(key)
    }

    return { upserted, preservedManual, runId }
  })

  // ── Single create ──
  app.post('/hotel-bookings', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const userId = req.userId ?? null
    const _id = crypto.randomUUID()

    const doc = await HotelBooking.create({
      _id,
      operatorId,
      pairingId: parsed.data.pairingId,
      pairingCode: parsed.data.pairingCode,
      airportIcao: parsed.data.airportIcao,
      layoverNightUtcMs: parsed.data.layoverNightUtcMs,
      hotelId: parsed.data.hotelId ?? null,
      hotelName: parsed.data.hotelName,
      rooms: parsed.data.rooms,
      occupancy: parsed.data.occupancy,
      pax: parsed.data.rooms,
      notes: parsed.data.notes ?? null,
      status: 'demand',
      createdAtUtcMs: now,
      updatedAtUtcMs: now,
      createdByUserId: userId,
    })

    return doc.toObject()
  })

  // ── Patch ──
  app.patch('/hotel-bookings/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const set: Record<string, unknown> = { ...parsed.data, updatedAtUtcMs: Date.now() }
    const result = await HotelBooking.findOneAndUpdate({ _id: id, operatorId }, { $set: set }, { new: true }).lean()
    if (!result) return reply.code(404).send({ error: 'Booking not found' })
    return result
  })

  // ── Check-in ──
  app.post('/hotel-bookings/:id/check-in', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = checkInSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const now = Date.now()
    const at = parsed.data?.at ?? now
    const by = parsed.data?.by ?? 'hotac'

    const result = await HotelBooking.findOneAndUpdate(
      { _id: id, operatorId },
      {
        $set: {
          status: 'in-house',
          checkedInAtUtcMs: at,
          checkedInBy: by,
          updatedAtUtcMs: now,
        },
      },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Booking not found' })
    return result
  })

  // ── Check-out ──
  app.post('/hotel-bookings/:id/check-out', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const body = req.body as { at?: number } | null
    const now = Date.now()
    const at = body?.at ?? now

    const result = await HotelBooking.findOneAndUpdate(
      { _id: id, operatorId },
      {
        $set: {
          status: 'departed',
          checkedOutAtUtcMs: at,
          updatedAtUtcMs: now,
        },
      },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Booking not found' })
    return result
  })

  // ── No-show ──
  app.post('/hotel-bookings/:id/no-show', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const result = await HotelBooking.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { status: 'no-show', updatedAtUtcMs: Date.now() } },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Booking not found' })
    return result
  })

  // ── Soft delete ──
  app.delete('/hotel-bookings/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const result = await HotelBooking.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { status: 'cancelled', updatedAtUtcMs: Date.now() } },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Booking not found' })
    return { success: true }
  })
}
