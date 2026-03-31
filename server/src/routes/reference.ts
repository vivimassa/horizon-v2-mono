import type { FastifyInstance } from 'fastify'
import { Airport } from '../models/Airport.js'
import { AircraftType } from '../models/AircraftType.js'
import { Country } from '../models/Country.js'
import { DelayCode } from '../models/DelayCode.js'
import { FlightServiceType } from '../models/FlightServiceType.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { ExpiryCode, ExpiryCodeCategory } from '../models/ExpiryCode.js'
import { Operator } from '../models/Operator.js'

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

  app.get('/airports/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await Airport.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Airport not found' })
    return doc
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
