import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Airport } from '../models/Airport.js'
import { AircraftType } from '../models/AircraftType.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { Country } from '../models/Country.js'
import { DelayCode } from '../models/DelayCode.js'
import { FlightServiceType } from '../models/FlightServiceType.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { ExpiryCode, ExpiryCodeCategory } from '../models/ExpiryCode.js'
import { Operator } from '../models/Operator.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { CabinClass } from '../models/CabinClass.js'
import { LopaConfig } from '../models/LopaConfig.js'
import { lookupByIcao, getStats, loadOurAirportsData } from '../data/ourairports-cache.js'

// ─── Zod schemas for airport validation ───────────────────

const runwaySchema = z.object({
  _id: z.string().optional(),
  identifier: z.string().min(1, 'Runway identifier is required'),
  lengthM: z.number().min(0).nullable().optional(),
  lengthFt: z.number().min(0).nullable().optional(),
  widthM: z.number().min(0).nullable().optional(),
  widthFt: z.number().min(0).nullable().optional(),
  surface: z.string().nullable().optional(),
  ilsCategory: z.string().nullable().optional(),
  lighting: z.boolean().optional().default(false),
  status: z.string().optional().default('active'),
  notes: z.string().nullable().optional(),
})

const airportCreateSchema = z.object({
  icaoCode: z.string().min(3).max(4).regex(/^[A-Z]{3,4}$/, 'ICAO must be 3-4 uppercase letters'),
  iataCode: z.string().length(3).regex(/^[A-Z]{3}$/, 'IATA must be 3 uppercase letters').nullable().optional(),
  name: z.string().min(1, 'Airport name is required'),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  countryId: z.string().nullable().optional(),
  countryName: z.string().nullable().optional(),
  countryIso2: z.string().nullable().optional(),
  countryFlag: z.string().nullable().optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  utcOffsetHours: z.number().min(-12).max(14).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  elevationFt: z.number().min(-1500).max(15000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  isHomeBase: z.boolean().optional().default(false),
  isCrewBase: z.boolean().optional().default(false),
  crewReportingTimeMinutes: z.number().min(0).nullable().optional(),
  crewDebriefTimeMinutes: z.number().min(0).nullable().optional(),
  runways: z.array(runwaySchema).optional().default([]),
  numberOfRunways: z.number().int().min(0).nullable().optional(),
  longestRunwayFt: z.number().min(0).nullable().optional(),
  hasFuelAvailable: z.boolean().optional().default(false),
  hasCrewFacilities: z.boolean().optional().default(false),
  fireCategory: z.number().int().min(1).max(10).nullable().optional(),
  hasCurfew: z.boolean().optional().default(false),
  curfewStart: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM').nullable().optional(),
  curfewEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM').nullable().optional(),
  isSlotControlled: z.boolean().optional().default(false),
  weatherMonitored: z.boolean().optional().default(false),
  weatherStation: z.string().nullable().optional(),
  numberOfGates: z.number().int().min(0).nullable().optional(),
  ianaTimezone: z.string().nullable().optional(),
}).strict()

const airportUpdateSchema = airportCreateSchema.partial()

/** Recompute summary fields from runways array */
function recomputeRunwaySummary(runways: any[]): { numberOfRunways: number; longestRunwayFt: number | null } {
  const active = runways.filter((r: any) => r.status !== 'closed')
  const longest = active.reduce((max: number, r: any) => {
    const ft = Number(r.lengthFt) || 0
    return ft > max ? ft : max
  }, 0)
  return { numberOfRunways: active.length, longestRunwayFt: longest || null }
}

// ─── Zod schemas for country validation ──────────────────

const countryCreateSchema = z.object({
  isoCode2: z.string().length(2).regex(/^[A-Z]{2}$/, 'ISO 2 must be 2 uppercase letters'),
  isoCode3: z.string().length(3).regex(/^[A-Z]{3}$/, 'ISO 3 must be 3 uppercase letters'),
  name: z.string().min(1, 'Country name is required'),
  officialName: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  subRegion: z.string().nullable().optional(),
  icaoPrefix: z.string().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
  currencyName: z.string().nullable().optional(),
  currencySymbol: z.string().nullable().optional(),
  phoneCode: z.string().nullable().optional(),
  flagEmoji: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isActive: z.boolean().optional().default(true),
}).strict()

const countryUpdateSchema = countryCreateSchema.partial()

export async function referenceRoutes(app: FastifyInstance): Promise<void> {
  // ─── Operators ──────────────────────────────────────────
  app.get('/operators', async () => {
    return Operator.find({ isActive: true }).sort({ code: 1 }).lean()
  })

  app.get('/operators/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await Operator.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Operator not found' })
    return doc
  })

  // Update operator
  app.patch('/operators/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>

    // Uppercase codes
    if (body.icaoCode) body.icaoCode = (body.icaoCode as string).toUpperCase()
    if (body.iataCode) body.iataCode = (body.iataCode as string).toUpperCase()
    if (body.code) body.code = (body.code as string).toUpperCase()
    if (body.mainBaseIcao) body.mainBaseIcao = (body.mainBaseIcao as string).toUpperCase()

    body.updatedAt = new Date().toISOString()

    const doc = await Operator.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Operator not found' })
    return doc
  })

  // Upload operator logo
  app.post('/operators/:id/logo', async (req, reply) => {
    const { id } = req.params as { id: string }
    const op = await Operator.findById(id).lean()
    if (!op) return reply.code(404).send({ error: 'Operator not found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })

    const ext = path.extname(file.filename).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.svg', '.webp'].includes(ext)) {
      return reply.code(400).send({ error: 'Only JPG, PNG, SVG, or WebP files are allowed' })
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const filename = `logo-${id}${ext}`
    const filepath = path.join(uploadsDir, filename)
    await pipeline(file.file, fs.createWriteStream(filepath))

    const logoUrl = `/uploads/${filename}`
    await Operator.findByIdAndUpdate(id, { $set: { logoUrl, updatedAt: new Date().toISOString() } })

    return { success: true, logoUrl }
  })

  // Delete operator logo
  app.delete('/operators/:id/logo', async (req, reply) => {
    const { id } = req.params as { id: string }
    const op = await Operator.findById(id).lean()
    if (!op) return reply.code(404).send({ error: 'Operator not found' })

    if (op.logoUrl && op.logoUrl.startsWith('/uploads/')) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const filepath = path.resolve(__dirname, '..', '..', op.logoUrl.replace('/uploads/', 'uploads/'))
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    }

    await Operator.findByIdAndUpdate(id, { $set: { logoUrl: null, updatedAt: new Date().toISOString() } })
    return { success: true }
  })

  // ─── Airports ───────────────────────────────────────────
  app.get('/airports', async (req) => {
    const { active, crewBase, search, country } = req.query as {
      active?: string
      crewBase?: string
      search?: string
      country?: string
    }

    const filter: Record<string, unknown> = {}
    if (active === 'true') filter.isActive = true
    if (crewBase === 'true') filter.isCrewBase = true
    if (country) filter.countryId = country
    if (search) {
      filter.$or = [
        { icaoCode: { $regex: search, $options: 'i' } },
        { iataCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
      ]
    }

    return Airport.find(filter).sort({ icaoCode: 1 }).lean()
  })

  // ─── External Airport Lookup (must be before :id) ───────
  app.get('/airports/lookup', async (req, reply) => {
    const { icao } = req.query as { icao?: string }
    if (!icao || icao.length < 3) {
      return reply.code(400).send({ error: 'Provide an ICAO code (3-4 chars)' })
    }

    const code = icao.toUpperCase()

    // Source 1: OurAirports cache (85k+ airports, instant, includes runways)
    const oa = lookupByIcao(code)
    if (oa) {
      const active = oa.runways.filter(r => r.status !== 'closed')
      const longestFt = active.reduce((max, r) => Math.max(max, r.lengthFt ?? 0), 0)
      return {
        source: 'OurAirports',
        icaoCode: oa.icaoCode,
        iataCode: oa.iataCode,
        name: oa.name,
        city: oa.city,
        country: oa.country,
        timezone: null,
        utcOffsetHours: null,
        latitude: oa.latitude,
        longitude: oa.longitude,
        elevationFt: oa.elevationFt,
        numberOfRunways: active.length || null,
        longestRunwayFt: longestFt || null,
        runways: oa.runways.map(r => ({ ...r, ilsCategory: null, notes: null })),
      }
    }

    // Source 2 (fallback): airportdb.io
    try {
      const res = await fetch(`https://airportdb.io/api/v1/airport/${code}?apiToken=free`)
      if (res.ok) {
        const data = await res.json() as Record<string, any>
        if (data.icao) {
          return { source: 'airportdb.io', ...mapAirportDbResponse(data) }
        }
      }
    } catch { /* fallback */ }

    // Source 3 (fallback): mwgg/Airports — no runway data
    try {
      const res = await fetch('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json')
      if (res.ok) {
        const data = await res.json() as Record<string, any>
        const airport = data[code]
        if (airport) {
          return {
            source: 'mwgg/Airports',
            icaoCode: airport.icao ?? code,
            iataCode: airport.iata || null,
            name: airport.name ?? null,
            city: airport.city ?? null,
            country: airport.country ?? null,
            timezone: airport.tz ?? null,
            utcOffsetHours: null,
            latitude: airport.lat != null ? Number(airport.lat) : null,
            longitude: airport.lon != null ? Number(airport.lon) : null,
            elevationFt: airport.elevation != null ? Number(airport.elevation) : null,
            numberOfRunways: null,
            longestRunwayFt: null,
            runways: [],
          }
        }
      }
    } catch { /* fallback */ }

    return reply.code(404).send({ error: `No airport data found for ICAO code: ${code}` })
  })

  app.get('/airports/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await Airport.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Airport not found' })
    return doc
  })

  // Create airport
  app.post('/airports', async (req, reply) => {
    const raw = req.body as Record<string, unknown>

    // Uppercase codes before validation
    if (raw.icaoCode) raw.icaoCode = (raw.icaoCode as string).toUpperCase()
    if (raw.iataCode) raw.iataCode = (raw.iataCode as string).toUpperCase()

    const parsed = airportCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data as Record<string, unknown>

    // Check for duplicate ICAO
    const existing = await Airport.findOne({ icaoCode: body.icaoCode }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Airport with ICAO code ${body.icaoCode} already exists` })
    }

    // Resolve country denormalized fields if countryId provided
    if (body.countryId) {
      const country = await Country.findById(body.countryId).lean()
      if (country) {
        body.countryName = country.name
        body.countryIso2 = country.isoCode2
        body.countryFlag = country.flagEmoji
      }
    }

    // Assign _id to each runway if provided
    if (Array.isArray(body.runways)) {
      body.runways = body.runways.map((r: any) => ({ _id: crypto.randomUUID(), ...r }))
      const summary = recomputeRunwaySummary(body.runways as any[])
      body.numberOfRunways = summary.numberOfRunways
      body.longestRunwayFt = summary.longestRunwayFt
    }

    const id = crypto.randomUUID()
    const doc = await Airport.create({
      _id: id,
      ...body,
      createdAt: new Date().toISOString(),
    })

    return reply.code(201).send(doc.toObject())
  })

  // Update airport
  app.patch('/airports/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>

    // Uppercase codes before validation
    if (raw.icaoCode) raw.icaoCode = (raw.icaoCode as string).toUpperCase()
    if (raw.iataCode) raw.iataCode = (raw.iataCode as string).toUpperCase()

    const parsed = airportUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data as Record<string, unknown>

    // If countryId changed, re-resolve denormalized fields
    if (body.countryId) {
      const country = await Country.findById(body.countryId).lean()
      if (country) {
        body.countryName = country.name
        body.countryIso2 = country.isoCode2
        body.countryFlag = country.flagEmoji
      }
    }

    const doc = await Airport.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Airport not found' })
    return doc
  })

  // Delete airport — blocked if flights reference this airport
  app.delete('/airports/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const airport = await Airport.findById(id).lean()
    if (!airport) return reply.code(404).send({ error: 'Airport not found' })

    // Check referential integrity — any flights using this ICAO?
    const icao = airport.icaoCode
    const flightCount = await FlightInstance.countDocuments({
      $or: [{ 'dep.icao': icao }, { 'arr.icao': icao }],
    })

    if (flightCount > 0) {
      return reply.code(409).send({
        error: `Cannot delete ${icao} — ${flightCount} flight${flightCount > 1 ? 's' : ''} reference this airport. Deactivate it instead.`,
      })
    }

    await Airport.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Airport Runways CRUD ──────────────────────────────
  // Add runway
  app.post('/airports/:id/runways', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = runwaySchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const runway = { _id: crypto.randomUUID(), ...parsed.data }
    const doc = await Airport.findByIdAndUpdate(
      id,
      { $push: { runways: runway } },
      { new: true }
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Airport not found' })

    // Recompute summary
    const summary = recomputeRunwaySummary(doc.runways ?? [])
    await Airport.findByIdAndUpdate(id, { $set: summary })
    return { ...doc, ...summary }
  })

  // Update runway
  app.patch('/airports/:id/runways/:rwId', async (req, reply) => {
    const { id, rwId } = req.params as { id: string; rwId: string }
    const parsed = runwaySchema.partial().safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    // Build $set fields for the matched array element
    const setFields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.data)) {
      setFields[`runways.$.${k}`] = v
    }

    const doc = await Airport.findOneAndUpdate(
      { _id: id, 'runways._id': rwId },
      { $set: setFields },
      { new: true }
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Airport or runway not found' })

    const summary = recomputeRunwaySummary(doc.runways ?? [])
    await Airport.findByIdAndUpdate(id, { $set: summary })
    return { ...doc, ...summary }
  })

  // Delete runway
  app.delete('/airports/:id/runways/:rwId', async (req, reply) => {
    const { id, rwId } = req.params as { id: string; rwId: string }
    const doc = await Airport.findByIdAndUpdate(
      id,
      { $pull: { runways: { _id: rwId } } },
      { new: true }
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Airport not found' })

    const summary = recomputeRunwaySummary(doc.runways ?? [])
    await Airport.findByIdAndUpdate(id, { $set: summary })
    return { ...doc, ...summary }
  })

  // ─── Aircraft Types ─────────────────────────────────────

  const aircraftTypeCreateSchema = z.object({
    operatorId: z.string().min(1),
    icaoType: z.string().min(1).max(4),
    iataType: z.string().max(3).nullable().optional(),
    iataTypeCode: z.string().max(4).nullable().optional(),
    name: z.string().min(1, 'Name is required'),
    family: z.string().nullable().optional(),
    category: z.enum(['narrow_body', 'wide_body', 'regional', 'turboprop']).optional().default('narrow_body'),
    manufacturer: z.string().nullable().optional(),
    paxCapacity: z.number().int().min(0).nullable().optional(),
    cockpitCrewRequired: z.number().int().min(0).optional().default(2),
    cabinCrewRequired: z.number().int().min(0).nullable().optional(),
    tat: z.object({
      defaultMinutes: z.number().nullable().optional(),
      domDom: z.number().nullable().optional(),
      domInt: z.number().nullable().optional(),
      intDom: z.number().nullable().optional(),
      intInt: z.number().nullable().optional(),
      minDd: z.number().nullable().optional(),
      minDi: z.number().nullable().optional(),
      minId: z.number().nullable().optional(),
      minIi: z.number().nullable().optional(),
    }).optional(),
    performance: z.object({
      mtowKg: z.number().nullable().optional(),
      mlwKg: z.number().nullable().optional(),
      mzfwKg: z.number().nullable().optional(),
      oewKg: z.number().nullable().optional(),
      maxFuelCapacityKg: z.number().nullable().optional(),
      maxRangeNm: z.number().nullable().optional(),
      cruisingSpeedKts: z.number().nullable().optional(),
      ceilingFl: z.number().nullable().optional(),
    }).optional(),
    fuelBurnRateKgPerHour: z.number().nullable().optional(),
    etopsCapable: z.boolean().optional().default(false),
    etopsRatingMinutes: z.number().nullable().optional(),
    noiseCategory: z.string().nullable().optional(),
    emissionsCategory: z.string().nullable().optional(),
    cargo: z.object({
      maxCargoWeightKg: z.number().nullable().optional(),
      cargoPositions: z.number().nullable().optional(),
      bulkHoldCapacityKg: z.number().nullable().optional(),
      uldTypesAccepted: z.array(z.string()).optional(),
    }).optional(),
    crewRest: z.object({
      cockpitClass: z.string().nullable().optional(),
      cockpitPositions: z.number().nullable().optional(),
      cabinClass: z.string().nullable().optional(),
      cabinPositions: z.number().nullable().optional(),
    }).optional(),
    weather: z.object({
      minCeilingFt: z.number().nullable().optional(),
      minRvrM: z.number().nullable().optional(),
      minVisibilityM: z.number().nullable().optional(),
      maxCrosswindKt: z.number().nullable().optional(),
      maxWindKt: z.number().nullable().optional(),
    }).optional(),
    approach: z.object({
      ilsCategoryRequired: z.string().nullable().optional(),
      autolandCapable: z.boolean().optional(),
    }).optional(),
    notes: z.string().nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color').nullable().optional(),
    isActive: z.boolean().optional().default(true),
  }).strict()

  const aircraftTypeUpdateSchema = z.object({
    icaoType: z.string().min(1).max(4),
    iataType: z.string().max(3).nullable(),
    iataTypeCode: z.string().max(4).nullable(),
    name: z.string().min(1),
    family: z.string().nullable(),
    category: z.enum(['narrow_body', 'wide_body', 'regional', 'turboprop']),
    manufacturer: z.string().nullable(),
    paxCapacity: z.number().int().min(0).nullable(),
    cockpitCrewRequired: z.number().int().min(0),
    cabinCrewRequired: z.number().int().min(0).nullable(),
    tat: z.object({
      defaultMinutes: z.number().nullable().optional(),
      domDom: z.number().nullable().optional(),
      domInt: z.number().nullable().optional(),
      intDom: z.number().nullable().optional(),
      intInt: z.number().nullable().optional(),
      minDd: z.number().nullable().optional(),
      minDi: z.number().nullable().optional(),
      minId: z.number().nullable().optional(),
      minIi: z.number().nullable().optional(),
    }),
    performance: z.object({
      mtowKg: z.number().nullable().optional(),
      mlwKg: z.number().nullable().optional(),
      mzfwKg: z.number().nullable().optional(),
      oewKg: z.number().nullable().optional(),
      maxFuelCapacityKg: z.number().nullable().optional(),
      maxRangeNm: z.number().nullable().optional(),
      cruisingSpeedKts: z.number().nullable().optional(),
      ceilingFl: z.number().nullable().optional(),
    }),
    fuelBurnRateKgPerHour: z.number().nullable(),
    etopsCapable: z.boolean(),
    etopsRatingMinutes: z.number().nullable(),
    noiseCategory: z.string().nullable(),
    emissionsCategory: z.string().nullable(),
    cargo: z.object({
      maxCargoWeightKg: z.number().nullable().optional(),
      cargoPositions: z.number().nullable().optional(),
      bulkHoldCapacityKg: z.number().nullable().optional(),
      uldTypesAccepted: z.array(z.string()).optional(),
    }),
    crewRest: z.object({
      cockpitClass: z.string().nullable().optional(),
      cockpitPositions: z.number().nullable().optional(),
      cabinClass: z.string().nullable().optional(),
      cabinPositions: z.number().nullable().optional(),
    }),
    weather: z.object({
      minCeilingFt: z.number().nullable().optional(),
      minRvrM: z.number().nullable().optional(),
      minVisibilityM: z.number().nullable().optional(),
      maxCrosswindKt: z.number().nullable().optional(),
      maxWindKt: z.number().nullable().optional(),
    }),
    approach: z.object({
      ilsCategoryRequired: z.string().nullable().optional(),
      autolandCapable: z.boolean().optional(),
    }),
    notes: z.string().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color').nullable(),
    isActive: z.boolean(),
  }).partial().strict()

  app.get('/aircraft-types', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return AircraftType.find(filter).sort({ icaoType: 1 }).lean()
  })

  app.get('/aircraft-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await AircraftType.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Aircraft type not found' })
    return doc
  })

  app.post('/aircraft-types', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.icaoType) raw.icaoType = (raw.icaoType as string).toUpperCase()

    const parsed = aircraftTypeCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data

    const existing = await AircraftType.findOne({ operatorId: body.operatorId, icaoType: body.icaoType }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Aircraft type "${body.icaoType}" already exists` })
    }

    const id = crypto.randomUUID()
    const doc = await AircraftType.create({
      _id: id,
      ...body,
      createdAt: new Date().toISOString(),
    })

    // Auto-provision fuselage image folder for LOPA seat map
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const assetsDir = path.resolve(__dirname, '../../../apps/web/public/assets/aircraft')
      const templateFuselage = path.join(assetsDir, 'A320', 'fuselage.png')
      const targetDir = path.join(assetsDir, body.icaoType)
      const targetFile = path.join(targetDir, 'fuselage.png')
      if (fs.existsSync(templateFuselage) && !fs.existsSync(targetFile)) {
        fs.mkdirSync(targetDir, { recursive: true })
        fs.copyFileSync(templateFuselage, targetFile)
      }
    } catch { /* non-critical — seat map falls back to SVG */ }

    return reply.code(201).send(doc.toObject())
  })

  app.patch('/aircraft-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.icaoType) raw.icaoType = (raw.icaoType as string).toUpperCase()

    const parsed = aircraftTypeUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await AircraftType.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Aircraft type not found' })
    return doc
  })

  app.delete('/aircraft-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const acType = await AircraftType.findById(id).lean()
    if (!acType) return reply.code(404).send({ error: 'Aircraft type not found' })

    // Safety: check if LOPA configs reference this type
    const refCount = await LopaConfig.countDocuments({
      operatorId: acType.operatorId,
      aircraftType: acType.icaoType,
    })
    if (refCount > 0) {
      return reply.code(409).send({
        error: `Cannot delete "${acType.icaoType}" — ${refCount} LOPA config${refCount > 1 ? 's' : ''} reference this aircraft type. Deactivate it instead.`,
      })
    }

    await AircraftType.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Aircraft Registrations ─────────────────────────────

  const aircraftRegCreateSchema = z.object({
    operatorId: z.string().min(1),
    registration: z.string().min(1).max(10),
    aircraftTypeId: z.string().min(1),
    lopaConfigId: z.string().nullable().optional(),
    serialNumber: z.string().nullable().optional(),
    variant: z.string().nullable().optional(),
    status: z.enum(['active', 'maintenance', 'stored', 'retired']).optional().default('active'),
    homeBaseIcao: z.string().max(4).nullable().optional(),
    currentLocationIcao: z.string().max(4).nullable().optional(),
    dateOfManufacture: z.string().nullable().optional(),
    dateOfDelivery: z.string().nullable().optional(),
    leaseExpiryDate: z.string().nullable().optional(),
    selcal: z.string().max(8).nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    isActive: z.boolean().optional().default(true),
  }).strict()

  const aircraftRegUpdateSchema = z.object({
    registration: z.string().min(1).max(10),
    aircraftTypeId: z.string().min(1),
    lopaConfigId: z.string().nullable(),
    serialNumber: z.string().nullable(),
    variant: z.string().nullable(),
    status: z.enum(['active', 'maintenance', 'stored', 'retired']),
    homeBaseIcao: z.string().max(4).nullable(),
    currentLocationIcao: z.string().max(4).nullable(),
    currentLocationUpdatedAt: z.string().nullable(),
    dateOfManufacture: z.string().nullable(),
    dateOfDelivery: z.string().nullable(),
    leaseExpiryDate: z.string().nullable(),
    selcal: z.string().max(8).nullable(),
    imageUrl: z.string().nullable(),
    notes: z.string().nullable(),
    isActive: z.boolean(),
  }).partial().strict()

  app.get('/aircraft-registrations', async (req) => {
    const { operatorId, aircraftTypeId } = req.query as { operatorId?: string; aircraftTypeId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    if (aircraftTypeId) filter.aircraftTypeId = aircraftTypeId
    return AircraftRegistration.find(filter).sort({ registration: 1 }).lean()
  })

  app.get('/aircraft-registrations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await AircraftRegistration.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Aircraft registration not found' })
    return doc
  })

  app.post('/aircraft-registrations', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.registration) raw.registration = (raw.registration as string).toUpperCase()
    if (raw.homeBaseIcao) raw.homeBaseIcao = (raw.homeBaseIcao as string).toUpperCase()

    const parsed = aircraftRegCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data

    const existing = await AircraftRegistration.findOne({ operatorId: body.operatorId, registration: body.registration }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Registration "${body.registration}" already exists` })
    }

    const id = crypto.randomUUID()
    const doc = await AircraftRegistration.create({
      _id: id,
      ...body,
      createdAt: new Date().toISOString(),
    })

    return reply.code(201).send(doc.toObject())
  })

  app.patch('/aircraft-registrations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.registration) raw.registration = (raw.registration as string).toUpperCase()
    if (raw.homeBaseIcao) raw.homeBaseIcao = (raw.homeBaseIcao as string).toUpperCase()

    const parsed = aircraftRegUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await AircraftRegistration.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Aircraft registration not found' })
    return doc
  })

  app.delete('/aircraft-registrations/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const reg = await AircraftRegistration.findById(id).lean()
    if (!reg) return reply.code(404).send({ error: 'Aircraft registration not found' })

    // Safety: check if flight instances reference this registration
    const refCount = await FlightInstance.countDocuments({ aircraftRegistrationId: id })
    if (refCount > 0) {
      return reply.code(409).send({
        error: `Cannot delete "${reg.registration}" — ${refCount} flight${refCount > 1 ? 's' : ''} reference this registration. Deactivate it instead.`,
      })
    }

    await AircraftRegistration.findByIdAndDelete(id)
    return { success: true }
  })

  // Upload aircraft registration image
  app.post('/aircraft-registrations/:id/image', async (req, reply) => {
    const { id } = req.params as { id: string }
    const reg = await AircraftRegistration.findById(id).lean()
    if (!reg) return reply.code(404).send({ error: 'Registration not found' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })

    const ext = path.extname(file.filename).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return reply.code(400).send({ error: 'Only JPG, PNG, or WebP files are allowed' })
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const filename = `aircraft-${id}${ext}`
    const filepath = path.join(uploadsDir, filename)
    await pipeline(file.file, fs.createWriteStream(filepath))

    const imageUrl = `/uploads/${filename}`
    await AircraftRegistration.findByIdAndUpdate(id, { $set: { imageUrl, updatedAt: new Date().toISOString() } })

    return { success: true, imageUrl }
  })

  // ─── Countries ──────────────────────────────────────────
  app.get('/countries', async (req) => {
    const { region, search } = req.query as { region?: string; search?: string }
    const filter: Record<string, unknown> = { isActive: true }
    if (region) filter.region = region
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { isoCode2: { $regex: search, $options: 'i' } },
        { isoCode3: { $regex: search, $options: 'i' } },
      ]
    }
    return Country.find(filter).sort({ name: 1 }).lean()
  })

  app.get('/countries/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await Country.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Country not found' })
    return doc
  })

  // Create country
  app.post('/countries', async (req, reply) => {
    const raw = req.body as Record<string, unknown>

    if (raw.isoCode2) raw.isoCode2 = (raw.isoCode2 as string).toUpperCase()
    if (raw.isoCode3) raw.isoCode3 = (raw.isoCode3 as string).toUpperCase()

    const parsed = countryCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data as Record<string, unknown>

    // Check for duplicate ISO2
    const existing = await Country.findOne({ isoCode2: body.isoCode2 }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Country with ISO code ${body.isoCode2} already exists` })
    }

    const id = crypto.randomUUID()
    const doc = await Country.create({
      _id: id,
      ...body,
      createdAt: new Date().toISOString(),
    })

    return reply.code(201).send(doc.toObject())
  })

  // Update country
  app.patch('/countries/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>

    if (raw.isoCode2) raw.isoCode2 = (raw.isoCode2 as string).toUpperCase()
    if (raw.isoCode3) raw.isoCode3 = (raw.isoCode3 as string).toUpperCase()

    const parsed = countryUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data as Record<string, unknown>
    const doc = await Country.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Country not found' })
    return doc
  })

  // Delete country — blocked if airports reference this country
  app.delete('/countries/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const country = await Country.findById(id).lean()
    if (!country) return reply.code(404).send({ error: 'Country not found' })

    const airportCount = await Airport.countDocuments({ countryId: id })
    if (airportCount > 0) {
      return reply.code(409).send({
        error: `Cannot delete ${country.name} — ${airportCount} airport${airportCount > 1 ? 's' : ''} reference this country. Deactivate it instead.`,
      })
    }

    await Country.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Delay Codes ────────────────────────────────────────
  app.get('/delay-codes', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = { isActive: true }
    if (operatorId) filter.operatorId = operatorId
    return DelayCode.find(filter).sort({ code: 1 }).lean()
  })

  // ─── Flight Service Types ──────────────────────────────
  app.get('/flight-service-types', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = { isActive: true }
    if (operatorId) filter.operatorId = operatorId
    return FlightServiceType.find(filter).sort({ code: 1 }).lean()
  })

  // ─── Crew Positions ────────────────────────────────────
  app.get('/crew-positions', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = { isActive: true }
    if (operatorId) filter.operatorId = operatorId
    return CrewPosition.find(filter).sort({ category: 1, rankOrder: 1 }).lean()
  })

  // ─── Expiry Code Categories ────────────────────────────
  app.get('/expiry-code-categories', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return ExpiryCodeCategory.find(filter).sort({ sortOrder: 1 }).lean()
  })

  // ─── Expiry Codes ──────────────────────────────────────
  app.get('/expiry-codes', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = { isActive: true }
    if (operatorId) filter.operatorId = operatorId
    return ExpiryCode.find(filter).sort({ sortOrder: 1, code: 1 }).lean()
  })

  // ─── Cabin Classes ──────────────────────────────────────

  const cabinClassCreateSchema = z.object({
    operatorId: z.string().min(1),
    code: z.string().min(1).max(2).regex(/^[A-Z]{1,2}$/, 'Code must be 1-2 uppercase letters'),
    name: z.string().min(1, 'Name is required'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color').nullable().optional(),
    sortOrder: z.number().int().min(0).optional().default(0),
    seatLayout: z.string().regex(/^[0-9](-[0-9]){1,3}$/, 'Format: 3-3 or 2-2 or 1-2-1').nullable().optional(),
    seatPitchIn: z.number().min(20).max(90).nullable().optional(),
    seatWidthIn: z.number().min(14).max(40).nullable().optional(),
    seatType: z.enum(['standard', 'premium', 'lie-flat', 'suite']).nullable().optional(),
    hasIfe: z.boolean().optional().default(false),
    hasPower: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
  }).strict()

  const cabinClassUpdateSchema = z.object({
    code: z.string().min(1).max(2).regex(/^[A-Z]{1,2}$/, 'Code must be 1-2 uppercase letters'),
    name: z.string().min(1, 'Name is required'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be hex color').nullable(),
    sortOrder: z.number().int().min(0),
    seatLayout: z.string().regex(/^[0-9](-[0-9]){1,3}$/, 'Format: 3-3 or 2-2 or 1-2-1').nullable(),
    seatPitchIn: z.number().min(20).max(90).nullable(),
    seatWidthIn: z.number().min(14).max(40).nullable(),
    seatType: z.enum(['standard', 'premium', 'lie-flat', 'suite']).nullable(),
    hasIfe: z.boolean(),
    hasPower: z.boolean(),
    isActive: z.boolean(),
  }).partial().strict()

  app.get('/cabin-classes', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return CabinClass.find(filter).sort({ sortOrder: 1, code: 1 }).lean()
  })

  app.get('/cabin-classes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CabinClass.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Cabin class not found' })
    return doc
  })

  app.post('/cabin-classes', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()

    const parsed = cabinClassCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data

    const existing = await CabinClass.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Cabin class with code "${body.code}" already exists` })
    }

    const id = crypto.randomUUID()
    const doc = await CabinClass.create({
      _id: id,
      ...body,
      createdAt: new Date().toISOString(),
    })

    return reply.code(201).send(doc.toObject())
  })

  app.patch('/cabin-classes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()

    const parsed = cabinClassUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await CabinClass.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Cabin class not found' })
    return doc
  })

  app.delete('/cabin-classes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const cabinClass = await CabinClass.findById(id).lean()
    if (!cabinClass) return reply.code(404).send({ error: 'Cabin class not found' })

    const refCount = await LopaConfig.countDocuments({
      operatorId: cabinClass.operatorId,
      'cabins.classCode': cabinClass.code,
    })
    if (refCount > 0) {
      return reply.code(409).send({
        error: `Cannot delete "${cabinClass.code}" — ${refCount} LOPA config${refCount > 1 ? 's' : ''} reference this cabin class. Deactivate it instead.`,
      })
    }

    await CabinClass.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── LOPA Configurations ──────────────────────────────

  const lopaConfigCreateSchema = z.object({
    operatorId: z.string().min(1),
    aircraftType: z.string().min(3).max(4).regex(/^[A-Z0-9]{3,4}$/, 'Must be 3-4 uppercase alphanumeric'),
    configName: z.string().min(1, 'Config name is required'),
    cabins: z.array(z.object({
      classCode: z.string().min(1),
      seats: z.number().int().min(0),
    })).min(1, 'At least one cabin entry is required'),
    isDefault: z.boolean().optional().default(false),
    notes: z.string().nullable().optional(),
    isActive: z.boolean().optional().default(true),
  }).strict()

  const lopaConfigUpdateSchema = z.object({
    aircraftType: z.string().min(3).max(4).regex(/^[A-Z0-9]{3,4}$/, 'Must be 3-4 uppercase alphanumeric'),
    configName: z.string().min(1, 'Config name is required'),
    cabins: z.array(z.object({
      classCode: z.string().min(1),
      seats: z.number().int().min(0),
    })).min(1, 'At least one cabin entry is required'),
    isDefault: z.boolean(),
    notes: z.string().nullable(),
    isActive: z.boolean(),
  }).partial().strict()

  app.get('/lopa-configs', async (req) => {
    const { operatorId, aircraftType } = req.query as { operatorId?: string; aircraftType?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    if (aircraftType) filter.aircraftType = aircraftType.toUpperCase()
    return LopaConfig.find(filter).sort({ aircraftType: 1, configName: 1 }).lean()
  })

  app.get('/lopa-configs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await LopaConfig.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'LOPA config not found' })
    return doc
  })

  app.post('/lopa-configs', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.aircraftType) raw.aircraftType = (raw.aircraftType as string).toUpperCase()

    const parsed = lopaConfigCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data
    const totalSeats = body.cabins.reduce((sum, c) => sum + c.seats, 0)

    const existing = await LopaConfig.findOne({
      operatorId: body.operatorId,
      aircraftType: body.aircraftType,
      configName: body.configName,
    }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Config "${body.configName}" for ${body.aircraftType} already exists` })
    }

    // If setting as default, clear other defaults for same operator+aircraftType
    if (body.isDefault) {
      await LopaConfig.updateMany(
        { operatorId: body.operatorId, aircraftType: body.aircraftType },
        { $set: { isDefault: false } }
      )
    }

    const id = crypto.randomUUID()
    const doc = await LopaConfig.create({
      _id: id,
      ...body,
      totalSeats,
      createdAt: new Date().toISOString(),
    })

    return reply.code(201).send(doc.toObject())
  })

  app.patch('/lopa-configs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.aircraftType) raw.aircraftType = (raw.aircraftType as string).toUpperCase()

    const parsed = lopaConfigUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body: Record<string, unknown> = { ...parsed.data, updatedAt: new Date().toISOString() }

    // Recompute totalSeats if cabins changed
    if (parsed.data.cabins) {
      body.totalSeats = parsed.data.cabins.reduce((sum, c) => sum + c.seats, 0)
    }

    // If setting as default, clear other defaults
    if (parsed.data.isDefault) {
      const current = await LopaConfig.findById(id).lean()
      if (current) {
        await LopaConfig.updateMany(
          { operatorId: current.operatorId, aircraftType: parsed.data.aircraftType ?? current.aircraftType, _id: { $ne: id } },
          { $set: { isDefault: false } }
        )
      }
    }

    const doc = await LopaConfig.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'LOPA config not found' })
    return doc
  })

  app.delete('/lopa-configs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await LopaConfig.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'LOPA config not found' })

    await LopaConfig.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Stats endpoint — quick overview ───────────────────
  app.get('/reference/stats', async () => {
    const [
      operators,
      airports,
      aircraftTypes,
      countries,
      delayCodes,
      flightServiceTypes,
      crewPositions,
      expiryCodeCategories,
      expiryCodes,
      cabinClasses,
      lopaConfigs,
    ] = await Promise.all([
      Operator.countDocuments(),
      Airport.countDocuments(),
      AircraftType.countDocuments(),
      Country.countDocuments(),
      DelayCode.countDocuments(),
      FlightServiceType.countDocuments(),
      CrewPosition.countDocuments(),
      ExpiryCodeCategory.countDocuments(),
      ExpiryCode.countDocuments(),
      CabinClass.countDocuments(),
      LopaConfig.countDocuments(),
    ])

    const cacheStats = getStats()

    return {
      operators,
      airports,
      aircraftTypes,
      countries,
      delayCodes,
      flightServiceTypes,
      crewPositions,
      expiryCodeCategories,
      expiryCodes,
      cabinClasses,
      lopaConfigs,
      total:
        operators +
        airports +
        aircraftTypes +
        countries +
        delayCodes +
        flightServiceTypes +
        crewPositions +
        expiryCodeCategories +
        expiryCodes +
        cabinClasses +
        lopaConfigs,
      ourAirportsCache: {
        loaded: cacheStats.loaded,
        airports: cacheStats.airports,
        lastRefreshed: cacheStats.lastLoadTime ? new Date(cacheStats.lastLoadTime).toISOString() : null,
        ageMinutes: cacheStats.lastLoadTime ? Math.round((Date.now() - cacheStats.lastLoadTime) / 60000) : null,
      },
    }
  })

  // ─── Manual cache refresh ──────────────────────────────
  app.post('/reference/refresh-cache', async () => {
    await loadOurAirportsData()
    const stats = getStats()
    return {
      success: true,
      airports: stats.airports,
      lastRefreshed: new Date(stats.lastLoadTime).toISOString(),
    }
  })
}

