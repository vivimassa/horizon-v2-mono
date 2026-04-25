import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CrewTransportVendor } from '../models/CrewTransportVendor.js'

/**
 * 4.1.8.2 Crew Transport — vendor master data routes.
 *
 * Mirrors crew-hotels.ts shape: list/detail/create/update/delete plus nested
 * CRUD for contacts/emails/contracts/drivers. Tenant-scoped via req.operatorId.
 */

const ICAO_REGEX = /^[A-Z]{3,4}$/

const contactSchema = z.object({
  _id: z.string().optional(),
  name: z.string().nullable().optional(),
  telephone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
})

const emailSchema = z.object({
  _id: z.string().optional(),
  address: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
})

const vehicleTierSchema = z.object({
  _id: z.string().optional(),
  tierName: z.string().min(1),
  paxCapacity: z.number().int().min(0).max(99).optional().default(0),
  ratePerTrip: z.number().min(0).optional().default(0),
  ratePerHour: z.number().min(0).optional().default(0),
})

const contractSchema = z.object({
  _id: z.string().optional(),
  contractNo: z.string().nullable().optional(),
  priority: z.number().optional().default(1),
  startDateUtcMs: z.number().nullable().optional(),
  endDateUtcMs: z.number().nullable().optional(),
  weekdayMask: z.array(z.boolean()).length(7).optional(),
  currency: z.string().optional().default('USD'),
  minLeadTimeMin: z.number().int().min(0).max(720).optional().default(30),
  slaMin: z.number().int().min(1).max(120).optional().default(15),
  vehicleTiers: z.array(vehicleTierSchema).max(20).optional().default([]),
})

const driverSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

const vendorCreateSchema = z
  .object({
    vendorName: z.string().min(1),
    baseAirportIcao: z.string().min(3).max(4).regex(ICAO_REGEX, 'ICAO must be 3-4 uppercase letters'),
    priority: z.number().optional().default(1),
    isActive: z.boolean().optional().default(true),
    addressLine1: z.string().nullable().optional(),
    addressLine2: z.string().nullable().optional(),
    addressLine3: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    serviceAreaIcaos: z.array(z.string().regex(ICAO_REGEX)).optional().default([]),
    contacts: z.array(contactSchema).optional().default([]),
    emails: z.array(emailSchema).optional().default([]),
    contracts: z.array(contractSchema).optional().default([]),
    drivers: z.array(driverSchema).optional().default([]),
    operatorId: z.string().optional(), // injected by auth, pass-through
  })
  .passthrough()

const vendorUpdateSchema = vendorCreateSchema.partial()

function nowIso(): string {
  return new Date().toISOString()
}

function ensureIds<T extends { _id?: string }>(items: T[] | undefined): T[] {
  return (items ?? []).map((it) => ({
    ...it,
    _id: it._id ?? crypto.randomUUID(),
  }))
}

