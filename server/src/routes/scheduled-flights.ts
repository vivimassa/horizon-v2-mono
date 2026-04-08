import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduledFlight } from '../models/ScheduledFlight.js'

const createSchema = z.object({
  operatorId: z.string().min(1),
  seasonCode: z.string().min(1).max(10),
  airlineCode: z.string().min(2).max(3),
  flightNumber: z.string().min(1).max(8),
  suffix: z.string().nullable().optional(),
  depStation: z.string().min(3).max(4),
  arrStation: z.string().min(3).max(4),
  stdUtc: z.string().min(4).max(5),
  staUtc: z.string().min(4).max(5),
  stdLocal: z.string().nullable().optional(),
  staLocal: z.string().nullable().optional(),
  blockMinutes: z.number().int().nullable().optional(),
  arrivalDayOffset: z.number().int().optional().default(1),
  daysOfWeek: z.string().min(1).max(7),
  aircraftTypeId: z.string().nullable().optional(),
  aircraftTypeIcao: z.string().nullable().optional(),
  aircraftReg: z.string().nullable().optional(),
  serviceType: z.string().max(3).optional().default('J'),
  status: z.enum(['draft', 'active', 'suspended', 'cancelled']).optional().default('draft'),
  effectiveFrom: z.string().min(10).max(10),
  effectiveUntil: z.string().min(10).max(10),
  cockpitCrewRequired: z.number().int().nullable().optional(),
  cabinCrewRequired: z.number().int().nullable().optional(),
  isEtops: z.boolean().optional().default(false),
  isOverwater: z.boolean().optional().default(false),
  scenarioId: z.string().nullable().optional(),
  rotationId: z.string().nullable().optional(),
  rotationSequence: z.number().int().nullable().optional(),
  rotationLabel: z.string().nullable().optional(),
  source: z.enum(['manual', 'ssim_import', 'migration']).optional().default('manual'),
}).strict()

const updateSchema = createSchema.omit({ operatorId: true }).partial().strict()

export async function scheduledFlightRoutes(app: FastifyInstance): Promise<void> {
  // ── List with filtering ──
  app.get('/scheduled-flights', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (q.operatorId) filter.operatorId = q.operatorId
    if (q.seasonCode) filter.seasonCode = q.seasonCode
    if (q.scenarioId) filter.scenarioId = q.scenarioId
    if (q.status) filter.status = q.status
    if (q.depStation) filter.depStation = q.depStation.toUpperCase()
    if (q.arrStation) filter.arrStation = q.arrStation.toUpperCase()
    if (q.aircraftTypeIcao) filter.aircraftTypeIcao = q.aircraftTypeIcao.toUpperCase()
    filter.isActive = { $ne: false }

    const sort: Record<string, 1 | -1> = {}
    if (q.sortBy) sort[q.sortBy] = q.sortDir === 'desc' ? -1 : 1
    else { sort.sortOrder = 1; sort.stdUtc = 1 }

    return ScheduledFlight.find(filter).sort(sort).lean()
  })

  // ── Get single ──
  app.get('/scheduled-flights/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await ScheduledFlight.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Flight not found' })
    return doc
  })

  // ── Create one ──
  app.post('/scheduled-flights', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.depStation) raw.depStation = (raw.depStation as string).toUpperCase()
    if (raw.arrStation) raw.arrStation = (raw.arrStation as string).toUpperCase()
    if (raw.flightNumber) raw.flightNumber = (raw.flightNumber as string).toUpperCase()
    const parsed = createSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    }
    const id = crypto.randomUUID()
    const doc = await ScheduledFlight.create({ _id: id, ...parsed.data, isActive: true, createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  // ── Bulk create ──
  app.post('/scheduled-flights/bulk', async (req, reply) => {
    const rows = req.body as Record<string, unknown>[]
    if (!Array.isArray(rows)) return reply.code(400).send({ error: 'Body must be an array' })
    const now = new Date().toISOString()
    const docs = rows.map(raw => {
      if (raw.depStation) raw.depStation = (raw.depStation as string).toUpperCase()
      if (raw.arrStation) raw.arrStation = (raw.arrStation as string).toUpperCase()
      if (raw.flightNumber) raw.flightNumber = (raw.flightNumber as string).toUpperCase()
      return { _id: crypto.randomUUID(), ...raw, isActive: true, createdAt: now }
    })
    const result = await ScheduledFlight.insertMany(docs)
    return reply.code(201).send({ count: result.length })
  })

  // ── Update one ──
  app.patch('/scheduled-flights/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.depStation) raw.depStation = (raw.depStation as string).toUpperCase()
    if (raw.arrStation) raw.arrStation = (raw.arrStation as string).toUpperCase()
    if (raw.flightNumber) raw.flightNumber = (raw.flightNumber as string).toUpperCase()
    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    }
    const doc = await ScheduledFlight.findByIdAndUpdate(id, { $set: { ...parsed.data, updatedAt: new Date().toISOString() } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Flight not found' })
    return doc
  })

  // ── Bulk update ──
  app.patch('/scheduled-flights/bulk', async (req, reply) => {
    const updates = req.body as { id: string; changes: Record<string, unknown> }[]
    if (!Array.isArray(updates)) return reply.code(400).send({ error: 'Body must be an array of {id, changes}' })
    const now = new Date().toISOString()
    const ops = updates.map(u => ({
      updateOne: { filter: { _id: u.id }, update: { $set: { ...u.changes, updatedAt: now } } },
    }))
    const result = await ScheduledFlight.bulkWrite(ops)
    return { modifiedCount: result.modifiedCount }
  })

  // ── Delete one ──
  app.delete('/scheduled-flights/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await ScheduledFlight.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Flight not found' })
    await ScheduledFlight.findByIdAndDelete(id)
    return { success: true }
  })

  // ── Bulk delete ──
  app.delete('/scheduled-flights/bulk', async (req, reply) => {
    const { ids } = req.body as { ids: string[] }
    if (!Array.isArray(ids)) return reply.code(400).send({ error: 'Body must have ids array' })
    const result = await ScheduledFlight.deleteMany({ _id: { $in: ids } })
    return { deletedCount: result.deletedCount }
  })

  // ── Distinct values (for column filters) ──
  app.get('/scheduled-flights/distinct/:field', async (req) => {
    const { field } = req.params as { field: string }
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (q.operatorId) filter.operatorId = q.operatorId
    if (q.seasonCode) filter.seasonCode = q.seasonCode
    const values = await ScheduledFlight.distinct(field, filter)
    return values.filter(Boolean).sort()
  })
}
