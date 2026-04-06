import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Scenario } from '../models/Scenario.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'

const createSchema = z.object({
  operatorId: z.string().min(1),
  seasonCode: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  createdBy: z.string().min(1),
  parentScenarioId: z.string().nullable().optional(),
}).strict()

const updateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  status: z.enum(['draft', 'review', 'published', 'archived']),
}).partial().strict()

export async function scenarioRoutes(app: FastifyInstance): Promise<void> {
  // ── List ──
  app.get('/scenarios', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (q.operatorId) filter.operatorId = q.operatorId
    if (q.seasonCode) filter.seasonCode = q.seasonCode
    return Scenario.find(filter).sort({ createdAt: -1 }).lean()
  })

  // ── Get one ──
  app.get('/scenarios/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await Scenario.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Scenario not found' })
    return doc
  })

  // ── Create ──
  app.post('/scenarios', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    const id = crypto.randomUUID()
    const doc = await Scenario.create({ _id: id, ...parsed.data, status: 'draft', createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  // ── Clone ──
  app.post('/scenarios/:id/clone', async (req, reply) => {
    const { id } = req.params as { id: string }
    const source = await Scenario.findById(id).lean()
    if (!source) return reply.code(404).send({ error: 'Source scenario not found' })

    const { name, createdBy } = req.body as { name: string; createdBy: string }
    const newId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Clone scenario
    await Scenario.create({
      _id: newId,
      operatorId: source.operatorId,
      seasonCode: source.seasonCode,
      name: name || `${source.name} (copy)`,
      description: source.description,
      status: 'draft',
      parentScenarioId: id,
      createdBy: createdBy || 'system',
      createdAt: now,
    })

    // Clone flights
    const flights = await ScheduledFlight.find({ scenarioId: id }).lean()
    if (flights.length > 0) {
      const clones = flights.map(f => ({
        ...f,
        _id: crypto.randomUUID(),
        scenarioId: newId,
        status: 'draft',
        createdAt: now,
        updatedAt: null,
      }))
      await ScheduledFlight.insertMany(clones)
    }

    return reply.code(201).send({ id: newId, flightCount: flights.length })
  })

  // ── Update ──
  app.patch('/scenarios/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed' })
    const doc = await Scenario.findByIdAndUpdate(id, { $set: { ...parsed.data, updatedAt: new Date().toISOString() } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Scenario not found' })
    return doc
  })

  // ── Publish ──
  app.post('/scenarios/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { publishedBy } = req.body as { publishedBy?: string }
    const now = new Date().toISOString()

    const scenario = await Scenario.findByIdAndUpdate(id, {
      $set: { status: 'published', publishedAt: now, publishedBy: publishedBy || 'system', updatedAt: now },
    }, { new: true }).lean()
    if (!scenario) return reply.code(404).send({ error: 'Scenario not found' })

    // Set all flights in this scenario to active
    const result = await ScheduledFlight.updateMany(
      { scenarioId: id, status: 'draft' },
      { $set: { status: 'active', updatedAt: now } }
    )

    return { scenario, activatedFlights: result.modifiedCount }
  })

  // ── Delete ──
  app.delete('/scenarios/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await Scenario.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Scenario not found' })
    await ScheduledFlight.deleteMany({ scenarioId: id })
    await Scenario.findByIdAndDelete(id)
    return { success: true }
  })
}