// ─── External lookup mappers ──────────────────────────────

function mapAirportDbResponse(data: Record<string, any>) {
  const rawRunways = Array.isArray(data.runways) ? data.runways : []

  // Map individual runways
  const runways = rawRunways.map((r: any) => {
    const lengthFt = Number(r.length_ft) || null
    const widthFt = Number(r.width_ft) || null
    return {
      identifier: r.le_ident && r.he_ident ? `${r.le_ident}/${r.he_ident}` : r.le_ident || r.he_ident || 'Unknown',
      lengthM: lengthFt ? Math.round(lengthFt * 0.3048) : null,
      lengthFt,
      widthM: widthFt ? Math.round(widthFt * 0.3048) : null,
      widthFt,
      surface: r.surface ?? null,
      ilsCategory: null,
      lighting: r.lighted === true || r.lighted === 1 || r.lighted === '1',
      status: r.closed ? 'closed' : 'active',
      notes: null,
    }
  })

  const longestRunway = rawRunways.reduce((max: number, r: any) => {
    const len = Number(r.length_ft) || 0
    return len > max ? len : max
  }, 0)

  return {
    icaoCode: data.icao ?? null,
    iataCode: data.iata ?? null,
    name: data.name ?? null,
    city: data.municipality ?? null,
    country: data.iso_country ?? null,
    timezone: data.timezone?.tzid ?? null,
    utcOffsetHours: data.timezone?.offset != null ? Number(data.timezone.offset) : null,
    latitude: data.latitude_deg != null ? Number(data.latitude_deg) : null,
    longitude: data.longitude_deg != null ? Number(data.longitude_deg) : null,
    elevationFt: data.elevation_ft != null ? Number(data.elevation_ft) : null,
    numberOfRunways: runways.length || null,
    longestRunwayFt: longestRunway || null,
    runways,
  }
}

