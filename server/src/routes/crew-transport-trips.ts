import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { CrewTransportTrip } from '../models/CrewTransportTrip.js'

/**
 * 4.1.8.2 Crew Transport — ground trip persistence.
 *
 *   GET    /crew-transport-trips?from=…&to=…&station[]=…&status[]=…&vendor[]=…
 *   POST   /crew-transport-trips/upsert-batch    body: { rows: DerivedTrip[] }
 *   POST   /crew-transport-trips                 body: ad-hoc manual trip
 *   PATCH  /crew-transport-trips/:id             partial edit
 *   POST   /crew-transport-trips/:id/dispatch    { driverName, driverPhone, plate, vehicleTierId? }
 *   POST   /crew-transport-trips/:id/picked-up   { at? }
 *   POST   /crew-transport-trips/:id/complete    { at? }
 *   POST   /crew-transport-trips/:id/no-show
 *   DELETE /crew-transport-trips/:id             soft → status='cancelled'
 */

const TRIP_TYPES = [
  'home-airport',
  'airport-home',
  'hub-airport',
  'airport-hub',
  'hotel-airport',
  'airport-hotel',
  'inter-terminal',
] as const

const TRIP_STATUSES = [
  'demand',
  'forecast',
  'pending',
  'sent',
  'confirmed',
  'dispatched',
  'crew-pickedup',
  'completed',
  'cancelled',
  'no-show',
] as const

const VENDOR_METHODS = ['vendor', 'shuttle', 'walking', 'taxi-voucher'] as const
const LOCATION_TYPES = ['home', 'hub', 'airport', 'hotel'] as const
const DISRUPTION_FLAGS = [
  'inbound-delayed',
  'outbound-delayed',
  'extend',
  'overdue-confirmation',
  'cancelled-leg',
] as const

const paxStopSchema = z.object({
  crewId: z.string().min(1),
  crewName: z.string().optional().default(''),
  position: z.string().optional().default(''),
  pickupAddress: z.string().nullable().optional(),
  pickupTimeUtcMs: z.number().nullable().optional(),
  pickedUpAtUtcMs: z.number().nullable().optional(),
  dropoffAtUtcMs: z.number().nullable().optional(),
})

const derivedRowSchema = z.object({
  pairingId: z.string().min(1),
  pairingCode: z.string().optional().default(''),
  tripType: z.enum(TRIP_TYPES),
  scheduledTimeUtcMs: z.number(),
  legFlightNumber: z.string().nullable().optional(),
  legStdUtcIso: z.string().nullable().optional(),
  legStaUtcIso: z.string().nullable().optional(),
  airportIcao: z.string().min(3).max(4),
  fromLocationType: z.enum(LOCATION_TYPES),
  fromAddress: z.string().nullable().optional(),
  fromLat: z.number().nullable().optional(),
  fromLng: z.number().nullable().optional(),
  fromLabel: z.string().optional().default(''),
  toLocationType: z.enum(LOCATION_TYPES),
  toAddress: z.string().nullable().optional(),
  toLat: z.number().nullable().optional(),
  toLng: z.number().nullable().optional(),
  toLabel: z.string().optional().default(''),
  paxStops: z.array(paxStopSchema).max(50).optional().default([]),
  paxCount: z.number().int().min(0).optional().default(0),
  vendorId: z.string().nullable().optional(),
  vendorMethod: z.enum(VENDOR_METHODS).optional().default('vendor'),
  vendorContractId: z.string().nullable().optional(),
  vehicleTierId: z.string().nullable().optional(),
  costMinor: z.number().optional().default(0),
  costCurrency: z.string().optional().default('USD'),
})

const upsertBatchSchema = z.object({
  rows: z.array(derivedRowSchema).max(2000),
  runId: z.string().optional(),
})

const patchSchema = z.object({
  status: z.enum(TRIP_STATUSES).optional(),
  vendorId: z.string().nullable().optional(),
  vendorMethod: z.enum(VENDOR_METHODS).optional(),
  vendorContractId: z.string().nullable().optional(),
  vehicleTierId: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  driverName: z.string().nullable().optional(),
  driverPhone: z.string().nullable().optional(),
  confirmationNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  costMinor: z.number().optional(),
  costCurrency: z.string().optional(),
  paxStops: z.array(paxStopSchema).max(50).optional(),
  scheduledTimeUtcMs: z.number().optional(),
  disruptionFlags: z.array(z.enum(DISRUPTION_FLAGS)).optional(),
})

