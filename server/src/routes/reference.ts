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
import { ActivityCodeGroup, ActivityCode } from '../models/ActivityCode.js'
import { CrewComplement } from '../models/CrewComplement.js'
import { CrewGroup } from '../models/CrewGroup.js'
import { DutyPattern } from '../models/DutyPattern.js'
import { MppLeadTimeGroup, MppLeadTimeItem } from '../models/MppLeadTime.js'
import { CarrierCode } from '../models/CarrierCode.js'
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
    etopsCapable: z.boolean().optional(),
    etopsRatingMinutes: z.number().nullable().optional(),
    weatherLimitations: z.object({
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
    noiseCategory: z.string().nullable().optional(),
    emissionsCategory: z.string().nullable().optional(),
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
    weatherLimitations: z.object({
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
    noiseCategory: z.string().nullable(),
    emissionsCategory: z.string().nullable(),
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
  const delayCodeCreateSchema = z.object({
    operatorId: z.string().min(1),
    code: z.string().min(1).max(3),
    alphaCode: z.string().max(2).nullable().optional(),
    ahm732Process: z.string().max(1).nullable().optional(),
    ahm732Reason: z.string().max(1).nullable().optional(),
    ahm732Stakeholder: z.string().max(1).nullable().optional(),
    category: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    isActive: z.boolean().optional().default(true),
    isIataStandard: z.boolean().optional().default(false),
  }).strict()

  const delayCodeUpdateSchema = z.object({
    code: z.string().min(1).max(3),
    alphaCode: z.string().max(2).nullable(),
    ahm732Process: z.string().max(1).nullable(),
    ahm732Reason: z.string().max(1).nullable(),
    ahm732Stakeholder: z.string().max(1).nullable(),
    category: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    isActive: z.boolean(),
    isIataStandard: z.boolean(),
  }).partial().strict()

  app.get('/delay-codes', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return DelayCode.find(filter).sort({ code: 1 }).lean()
  })

  app.get('/delay-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await DelayCode.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Delay code not found' })
    return doc
  })

  app.post('/delay-codes', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    const parsed = delayCodeCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data
    const existing = await DelayCode.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) return reply.code(409).send({ error: `Delay code "${body.code}" already exists` })
    const id = crypto.randomUUID()
    const doc = await DelayCode.create({ _id: id, ...body, createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/delay-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = delayCodeUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await DelayCode.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Delay code not found' })
    return doc
  })

  app.delete('/delay-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await DelayCode.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Delay code not found' })
    await DelayCode.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Flight Service Types ──────────────────────────────
  const fstCreateSchema = z.object({
    operatorId: z.string().min(1),
    code: z.string().min(1).max(2),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    isActive: z.boolean().optional().default(true),
  }).strict()

  const fstUpdateSchema = z.object({
    code: z.string().min(1).max(2),
    name: z.string().min(1),
    description: z.string().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    isActive: z.boolean(),
  }).partial().strict()

  app.get('/flight-service-types', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return FlightServiceType.find(filter).sort({ code: 1 }).lean()
  })

  app.get('/flight-service-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await FlightServiceType.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Flight service type not found' })
    return doc
  })

  app.post('/flight-service-types', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()

    const parsed = fstCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data
    const existing = await FlightServiceType.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) return reply.code(409).send({ error: `Service type "${body.code}" already exists` })

    const id = crypto.randomUUID()
    const doc = await FlightServiceType.create({ _id: id, ...body, createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/flight-service-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()

    const parsed = fstUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await FlightServiceType.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Flight service type not found' })
    return doc
  })

  app.delete('/flight-service-types/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await FlightServiceType.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Flight service type not found' })
    await FlightServiceType.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Crew Positions ────────────────────────────────────
  app.get('/crew-positions', async (req) => {
    const { operatorId, includeInactive } = req.query as { operatorId?: string; includeInactive?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    if (includeInactive !== 'true') filter.isActive = true
    return CrewPosition.find(filter).sort({ category: 1, rankOrder: 1 }).lean()
  })

  const crewPositionCreateSchema = z.object({
    operatorId: z.string().min(1),
    code: z.string().min(1).max(3).regex(/^[A-Z]{1,3}$/, 'Code must be 1-3 uppercase letters'),
    name: z.string().min(1, 'Name is required'),
    category: z.enum(['cockpit', 'cabin']),
    rankOrder: z.number().int().min(0),
    isPic: z.boolean().optional().default(false),
    canDownrank: z.boolean().optional().default(false),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    description: z.string().nullable().optional(),
    isActive: z.boolean().optional().default(true),
  }).strict()

  const crewPositionUpdateSchema = z.object({
    code: z.string().min(1).max(3).regex(/^[A-Z]{1,3}$/),
    name: z.string().min(1),
    category: z.enum(['cockpit', 'cabin']),
    rankOrder: z.number().int().min(0),
    isPic: z.boolean(),
    canDownrank: z.boolean(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    description: z.string().nullable(),
    isActive: z.boolean(),
  }).partial().strict()

  app.post('/crew-positions', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = crewPositionCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data
    const existing = await CrewPosition.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) return reply.code(409).send({ error: `Position "${body.code}" already exists` })

    const id = crypto.randomUUID()
    const doc = await CrewPosition.create({ _id: id, ...body, createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/crew-positions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = crewPositionUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await CrewPosition.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew position not found' })
    return doc
  })

  app.get('/crew-positions/:id/references', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CrewPosition.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew position not found' })

    const expiryCodes = await ExpiryCode.countDocuments({
      $or: [{ crewCategory: doc.category }, { crewCategory: 'both' }],
      isActive: true,
    })
    const crewComplements = await CrewComplement.countDocuments({
      operatorId: doc.operatorId,
      [`counts.${doc.code}`]: { $exists: true, $gt: 0 },
    })
    return { expiryCodes, crewComplements }
  })

  app.delete('/crew-positions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CrewPosition.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew position not found' })

    // Check if referenced by expiry codes
    const expiryRefs = await ExpiryCode.countDocuments({
      $or: [{ crewCategory: doc.category }, { crewCategory: 'both' }],
      isActive: true,
    })
    if (expiryRefs > 0) {
      return reply.code(409).send({
        error: `Position is referenced by ${expiryRefs} expiry code(s). Deactivate instead of deleting.`,
        canDeactivate: true,
      })
    }

    await CrewPosition.findByIdAndDelete(id)
    return { success: true }
  })

  // Seed default crew positions
  app.post('/crew-positions/seed-defaults', async (req, reply) => {
    const { operatorId } = req.body as { operatorId: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId is required' })

    const existing = await CrewPosition.countDocuments({ operatorId })
    if (existing > 0) return reply.code(400).send({ error: 'Crew positions already exist for this operator' })

    const now = new Date().toISOString()
    const defaults = [
      { code: 'CP', name: 'Captain', category: 'cockpit', rankOrder: 1, isPic: true, color: '#4338ca' },
      { code: 'FO', name: 'First Officer', category: 'cockpit', rankOrder: 2, isPic: false, color: '#4f46e5' },
      { code: 'SO', name: 'Second Officer', category: 'cockpit', rankOrder: 3, isPic: false, color: '#6366f1' },
      { code: 'FE', name: 'Flight Engineer', category: 'cockpit', rankOrder: 4, isPic: false, color: '#818cf8' },
      { code: 'CC', name: 'Cabin Chief', category: 'cabin', rankOrder: 1, isPic: false, color: '#92400e' },
      { code: 'SP', name: 'Senior Purser', category: 'cabin', rankOrder: 2, isPic: false, color: '#b45309' },
      { code: 'PS', name: 'Purser', category: 'cabin', rankOrder: 3, isPic: false, color: '#d97706' },
      { code: 'FA', name: 'Flight Attendant', category: 'cabin', rankOrder: 4, isPic: false, color: '#c2410c' },
      { code: 'TF', name: 'Trainee FA', category: 'cabin', rankOrder: 5, isPic: false, color: '#ea580c' },
    ]

    const rows = defaults.map(d => ({
      _id: crypto.randomUUID(),
      operatorId,
      ...d,
      canDownrank: false,
      description: null,
      isActive: true,
      createdAt: now,
      updatedAt: null,
    }))

    await CrewPosition.insertMany(rows)
    return { success: true }
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

  // ─── Activity Code Groups ──────────────────────────────
  const acGroupCreateSchema = z.object({
    operatorId: z.string().min(1),
    code: z.string().min(1).max(8),
    name: z.string().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sortOrder: z.number().int().min(0).optional(),
  }).strict()

  const acGroupUpdateSchema = z.object({
    code: z.string().min(1).max(8),
    name: z.string().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sortOrder: z.number().int().min(0),
  }).partial().strict()

  app.get('/activity-code-groups', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return ActivityCodeGroup.find(filter).sort({ sortOrder: 1, code: 1 }).lean()
  })

  app.post('/activity-code-groups', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = acGroupCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data
    const existing = await ActivityCodeGroup.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) return reply.code(409).send({ error: `Group "${body.code}" already exists` })

    // Auto sort order if not provided
    if (body.sortOrder == null) {
      const count = await ActivityCodeGroup.countDocuments({ operatorId: body.operatorId })
      body.sortOrder = (count + 1) * 10
    }

    const id = crypto.randomUUID()
    const doc = await ActivityCodeGroup.create({ _id: id, ...body, createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/activity-code-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = acGroupUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await ActivityCodeGroup.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Group not found' })
    return doc
  })

  app.delete('/activity-code-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const group = await ActivityCodeGroup.findById(id).lean()
    if (!group) return reply.code(404).send({ error: 'Group not found' })
    const codeCount = await ActivityCode.countDocuments({ groupId: id })
    if (codeCount > 0) {
      return reply.code(409).send({
        error: `Cannot delete "${group.name}" — ${codeCount} activity code${codeCount > 1 ? 's' : ''} belong to this group. Remove them first.`,
      })
    }
    await ActivityCodeGroup.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Activity Codes ────────────────────────────────────
  const acCodeCreateSchema = z.object({
    operatorId: z.string().min(1),
    groupId: z.string().min(1),
    code: z.string().min(1).max(8),
    name: z.string().min(1).max(60),
    description: z.string().nullable().optional(),
    shortLabel: z.string().nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    isSystem: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    isArchived: z.boolean().optional().default(false),
    flags: z.array(z.string()).optional().default([]),
    creditRatio: z.number().nullable().optional(),
    creditFixedMin: z.number().int().nullable().optional(),
    payRatio: z.number().nullable().optional(),
    minRestBeforeMin: z.number().int().nullable().optional(),
    minRestAfterMin: z.number().int().nullable().optional(),
    defaultDurationMin: z.number().int().nullable().optional(),
    requiresTime: z.boolean().optional().default(false),
    defaultStartTime: z.string().nullable().optional(),
    defaultEndTime: z.string().nullable().optional(),
    simPlatform: z.string().nullable().optional(),
    simDurationMin: z.number().int().nullable().optional(),
    applicablePositions: z.array(z.string()).optional().default([]),
  }).strict()

  const acCodeUpdateSchema = z.object({
    groupId: z.string().min(1),
    code: z.string().min(1).max(8),
    name: z.string().min(1).max(60),
    description: z.string().nullable(),
    shortLabel: z.string().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    isActive: z.boolean(),
    isArchived: z.boolean(),
    creditRatio: z.number().nullable(),
    creditFixedMin: z.number().int().nullable(),
    payRatio: z.number().nullable(),
    minRestBeforeMin: z.number().int().nullable(),
    minRestAfterMin: z.number().int().nullable(),
    defaultDurationMin: z.number().int().nullable(),
    requiresTime: z.boolean(),
    defaultStartTime: z.string().nullable(),
    defaultEndTime: z.string().nullable(),
    simPlatform: z.string().nullable(),
    simDurationMin: z.number().int().nullable(),
  }).partial().strict()

  app.get('/activity-codes', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return ActivityCode.find(filter).sort({ code: 1 }).lean()
  })

  app.get('/activity-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await ActivityCode.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Activity code not found' })
    return doc
  })

  app.post('/activity-codes', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = acCodeCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data
    const existing = await ActivityCode.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) return reply.code(409).send({ error: `Activity code "${body.code}" already exists` })
    const id = crypto.randomUUID()
    const doc = await ActivityCode.create({ _id: id, ...body, createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/activity-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = acCodeUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const existing = await ActivityCode.findById(id).lean()
    if (!existing) return reply.code(404).send({ error: 'Activity code not found' })
    if (existing.isSystem) {
      // System codes: only allow color updates
      const allowed = { color: parsed.data.color, updatedAt: new Date().toISOString() } as Record<string, unknown>
      Object.keys(allowed).forEach(k => { if (allowed[k] === undefined) delete allowed[k] })
      const doc = await ActivityCode.findByIdAndUpdate(id, { $set: allowed }, { new: true }).lean()
      return doc
    }
    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await ActivityCode.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    return doc
  })

  app.patch('/activity-codes/:id/flags', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { flags } = req.body as { flags: string[] }
    if (!Array.isArray(flags)) return reply.code(400).send({ error: 'flags must be an array' })
    const existing = await ActivityCode.findById(id).lean()
    if (!existing) return reply.code(404).send({ error: 'Activity code not found' })
    if (existing.isSystem) return reply.code(403).send({ error: 'Cannot modify flags on system codes' })
    const doc = await ActivityCode.findByIdAndUpdate(id, { $set: { flags, updatedAt: new Date().toISOString() } }, { new: true }).lean()
    return doc
  })

  app.patch('/activity-codes/:id/positions', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { applicablePositions } = req.body as { applicablePositions: string[] }
    if (!Array.isArray(applicablePositions)) return reply.code(400).send({ error: 'applicablePositions must be an array' })
    const existing = await ActivityCode.findById(id).lean()
    if (!existing) return reply.code(404).send({ error: 'Activity code not found' })
    if (existing.isSystem) return reply.code(403).send({ error: 'Cannot modify positions on system codes' })
    const doc = await ActivityCode.findByIdAndUpdate(id, { $set: { applicablePositions, updatedAt: new Date().toISOString() } }, { new: true }).lean()
    return doc
  })

  app.delete('/activity-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await ActivityCode.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Activity code not found' })
    if (doc.isSystem) return reply.code(403).send({ error: 'Cannot delete system codes' })
    await ActivityCode.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── Seed Default Activity Codes (V1 data) ─────────────
  app.post('/activity-codes/seed-defaults', async (req, reply) => {
    const { operatorId } = req.body as { operatorId: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId is required' })

    const existingGroups = await ActivityCodeGroup.countDocuments({ operatorId })
    if (existingGroups > 0) {
      return reply.code(409).send({ error: 'Activity code groups already exist for this operator. Seed is only for initial setup.' })
    }

    const now = new Date().toISOString()

    const groups = [
      { code: 'DUTY',  name: 'Flight Duty', color: '#dc2626', sortOrder: 10 },
      { code: 'STBY',  name: 'Standby',     color: '#f59e0b', sortOrder: 20 },
      { code: 'TRAIN', name: 'Training',     color: '#3b82f6', sortOrder: 30 },
      { code: 'LEAVE', name: 'Leave & Off',  color: '#10b981', sortOrder: 40 },
      { code: 'MED',   name: 'Medical',      color: '#8b5cf6', sortOrder: 50 },
      { code: 'SYS',   name: 'System',       color: '#6b7280', sortOrder: 90 },
    ]

    const groupMap: Record<string, string> = {}
    for (const g of groups) {
      const id = crypto.randomUUID()
      groupMap[g.code] = id
      await ActivityCodeGroup.create({ _id: id, operatorId, ...g, createdAt: now })
    }

    const codes = [
      // DUTY
      { groupCode: 'DUTY', code: 'FLT', name: 'Flight Duty', description: 'Operating crew on a scheduled or charter flight', flags: ['is_flight_duty', 'counts_fdp', 'counts_block_hours', 'counts_duty_time'], creditRatio: 1.0 },
      { groupCode: 'DUTY', code: 'DH', name: 'Deadhead', description: 'Positioning as a non-operating crew member on a flight', flags: ['is_deadhead', 'counts_duty_time'], creditRatio: 0.5 },
      { groupCode: 'DUTY', code: 'GRD', name: 'Ground Duty', description: 'Ground-based duty including briefings, admin, and surface positioning', flags: ['is_ground_duty', 'counts_duty_time'] },
      // STBY
      { groupCode: 'STBY', code: 'AVLB', name: 'Available', description: 'Crew available and contactable for assignment', flags: ['is_airport_standby', 'counts_fdp'] },
      { groupCode: 'STBY', code: 'ASBY', name: 'Airport Standby', description: 'Crew physically present at the airport on standby', flags: ['is_airport_standby', 'counts_fdp', 'counts_duty_time'] },
      { groupCode: 'STBY', code: 'HSBY', name: 'Home Standby', description: 'Crew on standby at home, contactable within defined callout time', flags: ['is_home_standby'] },
      { groupCode: 'STBY', code: 'RSV', name: 'Reserve', description: 'Reserve crew period — available within short-call parameters', flags: ['is_reserve'] },
      // TRAIN
      { groupCode: 'TRAIN', code: 'SIM', name: 'Simulator Check', description: 'Simulator session on an approved FSTD or full-flight simulator', flags: ['is_simulator', 'counts_fdp', 'counts_duty_time'], creditRatio: 1.0, defaultDurationMin: 480 },
      { groupCode: 'TRAIN', code: 'TRG', name: 'Training', description: 'Ground school, classroom, or computer-based training', flags: ['is_training', 'counts_duty_time'], defaultDurationMin: 480 },
      { groupCode: 'TRAIN', code: 'OJT', name: 'On-Job Training', description: 'Supervised line training flight as operating crew', flags: ['is_training', 'is_flight_duty', 'counts_fdp', 'counts_block_hours', 'counts_duty_time'], creditRatio: 1.0, defaultDurationMin: 480 },
      // LEAVE
      { groupCode: 'LEAVE', code: 'AL', name: 'Annual Leave', description: 'Annual leave entitlement day', flags: ['is_annual_leave', 'is_day_off'] },
      { groupCode: 'LEAVE', code: 'SL', name: 'Sick Leave', description: 'Sick leave or medical incapacity absence', flags: ['is_sick_leave', 'is_day_off'] },
      { groupCode: 'LEAVE', code: 'RD', name: 'Rest Day', description: 'Scheduled rest day — no duty obligations apply', flags: ['is_day_off', 'is_rest_period'] },
      { groupCode: 'LEAVE', code: 'COMP', name: 'Compensatory Off', description: 'Compensatory rest day granted in lieu of worked rest period', flags: ['is_day_off'] },
      // MED
      { groupCode: 'MED', code: 'MED', name: 'Medical Check', description: 'Periodic medical examination or aeromedical assessment', flags: ['is_medical', 'counts_duty_time'] },
      { groupCode: 'MED', code: 'FIT', name: 'Fitness Check', description: 'Fitness-for-duty assessment or recurrency check', flags: ['is_medical'] },
      // SYS
      { groupCode: 'SYS', code: 'REST', name: 'Rest Day', description: 'Post-duty recovery day — system-assigned when preceding duty releases past midnight local. Does not count as a regulatory day off.', flags: ['is_rest_period'], isSystem: true },
      { groupCode: 'SYS', code: 'OFF', name: 'Day Off', description: 'Generic off day — used by automated rostering for unspecified off periods', flags: ['is_day_off'], isSystem: true },
    ]

    for (const c of codes) {
      const id = crypto.randomUUID()
      const { groupCode, ...rest } = c
      await ActivityCode.create({
        _id: id,
        operatorId,
        groupId: groupMap[groupCode],
        isActive: true,
        isArchived: false,
        isSystem: false,
        requiresTime: false,
        applicablePositions: [],
        ...rest,
        createdAt: now,
      })
    }

    return { success: true, groupCount: groups.length, codeCount: codes.length }
  })

  // ─── Crew Complements ───────────────────────────────────

  app.get('/crew-complements', async (req) => {
    const { operatorId, aircraftTypeIcao } = req.query as { operatorId?: string; aircraftTypeIcao?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    if (aircraftTypeIcao) filter.aircraftTypeIcao = aircraftTypeIcao
    return CrewComplement.find(filter).sort({ aircraftTypeIcao: 1, createdAt: 1 }).lean()
  })

  app.get('/crew-complements/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CrewComplement.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew complement not found' })
    return doc
  })

  const complementCreateSchema = z.object({
    operatorId: z.string().min(1),
    aircraftTypeIcao: z.string().min(2).max(4),
    templateKey: z.string().min(1),
    counts: z.record(z.string(), z.number().int().min(0)).optional().default({}),
    notes: z.string().nullable().optional(),
  }).strict()

  app.post('/crew-complements', async (req, reply) => {
    const parsed = complementCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data

    const existing = await CrewComplement.findOne({
      operatorId: body.operatorId,
      aircraftTypeIcao: body.aircraftTypeIcao,
      templateKey: body.templateKey,
    }).lean()
    if (existing) {
      return reply.code(409).send({ error: `Complement "${body.templateKey}" already exists for ${body.aircraftTypeIcao}` })
    }

    const id = crypto.randomUUID()
    const doc = await CrewComplement.create({
      _id: id,
      ...body,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    return reply.code(201).send(doc.toObject())
  })

  const complementUpdateSchema = z.object({
    templateKey: z.string().min(1),
    counts: z.record(z.string(), z.number().int().min(0)),
    notes: z.string().nullable(),
    isActive: z.boolean(),
  }).partial().strict()

  app.patch('/crew-complements/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = complementUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await CrewComplement.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew complement not found' })
    return doc
  })

  app.delete('/crew-complements/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CrewComplement.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew complement not found' })

    // Protect standard templates — only custom rows can be deleted
    if (['standard', 'aug1', 'aug2'].includes(doc.templateKey)) {
      return reply.code(400).send({ error: 'Standard, Aug 1, and Aug 2 templates cannot be deleted. Use the table to set counts to 0 instead.' })
    }

    await CrewComplement.findByIdAndDelete(id)
    return { success: true }
  })

  // Seed default complements for all aircraft types (or a single type)
  app.post('/crew-complements/seed-defaults', async (req, reply) => {
    const { operatorId, aircraftTypeIcao } = req.body as { operatorId: string; aircraftTypeIcao?: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId is required' })

    // Get active crew positions to build default counts
    const positions = await CrewPosition.find({ operatorId, isActive: true }).sort({ category: 1, rankOrder: 1 }).lean()
    if (positions.length === 0) {
      return reply.code(400).send({ error: 'No active crew positions found. Configure positions in 5.4.2 first.' })
    }

    const cockpit = positions.filter(p => p.category === 'cockpit')
    const cabin = positions.filter(p => p.category === 'cabin')

    // Build default counts per template
    const buildCounts = (template: 'standard' | 'aug1' | 'aug2'): Record<string, number> => {
      const counts: Record<string, number> = {}
      for (const p of [...cockpit, ...cabin]) counts[p.code] = 1

      if (template === 'aug1' && cockpit.length > 0) {
        counts[cockpit[0].code] = 2 // +1 relief pilot
      }
      if (template === 'aug2') {
        for (const p of cockpit) counts[p.code] = 2 // double cockpit
        if (cabin.length > 0) counts[cabin[0].code] = 2 // +1 senior cabin
      }
      return counts
    }

    // Get aircraft types to seed
    let types: { icaoType: string }[]
    if (aircraftTypeIcao) {
      types = [{ icaoType: aircraftTypeIcao }]
    } else {
      types = await AircraftType.find({ operatorId }).select('icaoType').lean()
      if (types.length === 0) {
        return reply.code(400).send({ error: 'No aircraft types found. Add types in 5.2.1 first.' })
      }
    }

    const now = new Date().toISOString()
    const rows: Record<string, unknown>[] = []
    const templates = ['standard', 'aug1', 'aug2'] as const

    for (const { icaoType } of types) {
      for (const tmpl of templates) {
        // Skip if already exists
        const exists = await CrewComplement.findOne({ operatorId, aircraftTypeIcao: icaoType, templateKey: tmpl }).lean()
        if (exists) continue

        rows.push({
          _id: crypto.randomUUID(),
          operatorId,
          aircraftTypeIcao: icaoType,
          templateKey: tmpl,
          counts: buildCounts(tmpl),
          notes: null,
          isActive: true,
          createdAt: now,
        })
      }
    }

    if (rows.length > 0) {
      await CrewComplement.insertMany(rows)
    }

    return { success: true, count: rows.length }
  })

  // Delete all complements for an aircraft type
  app.delete('/crew-complements/by-type/:icaoType', async (req, reply) => {
    const { icaoType } = req.params as { icaoType: string }
    const { operatorId } = req.query as { operatorId: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId query param is required' })
    await CrewComplement.deleteMany({ operatorId, aircraftTypeIcao: icaoType })
    return { success: true }
  })

  // ─── Crew Groups ────────────────────────────────────────

  app.get('/crew-groups', async (req) => {
    const { operatorId, includeInactive } = req.query as { operatorId?: string; includeInactive?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    if (includeInactive !== 'true') filter.isActive = true
    return CrewGroup.find(filter).sort({ sortOrder: 1, name: 1 }).lean()
  })

  const crewGroupCreateSchema = z.object({
    operatorId: z.string().min(1),
    name: z.string().min(1).max(100),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  }).strict()

  const crewGroupUpdateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().nullable(),
    sortOrder: z.number().int().min(0),
    isActive: z.boolean(),
  }).partial().strict()

  app.post('/crew-groups', async (req, reply) => {
    const parsed = crewGroupCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data

    const existing = await CrewGroup.findOne({ operatorId: body.operatorId, name: body.name }).lean()
    if (existing) return reply.code(409).send({ error: `Group "${body.name}" already exists` })

    // Auto-assign sortOrder if not provided
    if (body.sortOrder == null) {
      const count = await CrewGroup.countDocuments({ operatorId: body.operatorId })
      body.sortOrder = (count + 1) * 10
    }

    const id = crypto.randomUUID()
    const doc = await CrewGroup.create({
      _id: id,
      ...body,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/crew-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = crewGroupUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await CrewGroup.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew group not found' })
    return doc
  })

  app.delete('/crew-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CrewGroup.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Crew group not found' })
    await CrewGroup.findByIdAndDelete(id)
    return { success: true }
  })

  app.post('/crew-groups/seed-defaults', async (req, reply) => {
    const { operatorId } = req.body as { operatorId: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId is required' })

    const existing = await CrewGroup.countDocuments({ operatorId })
    if (existing > 0) return reply.code(400).send({ error: 'Crew groups already exist. Delete all first to re-seed.' })

    const defaults = [
      'Management Pilots - AFS',
      'Management Pilots - Non AFS',
      'Relief First Officers',
      '50/50 Cockpit Crew',
      '50/50 Cabin Crew',
      'Reduced Working Hours Cockpit Crew',
      'Reduced Working Hours Cabin Crew',
      'Cockpit Crew Under Training',
      'Trainer Pilots',
      'Part-Time Crew',
    ]

    const now = new Date().toISOString()
    const rows = defaults.map((name, i) => ({
      _id: crypto.randomUUID(),
      operatorId,
      name,
      description: null,
      sortOrder: (i + 1) * 10,
      isActive: true,
      createdAt: now,
      updatedAt: null,
    }))

    await CrewGroup.insertMany(rows)
    return { success: true, count: rows.length }
  })

  // ─── Duty Patterns ──────────────────────────────────────────

  const dpCreateSchema = z.object({
    operatorId: z.string().min(1),
    code: z.string().min(1).max(20),
    description: z.string().nullable().optional(),
    sequence: z.array(z.number().int().min(1)).min(2).refine(arr => arr.length % 2 === 0, { message: 'Sequence must have an even number of segments' }),
    offCode: z.string().min(1).max(10).optional().default('DO'),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.number().int().min(0).optional(),
  }).strict()

  const dpUpdateSchema = z.object({
    code: z.string().min(1).max(20),
    description: z.string().nullable(),
    sequence: z.array(z.number().int().min(1)).min(2).refine(arr => arr.length % 2 === 0, { message: 'Sequence must have an even number of segments' }),
    offCode: z.string().min(1).max(10),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0),
  }).partial().strict()

  app.get('/duty-patterns', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return DutyPattern.find(filter).sort({ sortOrder: 1, code: 1 }).lean()
  })

  app.get('/duty-patterns/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await DutyPattern.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Duty pattern not found' })
    return doc
  })

  app.post('/duty-patterns', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = dpCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body = parsed.data
    const existing = await DutyPattern.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) return reply.code(409).send({ error: `Duty pattern '${body.code}' already exists` })

    const cycleDays = body.sequence.reduce((a, b) => a + b, 0)
    const maxSort = await DutyPattern.findOne({ operatorId: body.operatorId }).sort({ sortOrder: -1 }).lean()
    const id = crypto.randomUUID()
    const doc = await DutyPattern.create({
      _id: id,
      ...body,
      cycleDays,
      sortOrder: body.sortOrder ?? ((maxSort?.sortOrder ?? 0) + 10),
      createdAt: new Date().toISOString(),
    })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/duty-patterns/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = dpUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }
    const body: Record<string, unknown> = { ...parsed.data, updatedAt: new Date().toISOString() }
    if (parsed.data.sequence) {
      body.cycleDays = parsed.data.sequence.reduce((a: number, b: number) => a + b, 0)
    }
    const doc = await DutyPattern.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Duty pattern not found' })
    return doc
  })

  app.delete('/duty-patterns/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await DutyPattern.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Duty pattern not found' })
    await DutyPattern.findByIdAndDelete(id)
    return { success: true }
  })

  app.post('/duty-patterns/seed-defaults', async (req, reply) => {
    const { operatorId } = req.body as { operatorId?: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const count = await DutyPattern.countDocuments({ operatorId })
    if (count > 0) return reply.code(409).send({ error: 'Patterns already exist' })

    const defaults = [
      { code: '52', description: 'Standard 5-on 2-off weekly rotation', sequence: [5, 2], offCode: 'DO', isActive: true },
      { code: '5243', description: 'Extended rotation with mid-cycle break', sequence: [5, 2, 4, 3], offCode: 'DO', isActive: true },
      { code: '77', description: 'Equal time 7-on 7-off rotation', sequence: [7, 7], offCode: 'DO', isActive: true },
      { code: '4331', description: 'Short haul pattern with split rest', sequence: [4, 3, 3, 1], offCode: 'DO', isActive: true },
      { code: '6242', description: 'Long haul crew rotation pattern', sequence: [6, 2, 4, 2], offCode: 'RDO', isActive: false },
    ]
    const rows = defaults.map((d, i) => ({
      _id: crypto.randomUUID(),
      operatorId,
      ...d,
      cycleDays: d.sequence.reduce((a, b) => a + b, 0),
      sortOrder: (i + 1) * 10,
      createdAt: new Date().toISOString(),
    }))
    await DutyPattern.insertMany(rows)
    return { success: true, count: rows.length }
  })

  // ─── MPP Lead Time Groups ──────────────────────────────────

  const ltGroupCreateSchema = z.object({
    operatorId: z.string().min(1),
    label: z.string().min(1).max(80),
    description: z.string().nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    code: z.string().min(1).max(6),
    crewType: z.enum(['cockpit', 'cabin', 'other']).optional().default('cockpit'),
    sortOrder: z.number().int().min(0).optional(),
  }).strict()

  const ltGroupUpdateSchema = ltGroupCreateSchema.omit({ operatorId: true }).partial().strict()

  app.get('/mpp-lead-time-groups', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return MppLeadTimeGroup.find(filter).sort({ crewType: 1, sortOrder: 1 }).lean()
  })

  app.post('/mpp-lead-time-groups', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = ltGroupCreateSchema.safeParse(raw)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    const body = parsed.data
    const existing = await MppLeadTimeGroup.findOne({ operatorId: body.operatorId, code: body.code }).lean()
    if (existing) return reply.code(409).send({ error: `Group code '${body.code}' already exists` })
    const maxSort = await MppLeadTimeGroup.findOne({ operatorId: body.operatorId }).sort({ sortOrder: -1 }).lean()
    const id = crypto.randomUUID()
    const doc = await MppLeadTimeGroup.create({ _id: id, ...body, sortOrder: body.sortOrder ?? ((maxSort?.sortOrder ?? 0) + 10), createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/mpp-lead-time-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.code) raw.code = (raw.code as string).toUpperCase()
    const parsed = ltGroupUpdateSchema.safeParse(raw)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    const doc = await MppLeadTimeGroup.findByIdAndUpdate(id, { $set: { ...parsed.data, updatedAt: new Date().toISOString() } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Group not found' })
    return doc
  })

  app.delete('/mpp-lead-time-groups/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await MppLeadTimeGroup.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Group not found' })
    await MppLeadTimeItem.deleteMany({ groupId: id })
    await MppLeadTimeGroup.findByIdAndDelete(id)
    return { success: true }
  })

  // ─── MPP Lead Time Items ──────────────────────────────────

  const ltItemCreateSchema = z.object({
    operatorId: z.string().min(1),
    groupId: z.string().min(1),
    label: z.string().min(1).max(120),
    valueMonths: z.number().int().min(1).max(120),
    note: z.string().nullable().optional(),
    consumedBy: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
  }).strict()

  const ltItemUpdateSchema = ltItemCreateSchema.omit({ operatorId: true }).partial().strict()

  app.get('/mpp-lead-time-items', async (req) => {
    const { operatorId, groupId } = req.query as { operatorId?: string; groupId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    if (groupId) filter.groupId = groupId
    return MppLeadTimeItem.find(filter).sort({ sortOrder: 1 }).lean()
  })

  app.post('/mpp-lead-time-items', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    const parsed = ltItemCreateSchema.safeParse(raw)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    const body = parsed.data
    const maxSort = await MppLeadTimeItem.findOne({ groupId: body.groupId }).sort({ sortOrder: -1 }).lean()
    const id = crypto.randomUUID()
    const doc = await MppLeadTimeItem.create({ _id: id, ...body, sortOrder: body.sortOrder ?? ((maxSort?.sortOrder ?? 0) + 10), createdAt: new Date().toISOString() })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/mpp-lead-time-items/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = ltItemUpdateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) })
    const doc = await MppLeadTimeItem.findByIdAndUpdate(id, { $set: { ...parsed.data, updatedAt: new Date().toISOString() } }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Item not found' })
    return doc
  })

  app.delete('/mpp-lead-time-items/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await MppLeadTimeItem.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Item not found' })
    await MppLeadTimeItem.findByIdAndDelete(id)
    return { success: true }
  })

  app.post('/mpp-lead-times/seed-defaults', async (req, reply) => {
    const { operatorId } = req.body as { operatorId?: string }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const count = await MppLeadTimeGroup.countDocuments({ operatorId })
    if (count > 0) return reply.code(409).send({ error: 'Lead time groups already exist' })

    const now = new Date().toISOString()
    const groups = [
      { code: 'PER', label: 'External Recruitment', description: 'New pilots joining from outside the organisation', color: '#7c3aed', crewType: 'cockpit' as const, sortOrder: 10 },
      { code: 'PIN', label: 'Internal Movement', description: 'Upgrades and fleet changes within existing pilot pool', color: '#0891b2', crewType: 'cockpit' as const, sortOrder: 20 },
      { code: 'CCP', label: 'Cabin Crew', description: 'Initial courses, upgrades, and fleet transitions for cabin crew', color: '#be185d', crewType: 'cabin' as const, sortOrder: 30 },
    ]
    const items = [
      { groupCode: 'PER', label: 'Direct Entry Captain (AOC)', valueMonths: 6, consumedBy: 'MPP · AOC Captain event' },
      { groupCode: 'PER', label: 'First Officer — External Hire (AOC)', valueMonths: 5, consumedBy: 'MPP · AOC FO event' },
      { groupCode: 'PER', label: 'Cadet — Ab Initio (CDT)', valueMonths: 16, consumedBy: 'MPP · CDT event' },
      { groupCode: 'PIN', label: 'Crew Upgrade FO → Captain (CUG)', valueMonths: 4, consumedBy: 'MPP · CUG event' },
      { groupCode: 'PIN', label: 'Cross-Crew Qualification (CCQ)', valueMonths: 3, consumedBy: 'MPP · CCQ event' },
      { groupCode: 'CCP', label: 'Cabin Crew — Initial Course', valueMonths: 2, consumedBy: 'MPP · CC Initial event' },
      { groupCode: 'CCP', label: 'Senior Purser Upgrade', valueMonths: 2, consumedBy: 'MPP · SP Upgrade event' },
      { groupCode: 'CCP', label: 'Cabin Fleet Type Training', valueMonths: 1, consumedBy: 'MPP · CC Fleet event' },
    ]

    const groupDocs = groups.map(g => ({ _id: crypto.randomUUID(), operatorId, ...g, createdAt: now }))
    await MppLeadTimeGroup.insertMany(groupDocs)

    const codeToId = new Map(groupDocs.map(g => [g.code, g._id]))
    const itemDocs = items.map((it, i) => ({
      _id: crypto.randomUUID(),
      operatorId,
      groupId: codeToId.get(it.groupCode)!,
      label: it.label,
      valueMonths: it.valueMonths,
      consumedBy: it.consumedBy,
      sortOrder: (i + 1) * 10,
      createdAt: now,
    }))
    await MppLeadTimeItem.insertMany(itemDocs)

    return { success: true, groupCount: groupDocs.length, itemCount: itemDocs.length }
  })

  // ─── Carrier Codes ─────────────────────────────────────────

  const reportDebriefSchema = z.object({
    reportMinutes: z.number().nullable().optional().default(null),
    debriefMinutes: z.number().nullable().optional().default(null),
  })

  const carrierCreateSchema = z.object({
    operatorId: z.string().min(1),
    iataCode: z.string().min(1).max(2),
    icaoCode: z.string().max(3).nullable().optional().default(null),
    name: z.string().min(1),
    category: z.enum(['Air', 'Ground', 'Other']).optional().default('Air'),
    vendorNumber: z.string().nullable().optional().default(null),
    contactName: z.string().nullable().optional().default(null),
    contactPosition: z.string().nullable().optional().default(null),
    phone: z.string().nullable().optional().default(null),
    email: z.string().nullable().optional().default(null),
    sita: z.string().nullable().optional().default(null),
    website: z.string().nullable().optional().default(null),
    defaultCurrency: z.string().nullable().optional().default(null),
    capacity: z.number().nullable().optional().default(null),
    cockpitTimes: reportDebriefSchema.nullable().optional().default(null),
    cabinTimes: reportDebriefSchema.nullable().optional().default(null),
    isActive: z.boolean().optional().default(true),
  }).strict()

  const carrierUpdateSchema = z.object({
    iataCode: z.string().min(1).max(2),
    icaoCode: z.string().max(3).nullable(),
    name: z.string().min(1),
    category: z.enum(['Air', 'Ground', 'Other']),
    vendorNumber: z.string().nullable(),
    contactName: z.string().nullable(),
    contactPosition: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    sita: z.string().nullable(),
    website: z.string().nullable(),
    defaultCurrency: z.string().nullable(),
    capacity: z.number().nullable(),
    cockpitTimes: reportDebriefSchema.nullable(),
    cabinTimes: reportDebriefSchema.nullable(),
    isActive: z.boolean(),
  }).partial().strict()

  app.get('/carrier-codes', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId
    return CarrierCode.find(filter).sort({ iataCode: 1 }).lean()
  })

  app.get('/carrier-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CarrierCode.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Carrier code not found' })
    return doc
  })

  app.post('/carrier-codes', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.icaoCode) raw.icaoCode = (raw.icaoCode as string).toUpperCase()
    if (raw.iataCode) raw.iataCode = (raw.iataCode as string).toUpperCase()

    const parsed = carrierCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = parsed.data
    const existing = await CarrierCode.findOne({ operatorId: body.operatorId, iataCode: body.iataCode }).lean()
    if (existing) return reply.code(409).send({ error: `Carrier "${body.iataCode}" already exists` })

    try {
      const id = crypto.randomUUID()
      const doc = await CarrierCode.create({ _id: id, ...body, createdAt: new Date().toISOString() })
      return reply.code(201).send(doc.toObject())
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to create carrier code' })
    }
  })

  app.patch('/carrier-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.icaoCode) raw.icaoCode = (raw.icaoCode as string).toUpperCase()
    if (raw.iataCode) raw.iataCode = (raw.iataCode as string).toUpperCase()

    const parsed = carrierUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      return reply.code(400).send({ error: 'Validation failed', details: errors })
    }

    const body = { ...parsed.data, updatedAt: new Date().toISOString() }
    const doc = await CarrierCode.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Carrier code not found' })
    return doc
  })

  app.delete('/carrier-codes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await CarrierCode.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Carrier code not found' })
    await CarrierCode.findByIdAndDelete(id)
    return { success: true }
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