function mapAviowikiResponse(data: Record<string, any>) {
  const rawRunways = Array.isArray(data.runways) ? data.runways : []
  const runways = rawRunways.map((r: any) => ({
    identifier: r.ident ?? r.identifier ?? r.name ?? 'Unknown',
    lengthM: r.length_m != null ? Number(r.length_m) : null,
    lengthFt: r.length_ft != null ? Number(r.length_ft) : (r.length_m != null ? Math.round(Number(r.length_m) / 0.3048) : null),
    widthM: r.width_m != null ? Number(r.width_m) : null,
    widthFt: r.width_ft != null ? Number(r.width_ft) : (r.width_m != null ? Math.round(Number(r.width_m) / 0.3048) : null),
    surface: r.surface ?? null,
    ilsCategory: null,
    lighting: r.lighted === true || r.lighted === 1,
    status: 'active',
    notes: null,
  }))

  return {
    icaoCode: data.icao ?? data.icaoCode ?? null,
    iataCode: data.iata ?? data.iataCode ?? null,
    name: data.name ?? null,
    city: data.city ?? data.municipality ?? null,
    country: data.country?.code ?? data.countryCode ?? null,
    timezone: data.timezone ?? null,
    latitude: data.latitude != null ? Number(data.latitude) : null,
    longitude: data.longitude != null ? Number(data.longitude) : null,
    elevationFt: data.elevation?.feet != null ? Number(data.elevation.feet) : (data.elevationFt ?? null),
    numberOfRunways: runways.length || null,
    longestRunwayFt: null,
    runways,
  }
}
