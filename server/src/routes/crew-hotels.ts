import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CrewHotel } from '../models/CrewHotel.js'
import { bulkIngestHotelDetails, bulkIngestEffectiveDates } from '../services/crew-hotel-bulk.js'

// ─── Zod schemas ─────────────────────────────────────────

const HHMM = z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM')

const contactSchema = z.object({
  _id: z.string().optional(),
  name: z.string().nullable().optional(),
  telephone: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
})

const emailSchema = z.object({
  _id: z.string().optional(),
  address: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
})

const criteriaSchema = z.object({
  blockToBlockRestMinutes: z.number().nullable().optional(),
  crewPositions: z.array(z.string()).optional().default([]),
  aircraftTypes: z.array(z.string()).optional().default([]),
  crewCategories: z.array(z.string()).optional().default([]),
  charterers: z.array(z.string()).optional().default([]),
})

const dailyRateRuleSchema = z.object({
  _id: z.string().optional(),
  stayType: z.string().nullable().optional(),
  fromDays: z.number().nullable().optional(),
  toDays: z.number().nullable().optional(),
  operation: z.string().nullable().optional(),
  durationHrs: z.number().nullable().optional(),
  percentage: z.number().nullable().optional(),
  rate: z.number().nullable().optional(),
})

const contractSchema = z.object({
  _id: z.string().optional(),
  priority: z.number().optional().default(1),
  startDateUtcMs: z.number().nullable().optional(),
  endDateUtcMs: z.number().nullable().optional(),
  weekdayMask: z.array(z.boolean()).length(7).optional(),
  checkInLocal: HHMM.nullable().optional(),
  checkOutLocal: HHMM.nullable().optional(),
  contractNo: z.string().nullable().optional(),
  contractRate: z.number().nullable().optional(),
  currency: z.string().optional().default('EUR'),
  roomsPerNight: z.number().optional().default(0),
  releaseTime: HHMM.optional().default('00:00'),
  roomRate: z.number().optional().default(0),
  dailyRateRules: z.array(dailyRateRuleSchema).optional().default([]),
})

const shuttleSchema = z.object({
  _id: z.string().optional(),
  fromDateUtcMs: z.number().nullable().optional(),
  toDateUtcMs: z.number().nullable().optional(),
  fromTimeLocal: HHMM.nullable().optional(),
  toTimeLocal: HHMM.nullable().optional(),
  weekdayMask: z.array(z.boolean()).length(7).optional(),
})

const hotelCreateSchema = z
  .object({
    airportIcao: z
      .string()
      .min(3)
      .max(4)
      .regex(/^[A-Z]{3,4}$/, 'ICAO must be 3-4 uppercase letters'),
    hotelName: z.string().min(1),
    priority: z.number().optional().default(1),
    isActive: z.boolean().optional().default(true),
    effectiveFromUtcMs: z.number().nullable().optional(),
    effectiveUntilUtcMs: z.number().nullable().optional(),
    isTrainingHotel: z.boolean().optional().default(false),
    isAllInclusive: z.boolean().optional().default(false),
    addressLine1: z.string().nullable().optional(),
    addressLine2: z.string().nullable().optional(),
    addressLine3: z.string().nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    distanceFromAirportMinutes: z.number().nullable().optional(),
    shuttleAlwaysAvailable: z.boolean().optional().default(false),
    standardCheckInLocal: HHMM.optional().default('10:00'),
    standardCheckOutLocal: HHMM.optional().default('18:00'),
    criteria: criteriaSchema.optional(),
    contacts: z.array(contactSchema).optional().default([]),
    emails: z.array(emailSchema).optional().default([]),
    contracts: z.array(contractSchema).optional().default([]),
    shuttles: z.array(shuttleSchema).optional().default([]),
    operatorId: z.string().optional(), // injected by auth middleware, pass-through
  })
  .passthrough()

const hotelUpdateSchema = hotelCreateSchema.partial()

function nowIso() {
  return new Date().toISOString()
}

