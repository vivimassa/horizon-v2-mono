import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CityPair } from '../models/CityPair.js'
import { Airport } from '../models/Airport.js'
import { calculateGreatCircleDistance, nmToKm, determineRouteType } from '../utils/geo.js'

// ─── Zod schemas ────────────────────────────────────────

const blockHourSchema = z.object({
  _id: z.string().optional(),
  aircraftTypeIcao: z.string().nullable().optional(),
  seasonType: z.string().optional().default('annual'),
  dir1BlockMinutes: z.number().min(0),
  dir2BlockMinutes: z.number().min(0),
  dir1FlightMinutes: z.number().min(0).nullable().optional(),
  dir2FlightMinutes: z.number().min(0).nullable().optional(),
  dir1FuelKg: z.number().min(0).nullable().optional(),
  dir2FuelKg: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
})

const cityPairCreateSchema = z.object({
  operatorId: z.string().min(1, 'operatorId is required'),
  station1Icao: z.string().min(3).max(4),
  station2Icao: z.string().min(3).max(4),
  standardBlockMinutes: z.number().min(0).nullable().optional(),
  isEtops: z.boolean().optional(),
  etopsDiversionTimeMinutes: z.number().min(0).nullable().optional(),
  isOverwater: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

const cityPairUpdateSchema = z
  .object({
    standardBlockMinutes: z.number().min(0).nullable().optional(),
    routeType: z.string().optional(),
    isEtops: z.boolean().optional(),
    etopsDiversionTimeMinutes: z.number().min(0).nullable().optional(),
    isOverwater: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()

// ─── Helper: resolve airport data ───────────────────────

async function resolveAirport(icao: string) {
  const airport = await Airport.findOne({ icaoCode: icao.toUpperCase() }).lean()
  if (!airport) return null
  return {
    icao: airport.icaoCode,
    iata: airport.iataCode ?? null,
    name: airport.name,
    city: airport.city ?? null,
    countryIso2: airport.countryIso2 ?? null,
    lat: airport.latitude ?? null,
    lon: airport.longitude ?? null,
  }
}

// ─── Routes ─────────────────────────────────────────────

export async function cityPairRoutes(app: FastifyInstance): Promise<void> {
  // List all city pairs
  app.get('/city-pairs', async (req) => {
    const operatorId = req.operatorId
    const filter: Record<string, unknown> = { isActive: true, operatorId }
    return CityPair.find(filter).sort({ station1Icao: 1, station2Icao: 1 }).lean()
  })

  // Get single city pair
  app.get('/city-pairs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CityPair.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair not found' })
    return doc
  })

  // Create city pair
  app.post('/city-pairs', async (req, reply) => {
    const parsed = cityPairCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    let icao1 = parsed.data.station1Icao.toUpperCase()
    let icao2 = parsed.data.station2Icao.toUpperCase()

    if (icao1 === icao2) {
      return reply.code(400).send({ error: 'Station 1 and Station 2 must be different airports' })
    }

    // Ensure alphabetical order for consistency (prevent A-B and B-A duplicates)
    if (icao1 > icao2) [icao1, icao2] = [icao2, icao1]

    // Check duplicate per operator
    const operatorId = parsed.data.operatorId
    const existing = await CityPair.findOne({ operatorId, station1Icao: icao1, station2Icao: icao2 }).lean()
    if (existing) {
      return reply.code(409).send({ error: `City pair ${icao1}–${icao2} already exists` })
    }

    // Resolve airports
    const ap1 = await resolveAirport(icao1)
    const ap2 = await resolveAirport(icao2)

    if (!ap1) return reply.code(400).send({ error: `Airport ${icao1} not found in database` })
    if (!ap2) return reply.code(400).send({ error: `Airport ${icao2} not found in database` })

    // Calculate distance
    let distanceNm: number | null = null
    let distanceKm: number | null = null
    if (ap1.lat != null && ap1.lon != null && ap2.lat != null && ap2.lon != null) {
      distanceNm = calculateGreatCircleDistance(ap1.lat, ap1.lon, ap2.lat, ap2.lon)
      distanceKm = nmToKm(distanceNm)
    }

    // Determine route type
    const routeType = determineRouteType(ap1.countryIso2, ap2.countryIso2, distanceNm)

    const id = crypto.randomUUID()
    const doc = await CityPair.create({
      _id: id,
      operatorId,
      station1Icao: icao1,
      station1Iata: ap1.iata,
      station1Name: ap1.name,
      station1City: ap1.city,
      station1CountryIso2: ap1.countryIso2,
      station1Lat: ap1.lat,
      station1Lon: ap1.lon,
      station2Icao: icao2,
      station2Iata: ap2.iata,
      station2Name: ap2.name,
      station2City: ap2.city,
      station2CountryIso2: ap2.countryIso2,
      station2Lat: ap2.lat,
      station2Lon: ap2.lon,
      distanceNm,
      distanceKm,
      routeType,
      standardBlockMinutes: parsed.data.standardBlockMinutes ?? null,
      isEtops: parsed.data.isEtops ?? false,
      etopsDiversionTimeMinutes: parsed.data.etopsDiversionTimeMinutes ?? null,
      isOverwater: parsed.data.isOverwater ?? false,
      isActive: true,
      notes: parsed.data.notes ?? null,
      createdAt: new Date().toISOString(),
    })

    return reply.code(201).send(doc.toObject())
  })

  // Update city pair
  app.patch('/city-pairs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = cityPairUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const doc = await CityPair.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair not found' })
    return doc
  })

  // Delete city pair
  app.delete('/city-pairs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CityPair.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair not found' })

    await CityPair.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Block Hours CRUD ─────────────────────────────────

  app.post('/city-pairs/:id/block-hours', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = blockHourSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const bh = { _id: crypto.randomUUID(), ...parsed.data }
    const doc = await CityPair.findByIdAndUpdate(id, { $push: { blockHours: bh } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair not found' })
    return doc
  })

  app.patch('/city-pairs/:id/block-hours/:bhId', async (req, reply) => {
    const { id, bhId } = req.params as { id: string; bhId: string }
    const parsed = blockHourSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const setFields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.data)) {
      setFields[`blockHours.$.${k}`] = v
    }

    const doc = await CityPair.findOneAndUpdate(
      { _id: id, 'blockHours._id': bhId },
      { $set: setFields },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair or block hour not found' })
    return doc
  })

  app.delete('/city-pairs/:id/block-hours/:bhId', async (req, reply) => {
    const { id, bhId } = req.params as { id: string; bhId: string }
    const doc = await CityPair.findByIdAndUpdate(id, { $pull: { blockHours: { _id: bhId } } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair not found' })
    return doc
  })

  // ─── Revenue CRUD ─────────────────────────────────

  const revenueSchema = z.object({
    classCode: z.string().min(1).max(3),
    dir1YieldPerPax: z.number().min(0),
    dir2YieldPerPax: z.number().min(0),
    loadFactor: z.number().min(0).max(1).optional().default(0.85),
    currency: z.string().min(1).max(5).optional().default('USD'),
    notes: z.string().nullable().optional(),
  })

  app.post('/city-pairs/:id/revenue', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = revenueSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const entry = { _id: crypto.randomUUID(), ...parsed.data }
    const doc = await CityPair.findByIdAndUpdate(id, { $push: { revenue: entry } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair not found' })
    return doc
  })

  app.patch('/city-pairs/:id/revenue/:revId', async (req, reply) => {
    const { id, revId } = req.params as { id: string; revId: string }
    const parsed = revenueSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const setFields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.data)) {
      setFields[`revenue.$.${k}`] = v
    }

    const doc = await CityPair.findOneAndUpdate(
      { _id: id, 'revenue._id': revId },
      { $set: setFields },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair or revenue entry not found' })
    return doc
  })

  app.delete('/city-pairs/:id/revenue/:revId', async (req, reply) => {
    const { id, revId } = req.params as { id: string; revId: string }
    const doc = await CityPair.findByIdAndUpdate(id, { $pull: { revenue: { _id: revId } } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'City pair not found' })
    return doc
  })

  // ─── Bulk seed revenue for all city pairs ─────────────────

  app.post('/city-pairs/seed-revenue', async (req, reply) => {
    const body = req.body as { operatorId: string; removeB787?: boolean }
    if (!body.operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const pairs = await CityPair.find({ operatorId: body.operatorId, isActive: true }).lean()

    // Optionally remove B787/B788/B789 block hour entries
    if (body.removeB787) {
      const b787Types = ['B787', 'B788', 'B789']
      for (const cp of pairs) {
        const hasB787 = cp.blockHours?.some((bh) => b787Types.includes(bh.aircraftTypeIcao as string))
        if (hasB787) {
          await CityPair.findByIdAndUpdate(cp._id, {
            $pull: { blockHours: { aircraftTypeIcao: { $in: b787Types } } },
          })
        }
      }
    }

    // Yield per pax estimation based on distance
    // Industry averages for Vietnam LCC market (VietJet reference)
    function estimateYield(distanceKm: number, classCode: string): number {
      // Base yield per km by cabin class
      const baseYieldPerKm: Record<string, number> = {
        Y: 0.055, // Economy
        W: 0.09, // Premium Economy (~1.6x Y)
        C: 0.16, // Business (~3x Y)
        F: 0.28, // First (~5x Y)
      }
      const base = baseYieldPerKm[classCode] ?? 0.055
      // Short-haul premium, long-haul discount (yield per km decreases with distance)
      let multiplier: number
      if (distanceKm < 500) multiplier = 1.4
      else if (distanceKm < 1000) multiplier = 1.15
      else if (distanceKm < 2000) multiplier = 1.0
      else if (distanceKm < 4000) multiplier = 0.85
      else multiplier = 0.75
      return Math.round(distanceKm * base * multiplier * 100) / 100
    }

    function estimateLoadFactor(routeType: string, classCode: string): number {
      const factors: Record<string, Record<string, number>> = {
        Y: { domestic: 0.88, regional: 0.85, international: 0.82 },
        W: { domestic: 0.78, regional: 0.75, international: 0.72 },
        C: { domestic: 0.55, regional: 0.6, international: 0.65 },
        F: { domestic: 0.45, regional: 0.48, international: 0.52 },
      }
      const classFactor = factors[classCode] ?? factors.Y
      return classFactor[routeType] ?? classFactor.international ?? 0.8
    }

    // Cabin classes for this operator
    const classDefinitions = [
      { code: 'Y', label: 'Economy' },
      { code: 'W', label: 'Premium Economy' },
      { code: 'C', label: 'Business' },
      { code: 'F', label: 'First' },
    ]

    let seeded = 0
    for (const cp of pairs) {
      const distKm = cp.distanceKm ?? 0
      if (distKm <= 0) continue

      const rt = cp.routeType ?? 'unknown'
      const entries = classDefinitions.map((cls) => ({
        _id: crypto.randomUUID(),
        classCode: cls.code,
        dir1YieldPerPax: estimateYield(distKm, cls.code),
        dir2YieldPerPax: estimateYield(distKm, cls.code),
        loadFactor: estimateLoadFactor(rt, cls.code),
        currency: 'USD',
        notes: 'Auto-seeded from distance model',
      }))

      await CityPair.findByIdAndUpdate(cp._id, { $set: { revenue: entries } })
      seeded++
    }

    return { seeded, total: pairs.length }
  })
}