export async function crewTransportVendorRoutes(app: FastifyInstance): Promise<void> {
  // ── List ──
  app.get('/crew-transport-vendors', async (req) => {
    const operatorId = req.operatorId
    const { airportIcao, active, search } = req.query as {
      airportIcao?: string
      active?: string
      search?: string
    }

    const filter: Record<string, unknown> = { operatorId }
    if (airportIcao) filter.baseAirportIcao = airportIcao.toUpperCase()
    if (active === 'true') filter.isActive = true
    if (search) {
      filter.$or = [
        { vendorName: { $regex: search, $options: 'i' } },
        { baseAirportIcao: { $regex: search, $options: 'i' } },
        { addressLine1: { $regex: search, $options: 'i' } },
      ]
    }

    return CrewTransportVendor.find(filter).sort({ baseAirportIcao: 1, priority: 1, vendorName: 1 }).lean()
  })

  // ── Detail ──
  app.get('/crew-transport-vendors/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const doc = await CrewTransportVendor.findOne({ _id: id, operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Vendor not found' })
    return doc
  })

  // ── Create ──
  app.post('/crew-transport-vendors', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(401).send({ error: 'Unauthorized' })

    const raw = req.body as Record<string, unknown>
    if (raw.baseAirportIcao) raw.baseAirportIcao = (raw.baseAirportIcao as string).toUpperCase()

    const parsed = vendorCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data

    const existing = await CrewTransportVendor.findOne({
      operatorId,
      baseAirportIcao: body.baseAirportIcao,
      vendorName: body.vendorName,
    }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Vendor "${body.vendorName}" already exists at ${body.baseAirportIcao}` })
    }

    const id = crypto.randomUUID()
    const doc = await CrewTransportVendor.create({
      ...body,
      _id: id,
      operatorId,
      contacts: ensureIds(body.contacts),
      emails: ensureIds(body.emails),
      contracts: ensureIds(body.contracts).map((c) => ({
        ...c,
        vehicleTiers: ensureIds(c.vehicleTiers),
      })),
      drivers: ensureIds(body.drivers),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })

  // ── Update ──
  app.patch('/crew-transport-vendors/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const raw = req.body as Record<string, unknown>
    if (raw.baseAirportIcao) raw.baseAirportIcao = (raw.baseAirportIcao as string).toUpperCase()

    const parsed = vendorUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const set: Record<string, unknown> = { ...parsed.data, updatedAt: nowIso() }
    // Backfill _ids on inline arrays so client-side adds don't fail validation.
    if (parsed.data.contacts) set.contacts = ensureIds(parsed.data.contacts)
    if (parsed.data.emails) set.emails = ensureIds(parsed.data.emails)
    if (parsed.data.contracts) {
      set.contracts = ensureIds(parsed.data.contracts).map((c) => ({
        ...c,
        vehicleTiers: ensureIds(c.vehicleTiers),
      }))
    }
    if (parsed.data.drivers) set.drivers = ensureIds(parsed.data.drivers)

    const doc = await CrewTransportVendor.findOneAndUpdate({ _id: id, operatorId }, { $set: set }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Vendor not found' })
    return doc
  })

  // ── Delete ──
  app.delete('/crew-transport-vendors/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const result = await CrewTransportVendor.deleteOne({ _id: id, operatorId })
    if (result.deletedCount === 0) return reply.code(404).send({ error: 'Vendor not found' })
    return { success: true }
  })

  // ── Nested CRUD: contracts ──
  app.post('/crew-transport-vendors/:id/contracts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = contractSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const contract = {
      ...parsed.data,
      _id: parsed.data._id ?? crypto.randomUUID(),
      vehicleTiers: ensureIds(parsed.data.vehicleTiers),
    }
    const doc = await CrewTransportVendor.findOneAndUpdate(
      { _id: id, operatorId },
      { $push: { contracts: contract }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Vendor not found' })
    return doc
  })

  app.patch('/crew-transport-vendors/:id/contracts/:cId', async (req, reply) => {
    const { id, cId } = req.params as { id: string; cId: string }
    const operatorId = req.operatorId
    const parsed = contractSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const set: Record<string, unknown> = { updatedAt: nowIso() }
    for (const [k, v] of Object.entries(parsed.data)) {
      if (k === 'vehicleTiers' && Array.isArray(v)) {
        set[`contracts.$.${k}`] = ensureIds(v as { _id?: string }[])
      } else if (v !== undefined) {
        set[`contracts.$.${k}`] = v
      }
    }
    const doc = await CrewTransportVendor.findOneAndUpdate(
      { _id: id, operatorId, 'contracts._id': cId },
      { $set: set },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Contract not found' })
    return doc
  })

  app.delete('/crew-transport-vendors/:id/contracts/:cId', async (req, reply) => {
    const { id, cId } = req.params as { id: string; cId: string }
    const operatorId = req.operatorId
    const doc = await CrewTransportVendor.findOneAndUpdate(
      { _id: id, operatorId },
      { $pull: { contracts: { _id: cId } }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Vendor not found' })
    return doc
  })

  // ── Nested CRUD: drivers ──
  app.post('/crew-transport-vendors/:id/drivers', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = driverSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const driver = { ...parsed.data, _id: parsed.data._id ?? crypto.randomUUID() }
    const doc = await CrewTransportVendor.findOneAndUpdate(
      { _id: id, operatorId },
      { $push: { drivers: driver }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Vendor not found' })
    return doc
  })

  app.patch('/crew-transport-vendors/:id/drivers/:dId', async (req, reply) => {
    const { id, dId } = req.params as { id: string; dId: string }
    const operatorId = req.operatorId
    const parsed = driverSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const set: Record<string, unknown> = { updatedAt: nowIso() }
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) set[`drivers.$.${k}`] = v
    }
    const doc = await CrewTransportVendor.findOneAndUpdate(
      { _id: id, operatorId, 'drivers._id': dId },
      { $set: set },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Driver not found' })
    return doc
  })

  app.delete('/crew-transport-vendors/:id/drivers/:dId', async (req, reply) => {
    const { id, dId } = req.params as { id: string; dId: string }
    const operatorId = req.operatorId
    const doc = await CrewTransportVendor.findOneAndUpdate(
      { _id: id, operatorId },
      { $pull: { drivers: { _id: dId } }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Vendor not found' })
    return doc
  })
}
