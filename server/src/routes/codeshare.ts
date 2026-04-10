import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CodeshareAgreement } from '../models/CodeshareAgreement.js'
import { CodeshareMapping } from '../models/CodeshareMapping.js'
import { CodeshareSeatAllocation } from '../models/CodeshareSeatAllocation.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { LopaConfig } from '../models/LopaConfig.js'
import { AircraftType } from '../models/AircraftType.js'

// ── Zod Schemas ──

const operatorQuery = z.object({ operatorId: z.string().min(1) })
const agreementQuery = z.object({ agreementId: z.string().min(1) })
const mappingQuery = z.object({ mappingId: z.string().min(1) })

const agreementCreateSchema = z.object({
  operatorId: z.string().min(1),
  partnerAirlineCode: z.string().min(2).max(3),
  partnerAirlineName: z.string().min(1),
  partnerNumericCode: z.string().nullable().optional(),
  agreementType: z.enum(['free_sale', 'block_space', 'hard_block']),
  effectiveFrom: z.string().min(1),
  effectiveUntil: z.string().nullable().optional(),
  status: z.enum(['active', 'pending', 'suspended', 'terminated']).optional().default('active'),
  brandColor: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const agreementUpdateSchema = agreementCreateSchema.partial().omit({ operatorId: true })

const mappingCreateSchema = z.object({
  agreementId: z.string().min(1),
  operatingFlightNumber: z.string().min(1),
  marketingFlightNumber: z.string().min(1),
  departureIata: z.string().min(3).max(4),
  arrivalIata: z.string().min(3).max(4),
  daysOfOperation: z.string().optional().default('1234567'),
  effectiveFrom: z.string().min(1),
  effectiveUntil: z.string().nullable().optional(),
  seatAllocation: z.number().nullable().optional(),
  agreedAircraftType: z.string().nullable().optional(),
  status: z.enum(['active', 'pending', 'cancelled']).optional().default('active'),
})

const mappingUpdateSchema = mappingCreateSchema.partial().omit({ agreementId: true })

const bulkMappingsSchema = z.object({
  agreementId: z.string().min(1),
  mappings: z.array(z.object({
    operatingFlightNumber: z.string().min(1),
    marketingFlightNumber: z.string().min(1),
    departureIata: z.string().min(3),
    arrivalIata: z.string().min(3),
    daysOfOperation: z.string().optional().default('1234567'),
    effectiveFrom: z.string().min(1),
    effectiveUntil: z.string().nullable().optional(),
  })),
  cabinAllocations: z.array(z.object({
    cabinCode: z.string().min(1),
    allocatedSeats: z.number().min(0),
    releaseHours: z.number().min(0).optional().default(72),
  })).optional(),
})

const seatAllocationUpsertSchema = z.object({
  mappingId: z.string().min(1),
  allocations: z.array(z.object({
    cabinCode: z.string().min(1),
    allocatedSeats: z.number().min(0),
    releaseHours: z.number().min(0).optional().default(72),
  })),
})

// ── Routes ──

export async function codeshareRoutes(app: FastifyInstance) {

  // ─── GET /codeshare/agreements ───
  app.get('/codeshare/agreements', async (req) => {
    const { operatorId } = operatorQuery.parse(req.query)
    return CodeshareAgreement.find({ operatorId })
      .sort({ partnerAirlineName: 1 })
      .lean()
  })

  // ─── GET /codeshare/agreements/:id ───
  app.get('/codeshare/agreements/:id', async (req) => {
    const { id } = req.params as { id: string }
    const doc = await CodeshareAgreement.findById(id).lean()
    if (!doc) throw { statusCode: 404, message: 'Agreement not found' }
    return doc
  })

  // ─── POST /codeshare/agreements ───
  app.post('/codeshare/agreements', async (req) => {
    const data = agreementCreateSchema.parse(req.body)
    const now = new Date().toISOString()

    // Check for duplicate
    const existing = await CodeshareAgreement.findOne({
      operatorId: data.operatorId,
      partnerAirlineCode: data.partnerAirlineCode.toUpperCase(),
    }).lean()
    if (existing) throw { statusCode: 409, message: 'Agreement already exists for this partner' }

    const doc = await CodeshareAgreement.create({
      _id: crypto.randomUUID(),
      ...data,
      partnerAirlineCode: data.partnerAirlineCode.toUpperCase(),
      partnerNumericCode: data.partnerNumericCode || null,
      effectiveUntil: data.effectiveUntil || null,
      brandColor: data.brandColor || null,
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    })
    return { id: doc._id }
  })

  // ─── PATCH /codeshare/agreements/:id ───
  app.patch('/codeshare/agreements/:id', async (req) => {
    const { id } = req.params as { id: string }
    const data = agreementUpdateSchema.parse(req.body)
    await CodeshareAgreement.updateOne({ _id: id }, {
      $set: {
        ...data,
        ...(data.partnerAirlineCode ? { partnerAirlineCode: data.partnerAirlineCode.toUpperCase() } : {}),
        updatedAt: new Date().toISOString(),
      },
    })
    return { ok: true }
  })

  // ─── PATCH /codeshare/agreements/:id/suspend ───
  app.patch('/codeshare/agreements/:id/suspend', async (req) => {
    const { id } = req.params as { id: string }
    await CodeshareAgreement.updateOne({ _id: id }, {
      $set: { status: 'suspended', updatedAt: new Date().toISOString() },
    })
    return { ok: true }
  })

  // ─── GET /codeshare/mappings ───
  app.get('/codeshare/mappings', async (req) => {
    const { agreementId } = agreementQuery.parse(req.query)
    return CodeshareMapping.find({ agreementId })
      .sort({ operatingFlightNumber: 1 })
      .lean()
  })

  // ─── GET /codeshare/stats ───
  app.get('/codeshare/stats', async (req) => {
    const { agreementId } = agreementQuery.parse(req.query)
    const mappings = await CodeshareMapping.find({ agreementId })
      .select('_id departureIata arrivalIata seatAllocation daysOfOperation')
      .lean()

    if (!mappings.length) return { mappedFlights: 0, routeCount: 0, weeklySeats: 0 }

    const routes = new Set(mappings.map(m => `${m.departureIata}-${m.arrivalIata}`))

    // Get per-cabin allocations for accurate weekly seats
    const mappingIds = mappings.map(m => m._id)
    const allocs = await CodeshareSeatAllocation.find({ mappingId: { $in: mappingIds } })
      .select('mappingId allocatedSeats')
      .lean()

    const allocByMapping = new Map<string, number>()
    for (const a of allocs) {
      allocByMapping.set(a.mappingId, (allocByMapping.get(a.mappingId) || 0) + a.allocatedSeats)
    }

    let weeklySeats = 0
    for (const m of mappings) {
      const alloc = allocByMapping.get(m._id) || m.seatAllocation || 0
      const activeDays = (m.daysOfOperation || '').replace(/ /g, '').length
      weeklySeats += alloc * activeDays
    }

    return { mappedFlights: mappings.length, routeCount: routes.size, weeklySeats }
  })

  // ─── GET /codeshare/seat-allocations ───
  app.get('/codeshare/seat-allocations', async (req) => {
    const q = req.query as Record<string, string>
    if (q.mappingId) {
      return CodeshareSeatAllocation.find({ mappingId: q.mappingId }).sort({ cabinCode: 1 }).lean()
    }
    if (q.agreementId) {
      const mappings = await CodeshareMapping.find({ agreementId: q.agreementId }).select('_id').lean()
      const mappingIds = mappings.map(m => m._id)
      return CodeshareSeatAllocation.find({ mappingId: { $in: mappingIds } }).sort({ cabinCode: 1 }).lean()
    }
    return []
  })

  // ─── PUT /codeshare/seat-allocations ───
  app.put('/codeshare/seat-allocations', async (req) => {
    const { mappingId, allocations } = seatAllocationUpsertSchema.parse(req.body)

    // Delete existing
    await CodeshareSeatAllocation.deleteMany({ mappingId })

    const validAllocs = allocations.filter(a => a.allocatedSeats > 0)
    if (validAllocs.length === 0) {
      await CodeshareMapping.updateOne({ _id: mappingId }, { $set: { seatAllocation: null } })
      return { ok: true }
    }

    const now = new Date().toISOString()
    const docs = validAllocs.map(a => ({
      _id: crypto.randomUUID(),
      mappingId,
      cabinCode: a.cabinCode,
      allocatedSeats: a.allocatedSeats,
      releaseHours: a.releaseHours ?? 72,
      createdAt: now,
    }))
    await CodeshareSeatAllocation.insertMany(docs)

    // Update denormalized total
    const total = validAllocs.reduce((s, a) => s + a.allocatedSeats, 0)
    await CodeshareMapping.updateOne({ _id: mappingId }, { $set: { seatAllocation: total } })

    return { ok: true }
  })

  // ─── GET /codeshare/cabin-configs ───
  app.get('/codeshare/cabin-configs', async (req) => {
    const { operatorId } = operatorQuery.parse(req.query)

    const flights = await ScheduledFlight.find({ operatorId, scenarioId: null })
      .select('flightNumber aircraftTypeIcao')
      .lean()
    if (!flights.length) return {}

    const icaoCodes = [...new Set(flights.map(f => f.aircraftTypeIcao).filter(Boolean))] as string[]
    if (!icaoCodes.length) return {}

    // Get LOPA configs for these aircraft types
    const lopas = await LopaConfig.find({
      operatorId,
      aircraftType: { $in: icaoCodes },
      isActive: true,
    }).lean()

    // Also get AircraftType for fallback pax capacity
    const acTypes = await AircraftType.find({ operatorId, icaoType: { $in: icaoCodes } })
      .select('icaoType paxCapacity')
      .lean()

    const configByIcao = new Map<string, Record<string, number>>()
    for (const icao of icaoCodes) {
      const configs = lopas.filter(l => l.aircraftType === icao)
      const defaultConfig = configs.find(c => c.isDefault) || configs[0]
      if (defaultConfig?.cabins?.length) {
        const cabinConfig: Record<string, number> = {}
        for (const entry of defaultConfig.cabins) {
          if (entry.classCode && entry.seats) {
            cabinConfig[entry.classCode] = entry.seats
          }
        }
        if (Object.keys(cabinConfig).length > 0) {
          configByIcao.set(icao, cabinConfig)
        }
      }
      // Fallback: single Y cabin with paxCapacity
      if (!configByIcao.has(icao)) {
        const acType = acTypes.find(t => t.icaoType === icao)
        if (acType?.paxCapacity && acType.paxCapacity > 0) {
          configByIcao.set(icao, { Y: acType.paxCapacity })
        }
      }
    }

    const result: Record<string, Record<string, number>> = {}
    for (const f of flights) {
      const config = configByIcao.get(f.aircraftTypeIcao || '')
      if (config) result[f.flightNumber] = config
    }
    return result
  })

  // ─── POST /codeshare/mappings ───
  app.post('/codeshare/mappings', async (req) => {
    const data = mappingCreateSchema.parse(req.body)
    const now = new Date().toISOString()
    const doc = await CodeshareMapping.create({
      _id: crypto.randomUUID(),
      ...data,
      departureIata: data.departureIata.toUpperCase(),
      arrivalIata: data.arrivalIata.toUpperCase(),
      effectiveUntil: data.effectiveUntil || null,
      seatAllocation: data.seatAllocation || null,
      agreedAircraftType: data.agreedAircraftType || null,
      createdAt: now,
    })
    return { id: doc._id }
  })

  // ─── POST /codeshare/mappings/bulk ───
  app.post('/codeshare/mappings/bulk', async (req) => {
    const { agreementId, mappings, cabinAllocations } = bulkMappingsSchema.parse(req.body)
    const now = new Date().toISOString()

    const rows = mappings.map(m => ({
      _id: crypto.randomUUID(),
      agreementId,
      operatingFlightNumber: m.operatingFlightNumber,
      marketingFlightNumber: m.marketingFlightNumber,
      departureIata: m.departureIata.toUpperCase(),
      arrivalIata: m.arrivalIata.toUpperCase(),
      daysOfOperation: m.daysOfOperation || '1234567',
      effectiveFrom: m.effectiveFrom,
      effectiveUntil: m.effectiveUntil || null,
      seatAllocation: null as number | null,
      agreedAircraftType: null,
      status: 'active' as const,
      createdAt: now,
    }))

    const inserted = await CodeshareMapping.insertMany(rows)

    const validAllocs = (cabinAllocations || []).filter(a => a.allocatedSeats > 0)
    if (validAllocs.length > 0 && inserted.length > 0) {
      const allocRows = inserted.flatMap(mapping =>
        validAllocs.map(a => ({
          _id: crypto.randomUUID(),
          mappingId: mapping._id,
          cabinCode: a.cabinCode,
          allocatedSeats: a.allocatedSeats,
          releaseHours: a.releaseHours ?? 72,
          createdAt: now,
        }))
      )
      await CodeshareSeatAllocation.insertMany(allocRows)

      // Update denormalized totals
      const total = validAllocs.reduce((s, a) => s + a.allocatedSeats, 0)
      const mappingIds = inserted.map(m => m._id)
      await CodeshareMapping.updateMany(
        { _id: { $in: mappingIds } },
        { $set: { seatAllocation: total } }
      )
    }

    return { created: inserted.length }
  })

  // ─── PATCH /codeshare/mappings/:id ───
  app.patch('/codeshare/mappings/:id', async (req) => {
    const { id } = req.params as { id: string }
    const data = mappingUpdateSchema.parse(req.body)
    await CodeshareMapping.updateOne({ _id: id }, {
      $set: {
        ...data,
        ...(data.departureIata ? { departureIata: data.departureIata.toUpperCase() } : {}),
        ...(data.arrivalIata ? { arrivalIata: data.arrivalIata.toUpperCase() } : {}),
      },
    })
    return { ok: true }
  })

  // ─── DELETE /codeshare/mappings/:id ───
  app.delete('/codeshare/mappings/:id', async (req) => {
    const { id } = req.params as { id: string }
    await CodeshareSeatAllocation.deleteMany({ mappingId: id })
    await CodeshareMapping.deleteOne({ _id: id })
    return { ok: true }
  })

  // ─── GET /codeshare/operating-flights ───
  app.get('/codeshare/operating-flights', async (req) => {
    const { operatorId } = operatorQuery.parse(req.query)
    const flights = await ScheduledFlight.find({ operatorId, scenarioId: null })
      .select('flightNumber depStation arrStation daysOfWeek aircraftTypeIcao effectiveFrom effectiveUntil')
      .sort({ flightNumber: 1 })
      .lean()
    return flights.map(f => ({
      _id: f._id,
      flightNumber: f.flightNumber,
      depStation: f.depStation,
      arrStation: f.arrStation,
      daysOfWeek: f.daysOfWeek,
      aircraftTypeIcao: f.aircraftTypeIcao || null,
      effectiveFrom: f.effectiveFrom,
      effectiveUntil: f.effectiveUntil,
    }))
  })

  // ─── GET /codeshare/unmapped-flights ───
  app.get('/codeshare/unmapped-flights', async (req) => {
    const q = req.query as Record<string, string>
    const { agreementId } = agreementQuery.parse(q)
    const { operatorId } = operatorQuery.parse(q)

    const existing = await CodeshareMapping.find({ agreementId })
      .select('operatingFlightNumber')
      .lean()
    const mapped = new Set(existing.map(e => e.operatingFlightNumber))

    const flights = await ScheduledFlight.find({ operatorId, scenarioId: null })
      .select('flightNumber depStation arrStation daysOfWeek aircraftTypeIcao effectiveFrom effectiveUntil')
      .sort({ flightNumber: 1 })
      .lean()

    return flights
      .filter(f => !mapped.has(f.flightNumber))
      .map(f => ({
        _id: f._id,
        flightNumber: f.flightNumber,
        depStation: f.depStation,
        arrStation: f.arrStation,
        daysOfWeek: f.daysOfWeek,
        aircraftTypeIcao: f.aircraftTypeIcao || null,
        effectiveFrom: f.effectiveFrom,
        effectiveUntil: f.effectiveUntil,
      }))
  })

  // ─── GET /codeshare/health ───
  app.get('/codeshare/health', async (req) => {
    const q = req.query as Record<string, string>
    const { agreementId } = agreementQuery.parse(q)
    const operatorId = q.operatorId

    const mappings = await CodeshareMapping.find({ agreementId })
      .select('_id operatingFlightNumber departureIata arrivalIata agreedAircraftType')
      .lean()
    if (!mappings.length) return {}

    const flightNums = [...new Set(mappings.map(m => m.operatingFlightNumber))]
    const flights = await ScheduledFlight.find({
      ...(operatorId ? { operatorId } : {}),
      flightNumber: { $in: flightNums },
      scenarioId: null,
    }).select('flightNumber depStation arrStation aircraftTypeIcao').lean()

    const flightMap = new Map(
      flights.map(f => [f.flightNumber, { dep: f.depStation, arr: f.arrStation, acType: f.aircraftTypeIcao }])
    )

    const result: Record<string, string> = {}
    for (const m of mappings) {
      const sf = flightMap.get(m.operatingFlightNumber)
      if (!sf) {
        result[m._id] = 'orphaned'
      } else if (sf.dep !== m.departureIata || sf.arr !== m.arrivalIata) {
        result[m._id] = 'route_mismatch'
      } else if (m.agreedAircraftType && sf.acType !== m.agreedAircraftType) {
        result[m._id] = 'type_mismatch'
      } else {
        result[m._id] = 'valid'
      }
    }
    return result
  })

  // ─── GET /codeshare/flight-capacity ───
  app.get('/codeshare/flight-capacity', async (req) => {
    const { operatorId } = operatorQuery.parse(req.query)

    // Get flights with their aircraft types
    const flights = await ScheduledFlight.find({ operatorId, scenarioId: null })
      .select('flightNumber aircraftTypeIcao')
      .lean()
    if (!flights.length) return {}

    // Get pax capacity from AircraftType
    const icaoCodes = [...new Set(flights.map(f => f.aircraftTypeIcao).filter(Boolean))] as string[]
    const acTypes = await AircraftType.find({ operatorId, icaoType: { $in: icaoCodes } })
      .select('icaoType paxCapacity')
      .lean()

    // Also check LOPA configs for total seats
    const lopas = await LopaConfig.find({
      operatorId,
      aircraftType: { $in: icaoCodes },
      isActive: true,
      isDefault: true,
    }).select('aircraftType totalSeats').lean()

    const capacityByIcao = new Map<string, number>()
    for (const icao of icaoCodes) {
      const lopa = lopas.find(l => l.aircraftType === icao)
      if (lopa?.totalSeats) {
        capacityByIcao.set(icao, lopa.totalSeats)
      } else {
        const ac = acTypes.find(t => t.icaoType === icao)
        if (ac?.paxCapacity) capacityByIcao.set(icao, ac.paxCapacity)
      }
    }

    const result: Record<string, number> = {}
    for (const f of flights) {
      const cap = capacityByIcao.get(f.aircraftTypeIcao || '')
      if (cap) result[f.flightNumber] = cap
    }
    return result
  })
}