const createSchema = z.object({
  pairingId: z.string().min(1).nullable().optional(),
  pairingCode: z.string().optional().default(''),
  tripType: z.enum(TRIP_TYPES),
  scheduledTimeUtcMs: z.number(),
  airportIcao: z.string().min(3).max(4),
  fromLocationType: z.enum(LOCATION_TYPES),
  fromAddress: z.string().nullable().optional(),
  fromLabel: z.string().optional().default(''),
  toLocationType: z.enum(LOCATION_TYPES),
  toAddress: z.string().nullable().optional(),
  toLabel: z.string().optional().default(''),
  paxStops: z.array(paxStopSchema).max(50).optional().default([]),
  vendorId: z.string().nullable().optional(),
  vendorMethod: z.enum(VENDOR_METHODS).optional().default('vendor'),
  notes: z.string().nullable().optional(),
})

const dispatchSchema = z.object({
  driverName: z.string().nullable().optional(),
  driverPhone: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  vehicleTierId: z.string().nullable().optional(),
  at: z.number().optional(),
})

const tickSchema = z.object({ at: z.number().optional() }).optional()

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])
async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

/** Status values where the dispatcher has progressed past auto-derivation —
 *  upsert-batch leaves these alone. */
const STICKY_STATUSES = new Set([
  'pending',
  'sent',
  'confirmed',
  'dispatched',
  'crew-pickedup',
  'completed',
  'cancelled',
  'no-show',
])

