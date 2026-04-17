import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Scenario } from '../models/Scenario.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { MovementMessageLog } from '../models/MovementMessageLog.js'

const createSchema = z
  .object({
    operatorId: z.string().min(1),
    seasonCode: z.string().default(''),
    name: z.string().min(1).max(100),
    description: z.string().nullable().optional(),
    createdBy: z.string().min(1),
    parentScenarioId: z.string().nullable().optional(),
  })
  .strict()

const updateSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().nullable(),
    status: z.enum(['draft', 'review', 'published', 'archived']),
  })
  .partial()
  .strict()

export async function scenarioRoutes(app: FastifyInstance): Promise<void> {
  // ── List ──
  app.get('/scenarios', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (q.operatorId) filter.operatorId = q.operatorId
    if (q.seasonCode) filter.seasonCode = q.seasonCode
    return Scenario.find(filter).sort({ createdAt: -1 }).lean()
  })

  // ── Envelopes — flight-date min/max per scenario (for date-range cascade).
  // Production flights (scenarioId: null) are surfaced as '__production__' so
  // the client can compare any scenario against live production.
  app.get('/scenarios/envelopes', async (req) => {
    const q = req.query as Record<string, string>
    const match: Record<string, unknown> = {}
    if (q.operatorId) match.operatorId = q.operatorId
    const rows = await ScheduledFlight.aggregate<{
      _id: string | null
      effectiveFromUtc: string
      effectiveUntilUtc: string
      flightCount: number
    }>([
      { $match: match },
      {
        $group: {
          _id: '$scenarioId',
          effectiveFromUtc: { $min: '$effectiveFrom' },
          effectiveUntilUtc: { $max: '$effectiveUntil' },
          flightCount: { $sum: 1 },
        },
      },
    ])
    return rows.map((r) => ({
      scenarioId: r._id ?? '__production__',
      effectiveFromUtc: r.effectiveFromUtc,
      effectiveUntilUtc: r.effectiveUntilUtc,
      flightCount: r.flightCount,
    }))
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
    if (!parsed.success)
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
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

    // Clone flights from source scenario — preserve sourceFlightId chain
    const flights = await ScheduledFlight.find({ scenarioId: id }).lean()
    if (flights.length > 0) {
      const clones = flights.map((f) => ({
        ...f,
        _id: crypto.randomUUID(),
        scenarioId: newId,
        // Preserve the link to the original production flight
        sourceFlightId: (f.sourceFlightId as string) ?? f._id,
        status: 'draft',
        createdAt: now,
        updatedAt: null,
      }))
      await ScheduledFlight.insertMany(clones)
    }

    return reply.code(201).send({ id: newId, flightCount: flights.length })
  })

  // ── Copy production flights into a scenario ──
  app.post('/scenarios/:id/copy-production', async (req, reply) => {
    const { id } = req.params as { id: string }
    const scenario = await Scenario.findById(id).lean()
    if (!scenario) return reply.code(404).send({ error: 'Scenario not found' })

    const { statuses } = (req.body as { statuses?: string[] }) ?? {}
    const statusFilter = statuses?.length ? { $in: statuses } : { $ne: 'cancelled' }

    const now = new Date().toISOString()
    const flights = await ScheduledFlight.find({
      operatorId: scenario.operatorId,
      scenarioId: null,
      status: statusFilter,
    }).lean()

    if (flights.length > 0) {
      const clones = flights.map((f) => ({
        ...f,
        _id: crypto.randomUUID(),
        scenarioId: id,
        sourceFlightId: f._id, // link back to production flight
        status: 'draft',
        createdAt: now,
        updatedAt: null,
      }))
      await ScheduledFlight.insertMany(clones)
    }

    return { copied: flights.length }
  })

  // ── Update ──
  app.patch('/scenarios/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed' })
    const doc = await Scenario.findByIdAndUpdate(
      id,
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Scenario not found' })
    return doc
  })

  // ── Publish ──
  app.post('/scenarios/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { publishedBy } = req.body as { publishedBy?: string }
    const now = new Date().toISOString()

    const scenario = await Scenario.findByIdAndUpdate(
      id,
      {
        $set: { status: 'published', publishedAt: now, publishedBy: publishedBy || 'system', updatedAt: now },
      },
      { new: true },
    ).lean()
    if (!scenario) return reply.code(404).send({ error: 'Scenario not found' })

    // Set all flights in this scenario to active
    const result = await ScheduledFlight.updateMany(
      { scenarioId: id, status: 'draft' },
      { $set: { status: 'active', updatedAt: now } },
    )

    return { scenario, activatedFlights: result.modifiedCount }
  })

  // ── Publish & Merge — diff-based merge of scenario changes into production ──
  app.post('/scenarios/:id/publish-merge', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { publishedBy } = req.body as { publishedBy?: string }
    const now = new Date().toISOString()

    const scenario = await Scenario.findById(id).lean()
    if (!scenario) return reply.code(404).send({ error: 'Scenario not found' })
    const operatorId = scenario.operatorId as string

    // Fetch scenario flights and production flights
    const [scenarioFlights, productionFlights] = await Promise.all([
      ScheduledFlight.find({ scenarioId: id, operatorId }).lean(),
      ScheduledFlight.find({ scenarioId: null, operatorId, isActive: { $ne: false } }).lean(),
    ])

    // Build lookup: production flight by _id
    const prodMap = new Map(productionFlights.map((f) => [f._id, f]))

    // Track which production flights are referenced by scenario
    const referencedProdIds = new Set<string>()

    // Fields to compare for detecting modifications
    const COMPARE_FIELDS = [
      'flightNumber',
      'depStation',
      'arrStation',
      'stdUtc',
      'staUtc',
      'daysOfWeek',
      'effectiveFrom',
      'effectiveUntil',
      'aircraftTypeIcao',
      'blockMinutes',
      'serviceType',
      'status',
      'cockpitCrewRequired',
      'cabinCrewRequired',
      'departureDayOffset',
      'arrivalDayOffset',
    ] as const

    const added: string[] = []
    const modified: string[] = []
    const deleted: string[] = []
    let unchanged = 0

    // Process scenario flights
    for (const sf of scenarioFlights) {
      const srcId = sf.sourceFlightId as string | null

      if (!srcId) {
        // NEW — flight created fresh in scenario, add to production
        const newId = crypto.randomUUID()
        await ScheduledFlight.create({
          ...sf,
          _id: newId,
          scenarioId: null,
          sourceFlightId: null,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        added.push(sf.flightNumber as string)
        continue
      }

      referencedProdIds.add(srcId)
      const prod = prodMap.get(srcId)
      if (!prod) {
        // Source flight was deleted from production — treat as NEW
        const newId = crypto.randomUUID()
        await ScheduledFlight.create({
          ...sf,
          _id: newId,
          scenarioId: null,
          sourceFlightId: null,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        added.push(sf.flightNumber as string)
        continue
      }

      // Check if scenario flight was cancelled/suspended (deleted in scenario)
      if (sf.status === 'cancelled') {
        await ScheduledFlight.findByIdAndUpdate(srcId, {
          $set: { status: 'cancelled', previousStatus: prod.status, updatedAt: now },
        })
        deleted.push(sf.flightNumber as string)
        continue
      }

      // Compare fields to detect modifications
      let hasChange = false
      const updates: Record<string, unknown> = { updatedAt: now }
      for (const field of COMPARE_FIELDS) {
        const scenarioVal = String(sf[field] ?? '')
        const prodVal = String(prod[field] ?? '')
        if (scenarioVal !== prodVal) {
          hasChange = true
          updates[field] = sf[field]
        }
      }

      if (hasChange) {
        await ScheduledFlight.findByIdAndUpdate(srcId, { $set: updates })
        modified.push(sf.flightNumber as string)
      } else {
        unchanged++
      }
    }

    // Check for production flights NOT referenced by any scenario flight → deleted in scenario
    for (const [prodId, prod] of prodMap) {
      if (!referencedProdIds.has(prodId) && prod.status !== 'cancelled') {
        await ScheduledFlight.findByIdAndUpdate(prodId, {
          $set: { status: 'cancelled', previousStatus: prod.status, updatedAt: now },
        })
        deleted.push(prod.flightNumber as string)
      }
    }

    // Mark scenario as published
    await Scenario.findByIdAndUpdate(id, {
      $set: { status: 'published', publishedAt: now, publishedBy: publishedBy || 'system', updatedAt: now },
    })

    // Release held MVT messages for this scenario
    const mvtRelease = await MovementMessageLog.updateMany(
      { operatorId, scenarioId: id, status: 'held' },
      { $set: { status: 'pending', scenarioId: null, updatedAtUtc: now } },
    )

    return {
      added: added.length,
      modified: modified.length,
      deleted: deleted.length,
      unchanged,
      mvtReleased: mvtRelease.modifiedCount,
      details: { added, modified, deleted },
    }
  })

  // ── Preview diff (dry-run, no writes) ──
  app.get('/scenarios/:id/diff-preview', async (req, reply) => {
    const { id } = req.params as { id: string }
    const scenario = await Scenario.findById(id).lean()
    if (!scenario) return reply.code(404).send({ error: 'Scenario not found' })
    const operatorId = scenario.operatorId as string

    const [scenarioFlights, productionFlights] = await Promise.all([
      ScheduledFlight.find({ scenarioId: id, operatorId }).lean(),
      ScheduledFlight.find({ scenarioId: null, operatorId, isActive: { $ne: false } }).lean(),
    ])

    const prodMap = new Map(productionFlights.map((f) => [f._id, f]))
    const referencedProdIds = new Set<string>()

    const COMPARE_FIELDS = [
      'flightNumber',
      'depStation',
      'arrStation',
      'stdUtc',
      'staUtc',
      'daysOfWeek',
      'effectiveFrom',
      'effectiveUntil',
      'aircraftTypeIcao',
      'blockMinutes',
      'serviceType',
      'status',
      'cockpitCrewRequired',
      'cabinCrewRequired',
      'departureDayOffset',
      'arrivalDayOffset',
    ] as const

    let added = 0,
      modified = 0,
      deleted = 0,
      unchanged = 0

    for (const sf of scenarioFlights) {
      const srcId = sf.sourceFlightId as string | null
      if (!srcId) {
        added++
        continue
      }
      referencedProdIds.add(srcId)
      const prod = prodMap.get(srcId)
      if (!prod) {
        added++
        continue
      }
      if (sf.status === 'cancelled') {
        deleted++
        continue
      }

      let hasChange = false
      for (const field of COMPARE_FIELDS) {
        if (String(sf[field] ?? '') !== String(prod[field] ?? '')) {
          hasChange = true
          break
        }
      }
      if (hasChange) modified++
      else unchanged++
    }

    // Production flights not in scenario = deleted
    for (const [prodId, prod] of prodMap) {
      if (!referencedProdIds.has(prodId) && prod.status !== 'cancelled') deleted++
    }

    return { added, modified, deleted, unchanged, total: scenarioFlights.length }
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

  // ── Bulk delete — wipe all scenarios (optionally scoped by operatorId/seasonCode) ──
  app.delete('/scenarios', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = {}
    if (q.operatorId) filter.operatorId = q.operatorId
    if (q.seasonCode) filter.seasonCode = q.seasonCode

    const ids = (await Scenario.find(filter, { _id: 1 }).lean()).map((s) => s._id as string)
    if (ids.length === 0) return { scenariosDeleted: 0, flightsDeleted: 0 }

    const flightsResult = await ScheduledFlight.deleteMany({ scenarioId: { $in: ids } })
    const scenariosResult = await Scenario.deleteMany({ _id: { $in: ids } })
    return {
      scenariosDeleted: scenariosResult.deletedCount ?? 0,
      flightsDeleted: flightsResult.deletedCount ?? 0,
    }
  })
}