export async function crewHotelRoutes(app: FastifyInstance): Promise<void> {
  // ─── List ─────────────────────────────────────────────
  app.get('/crew-hotels', async (req) => {
    const operatorId = req.operatorId
    const { airportIcao, active, search } = req.query as {
      airportIcao?: string
      active?: string
      search?: string
    }

    const filter: Record<string, unknown> = { operatorId }
    if (airportIcao) filter.airportIcao = airportIcao.toUpperCase()
    if (active === 'true') filter.isActive = true
    if (search) {
      filter.$or = [
        { hotelName: { $regex: search, $options: 'i' } },
        { airportIcao: { $regex: search, $options: 'i' } },
        { addressLine1: { $regex: search, $options: 'i' } },
      ]
    }

    return CrewHotel.find(filter).sort({ airportIcao: 1, priority: 1, hotelName: 1 }).lean()
  })

  // ─── Template downloads (must be before /:id) ─────────
  app.get('/crew-hotels/templates/:type', async (req, reply) => {
    const { type } = req.params as { type: string }
    const templates: Record<string, string> = {
      details: 'hotel-details-template.csv',
      'effective-dates': 'hotel-effective-dates-template.csv',
    }
    const fname = templates[type]
    if (!fname) return reply.code(404).send({ error: 'Unknown template type' })

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const filePath = path.resolve(__dirname, '..', '..', 'templates', fname)
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Template file missing' })
    }
    const content = fs.readFileSync(filePath, 'utf8')
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', `attachment; filename="${fname}"`)
    return content
  })

  // ─── Bulk upload (must be before /:id) ────────────────
  app.post('/crew-hotels/bulk/details', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(401).send({ error: 'Unauthorized' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })
    const buffer = await file.toBuffer()
    const content = buffer.toString('utf8')

    try {
      const result = await bulkIngestHotelDetails(operatorId, content, { dryRun: false })
      return result
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message })
    }
  })

  app.post('/crew-hotels/bulk/effective-dates', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(401).send({ error: 'Unauthorized' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })
    const buffer = await file.toBuffer()
    const content = buffer.toString('utf8')

    try {
      const result = await bulkIngestEffectiveDates(operatorId, content, { dryRun: false })
      return result
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message })
    }
  })

  app.post('/crew-hotels/bulk/validate', async (req, reply) => {
    const operatorId = req.operatorId
    if (!operatorId) return reply.code(401).send({ error: 'Unauthorized' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })
    const fields = file.fields as Record<string, { value?: string } | undefined>
    const type = fields.type?.value ?? 'details'

    const buffer = await file.toBuffer()
    const content = buffer.toString('utf8')

    try {
      const fn = type === 'effective-dates' ? bulkIngestEffectiveDates : bulkIngestHotelDetails
      const result = await fn(operatorId, content, { dryRun: true })
      return result
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message })
    }
  })

  // ─── Detail ───────────────────────────────────────────
  app.get('/crew-hotels/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const doc = await CrewHotel.findOne({ _id: id, operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel not found' })
    return doc
  })

  // ─── Create ───────────────────────────────────────────
  app.post('/crew-hotels', async (req, reply) => {
    const operatorId = req.operatorId
    const raw = req.body as Record<string, unknown>
    if (raw.airportIcao) raw.airportIcao = (raw.airportIcao as string).toUpperCase()

    const parsed = hotelCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data

    const existing = await CrewHotel.findOne({
      operatorId,
      airportIcao: body.airportIcao,
      hotelName: body.hotelName,
    }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Hotel "${body.hotelName}" already exists at ${body.airportIcao}` })
    }

    const id = crypto.randomUUID()
    const doc = await CrewHotel.create({
      ...body,
      _id: id,
      operatorId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    return reply.code(201).send(doc.toObject())
  })

  // ─── Update ───────────────────────────────────────────
  app.patch('/crew-hotels/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const raw = req.body as Record<string, unknown>
    if (raw.airportIcao) raw.airportIcao = (raw.airportIcao as string).toUpperCase()

    const parsed = hotelUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const doc = await CrewHotel.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { ...parsed.data, updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel not found' })
    return doc
  })

  // ─── Delete ───────────────────────────────────────────
  app.delete('/crew-hotels/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const doc = await CrewHotel.findOneAndDelete({ _id: id, operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel not found' })
    return { success: true }
  })

  // ─── Contracts CRUD ───────────────────────────────────
  app.post('/crew-hotels/:id/contracts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = contractSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const contract = { _id: crypto.randomUUID(), ...parsed.data }
    const doc = await CrewHotel.findOneAndUpdate(
      { _id: id, operatorId },
      { $push: { contracts: contract }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel not found' })
    return doc
  })

  app.patch('/crew-hotels/:id/contracts/:cId', async (req, reply) => {
    const { id, cId } = req.params as { id: string; cId: string }
    const operatorId = req.operatorId
    const parsed = contractSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const setFields: Record<string, unknown> = { updatedAt: nowIso() }
    for (const [k, v] of Object.entries(parsed.data)) setFields[`contracts.$.${k}`] = v
    const doc = await CrewHotel.findOneAndUpdate(
      { _id: id, operatorId, 'contracts._id': cId },
      { $set: setFields },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel or contract not found' })
    return doc
  })

  app.delete('/crew-hotels/:id/contracts/:cId', async (req, reply) => {
    const { id, cId } = req.params as { id: string; cId: string }
    const operatorId = req.operatorId
    const doc = await CrewHotel.findOneAndUpdate(
      { _id: id, operatorId },
      { $pull: { contracts: { _id: cId } }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel not found' })
    return doc
  })

  // ─── Shuttles CRUD ────────────────────────────────────
  app.post('/crew-hotels/:id/shuttles', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = shuttleSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const shuttle = { _id: crypto.randomUUID(), ...parsed.data }
    const doc = await CrewHotel.findOneAndUpdate(
      { _id: id, operatorId },
      { $push: { shuttles: shuttle }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel not found' })
    return doc
  })

  app.patch('/crew-hotels/:id/shuttles/:sId', async (req, reply) => {
    const { id, sId } = req.params as { id: string; sId: string }
    const operatorId = req.operatorId
    const parsed = shuttleSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const setFields: Record<string, unknown> = { updatedAt: nowIso() }
    for (const [k, v] of Object.entries(parsed.data)) setFields[`shuttles.$.${k}`] = v
    const doc = await CrewHotel.findOneAndUpdate(
      { _id: id, operatorId, 'shuttles._id': sId },
      { $set: setFields },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel or shuttle not found' })
    return doc
  })

  app.delete('/crew-hotels/:id/shuttles/:sId', async (req, reply) => {
    const { id, sId } = req.params as { id: string; sId: string }
    const operatorId = req.operatorId
    const doc = await CrewHotel.findOneAndUpdate(
      { _id: id, operatorId },
      { $pull: { shuttles: { _id: sId } }, $set: { updatedAt: nowIso() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Hotel not found' })
    return doc
  })
}