export async function crewTransportTripRoutes(app: FastifyInstance) {
  // ── List ──
  app.get('/crew-transport-trips', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const q = req.query as {
      from?: string
      to?: string
      station?: string | string[]
      status?: string | string[]
      vendor?: string | string[]
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
        if (Number.isFinite(toMs)) range.$lte = toMs + 86_400_000
      }
      if (Object.keys(range).length > 0) filter.scheduledTimeUtcMs = range
    }
    if (q.station) {
      const arr = Array.isArray(q.station) ? q.station : [q.station]
      if (arr.length > 0) filter.airportIcao = { $in: arr }
    }
    if (q.status) {
      const arr = Array.isArray(q.status) ? q.status : [q.status]
      if (arr.length > 0) filter.status = { $in: arr }
    }
    if (q.vendor) {
      const arr = Array.isArray(q.vendor) ? q.vendor : [q.vendor]
      if (arr.length > 0) filter.vendorId = { $in: arr }
    }

    return CrewTransportTrip.find(filter).sort({ scheduledTimeUtcMs: 1 }).lean()
  })

  // ── Bulk upsert from derivation ──
  app.post('/crew-transport-trips/upsert-batch', { preHandler: requireOpsRole }, async (req, reply) => {
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

    for (const row of parsed.data.rows) {
      const key = {
        operatorId,
        pairingId: row.pairingId,
        tripType: row.tripType,
        scheduledTimeUtcMs: row.scheduledTimeUtcMs,
      }

      const existing = (await CrewTransportTrip.findOne(key).lean()) as Record<string, unknown> | null

      const derivedFields: Record<string, unknown> = {
        pairingCode: row.pairingCode,
        legFlightNumber: row.legFlightNumber ?? null,
        legStdUtcIso: row.legStdUtcIso ?? null,
        legStaUtcIso: row.legStaUtcIso ?? null,
        airportIcao: row.airportIcao,
        fromLocationType: row.fromLocationType,
        fromAddress: row.fromAddress ?? null,
        fromLat: row.fromLat ?? null,
        fromLng: row.fromLng ?? null,
        fromLabel: row.fromLabel,
        toLocationType: row.toLocationType,
        toAddress: row.toAddress ?? null,
        toLat: row.toLat ?? null,
        toLng: row.toLng ?? null,
        toLabel: row.toLabel,
        paxStops: row.paxStops,
        paxCount: row.paxCount,
        updatedAtUtcMs: now,
      }

      if (existing) {
        // Preserve sticky status + manual vendor/driver overrides
        if (!STICKY_STATUSES.has(existing.status as string)) {
          if (existing.status !== 'forecast') {
            derivedFields.status = 'demand'
          }
          // pre-Enlist row → safe to refresh vendor + cost
          derivedFields.vendorId = row.vendorId ?? null
          derivedFields.vendorMethod = row.vendorMethod
          derivedFields.vendorContractId = row.vendorContractId ?? null
          derivedFields.vehicleTierId = row.vehicleTierId ?? null
          derivedFields.costMinor = row.costMinor
          derivedFields.costCurrency = row.costCurrency
        } else {
          preservedManual += 1
        }

        await CrewTransportTrip.updateOne(key, { $set: derivedFields })
      } else {
        const doc = {
          _id: crypto.randomUUID(),
          operatorId,
          pairingId: row.pairingId,
          tripType: row.tripType,
          scheduledTimeUtcMs: row.scheduledTimeUtcMs,
          pairingCode: row.pairingCode,
          legFlightNumber: row.legFlightNumber ?? null,
          legStdUtcIso: row.legStdUtcIso ?? null,
          legStaUtcIso: row.legStaUtcIso ?? null,
          airportIcao: row.airportIcao,
          fromLocationType: row.fromLocationType,
          fromAddress: row.fromAddress ?? null,
          fromLat: row.fromLat ?? null,
          fromLng: row.fromLng ?? null,
          fromLabel: row.fromLabel,
          toLocationType: row.toLocationType,
          toAddress: row.toAddress ?? null,
          toLat: row.toLat ?? null,
          toLng: row.toLng ?? null,
          toLabel: row.toLabel,
          paxStops: row.paxStops,
          paxCount: row.paxCount,
          vendorId: row.vendorId ?? null,
          vendorMethod: row.vendorMethod,
          vendorContractId: row.vendorContractId ?? null,
          vehicleTierId: row.vehicleTierId ?? null,
          costMinor: row.costMinor,
          costCurrency: row.costCurrency,
          status: 'demand' as const,
          createdAtUtcMs: now,
          updatedAtUtcMs: now,
          createdByUserId: userId,
          sourceRunId: runId,
        }
        await CrewTransportTrip.create(doc)
      }
      upserted += 1
    }

    return { upserted, preservedManual, runId }
  })

  // ── Single create (manual ad-hoc) ──
  app.post('/crew-transport-trips', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const now = Date.now()
    const userId = req.userId ?? null
    const _id = crypto.randomUUID()

    const doc = await CrewTransportTrip.create({
      _id,
      operatorId,
      pairingId: parsed.data.pairingId ?? null,
      pairingCode: parsed.data.pairingCode,
      tripType: parsed.data.tripType,
      scheduledTimeUtcMs: parsed.data.scheduledTimeUtcMs,
      airportIcao: parsed.data.airportIcao,
      fromLocationType: parsed.data.fromLocationType,
      fromAddress: parsed.data.fromAddress ?? null,
      fromLabel: parsed.data.fromLabel,
      toLocationType: parsed.data.toLocationType,
      toAddress: parsed.data.toAddress ?? null,
      toLabel: parsed.data.toLabel,
      paxStops: parsed.data.paxStops,
      paxCount: parsed.data.paxStops.length,
      vendorId: parsed.data.vendorId ?? null,
      vendorMethod: parsed.data.vendorMethod,
      notes: parsed.data.notes ?? null,
      status: 'pending',
      createdAtUtcMs: now,
      updatedAtUtcMs: now,
      createdByUserId: userId,
    })

    return doc.toObject()
  })

  // ── Patch ──
  app.patch('/crew-transport-trips/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = patchSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const set: Record<string, unknown> = { ...parsed.data, updatedAtUtcMs: Date.now() }
    if (parsed.data.paxStops) set.paxCount = parsed.data.paxStops.length

    const result = await CrewTransportTrip.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: set },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Trip not found' })
    return result
  })

  // ── Dispatch (records driver + plate, status='dispatched') ──
  app.post('/crew-transport-trips/:id/dispatch', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = dispatchSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const now = Date.now()
    const at = parsed.data.at ?? now

    const set: Record<string, unknown> = {
      status: 'dispatched',
      dispatchedAtUtcMs: at,
      updatedAtUtcMs: now,
    }
    if (parsed.data.driverName !== undefined) set.driverName = parsed.data.driverName
    if (parsed.data.driverPhone !== undefined) set.driverPhone = parsed.data.driverPhone
    if (parsed.data.vehiclePlate !== undefined) set.vehiclePlate = parsed.data.vehiclePlate
    if (parsed.data.vehicleTierId !== undefined) set.vehicleTierId = parsed.data.vehicleTierId

    const result = await CrewTransportTrip.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: set },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Trip not found' })
    return result
  })

  // ── Picked up ──
  app.post('/crew-transport-trips/:id/picked-up', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = tickSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const now = Date.now()
    const at = parsed.data?.at ?? now

    const result = await CrewTransportTrip.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { status: 'crew-pickedup', pickedUpAtUtcMs: at, updatedAtUtcMs: now } },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Trip not found' })
    return result
  })

  // ── Complete ──
  app.post('/crew-transport-trips/:id/complete', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const parsed = tickSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const now = Date.now()
    const at = parsed.data?.at ?? now

    const result = await CrewTransportTrip.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { status: 'completed', completedAtUtcMs: at, updatedAtUtcMs: now } },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Trip not found' })
    return result
  })

  // ── No-show ──
  app.post('/crew-transport-trips/:id/no-show', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const result = await CrewTransportTrip.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { status: 'no-show', updatedAtUtcMs: Date.now() } },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Trip not found' })
    return result
  })

  // ── Soft delete ──
  app.delete('/crew-transport-trips/:id', { preHandler: requireOpsRole }, async (req, reply) => {
    const operatorId = req.operatorId
    const { id } = req.params as { id: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const result = await CrewTransportTrip.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { status: 'cancelled', updatedAtUtcMs: Date.now() } },
      { new: true },
    ).lean()
    if (!result) return reply.code(404).send({ error: 'Trip not found' })
    return { success: true }
  })
}
