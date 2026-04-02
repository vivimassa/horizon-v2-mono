import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Airport } from '../models/Airport.js'
import { AircraftType } from '../models/AircraftType.js'
import { Country } from '../models/Country.js'
import { DelayCode } from '../models/DelayCode.js'
import { FlightServiceType } from '../models/FlightServiceType.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { ExpiryCode, ExpiryCodeCategory } from '../models/ExpiryCode.js'
import { Operator } from '../models/Operator.js'
import { FlightInstance } from '../models/FlightInstance.js'

// ─── Zod schemas for airport validation ───────────────────

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

    // Source 1: mwgg/Airports — 28k+ airports, free, no API key
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
          }
        }
      }
    } catch { /* fallback */ }

    // Source 2: airportdb.io (backup)
    try {
      const res = await fetch(`https://airportdb.io/api/v1/airport/${code}?apiToken=free`)
      if (res.ok) {
        const data = await res.json() as Record<string, any>
        if (data.icao) {
          return { source: 'airportdb.io', ...mapAirportDbResponse(data) }
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

  // ─── Aircraft Types ─────────────────────────────────────
  app.get('/aircraft-types', async (req) => {
    const { operatorId } = req.query as { operatorId?: string }
    const filter: Record<string, unknown> = { isActive: true }
    if (operatorId) filter.operatorId = operatorId
    return AircraftType.find(filter).sort({ icaoType: 1 }).lean()
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
      ]
    }
    return Country.find(filter).sort({ name: 1 }).lean()
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
    ])

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
      total:
        operators +
        airports +
        aircraftTypes +
        countries +
        delayCodes +
        flightServiceTypes +
        crewPositions +
        expiryCodeCategories +
        expiryCodes,
    }
  })
}

// ─── External lookup mappers ──────────────────────────────

function mapAirportDbResponse(data: Record<string, any>) {
  const runways = Array.isArray(data.runways) ? data.runways : []
  const longestRunway = runways.reduce((max: number, r: any) => {
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
  }
}

function mapAviowikiResponse(data: Record<string, any>) {
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
    numberOfRunways: data.runways?.length ?? null,
    longestRunwayFt: null,
  }
}
