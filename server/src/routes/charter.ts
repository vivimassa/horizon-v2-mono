import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CharterContract } from '../models/CharterContract.js'
import { CharterFlight } from '../models/CharterFlight.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { normalizeDate } from '../utils/normalize-date.js'

// ── Zod Schemas ──

const operatorQuery = z.object({ operatorId: z.string().min(1) })

const contractCreateSchema = z.object({
  operatorId: z.string().min(1),
  contractNumber: z.string().min(1),
  contractType: z
    .enum(['passenger', 'cargo', 'government', 'acmi', 'humanitarian', 'hajj', 'sports', 'other'])
    .default('passenger'),
  clientName: z.string().min(1),
  clientContactName: z.string().nullable().optional(),
  clientContactEmail: z.string().nullable().optional(),
  clientContactPhone: z.string().nullable().optional(),
  aircraftTypeIcao: z.string().nullable().optional(),
  aircraftRegistration: z.string().nullable().optional(),
  paxCapacity: z.number().nullable().optional(),
  ratePerSector: z.number().nullable().optional(),
  ratePerBlockHour: z.number().nullable().optional(),
  currency: z.string().default('USD'),
  fuelSurchargeIncluded: z.boolean().default(false),
  catering: z.enum(['operator', 'client', 'none']).default('operator'),
  cancelPenalty14d: z.number().default(50),
  cancelPenalty7d: z.number().default(100),
  cancelPenalty48h: z.number().default(100),
  contractStart: z.string().min(1),
  contractEnd: z.string().nullable().optional(),
  seasonId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
})

const contractUpdateSchema = contractCreateSchema.partial().omit({ operatorId: true })

const statusUpdateSchema = z.object({
  status: z.enum(['draft', 'proposed', 'confirmed', 'operating', 'completed', 'cancelled']),
})

const flightCreateSchema = z.object({
  operatorId: z.string().min(1),
  contractId: z.string().min(1),
  operatorCode: z.string().min(1),
  flightNumber: z.string().min(1),
  flightDate: z.string().min(1),
  departureIata: z.string().min(3).max(4),
  arrivalIata: z.string().min(3).max(4),
  stdUtc: z.string().min(4),
  staUtc: z.string().min(4),
  blockMinutes: z.number(),
  arrivalDayOffset: z.number().default(0),
  aircraftTypeIcao: z.string().nullable().optional(),
  aircraftRegistration: z.string().nullable().optional(),
  legType: z.enum(['revenue', 'positioning', 'technical']).default('revenue'),
  paxBooked: z.number().default(0),
  cargoKg: z.number().default(0),
  status: z.string().default('planned'),
  crewNotes: z.string().nullable().optional(),
  slotRequested: z.boolean().default(false),
  slotStatus: z.string().nullable().optional(),
})

const positioningGenSchema = z.object({
  contractId: z.string().min(1),
  operatorCode: z.string().min(1),
  homeBase: z.string().min(3).max(4),
})

// ── Helpers ──

function getDowForDate(dateStr: string): string {
  const d = new Date(dateStr)
  const jsDay = d.getUTCDay()
  const iataDay = jsDay === 0 ? 7 : jsDay
  const dow = '0000000'.split('')
  dow[iataDay - 1] = String(iataDay)
  return dow.join('')
}

function nowIso(): string {
  return new Date().toISOString()
}

// ── Routes ──

export async function charterRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /charter/contracts ──
  app.get('/charter/contracts', async (req) => {
    const { operatorId } = operatorQuery.parse(req.query)
    return CharterContract.find({ operatorId }).sort({ contractStart: -1 }).lean()
  })

  // ── POST /charter/contracts ──
  app.post('/charter/contracts', async (req) => {
    const body = contractCreateSchema.parse(req.body)
    const id = crypto.randomUUID()
    const now = nowIso()
    await CharterContract.create({
      _id: id,
      ...body,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
    return { id }
  })

  // ── PATCH /charter/contracts/:id ──
  app.patch<{ Params: { id: string } }>('/charter/contracts/:id', async (req) => {
    const body = contractUpdateSchema.parse(req.body)
    const updated = await CharterContract.findByIdAndUpdate(
      req.params.id,
      { ...body, updatedAt: nowIso() },
      { new: true, lean: true },
    )
    if (!updated) throw { statusCode: 404, message: 'Contract not found' }
    return updated
  })

  // ── PATCH /charter/contracts/:id/status ──
  app.patch<{ Params: { id: string } }>('/charter/contracts/:id/status', async (req) => {
    const { status } = statusUpdateSchema.parse(req.body)
    const result = await CharterContract.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: nowIso() },
      { new: true, lean: true },
    )
    if (!result) throw { statusCode: 404, message: 'Contract not found' }
    return { ok: true }
  })

  // ── DELETE /charter/contracts/:id ──
  app.delete<{ Params: { id: string } }>('/charter/contracts/:id', async (req) => {
    const contractId = req.params.id

    // Cascade: delete all flights and their linked scheduled flights
    const flights = await CharterFlight.find({ contractId }).lean()
    const sfIds = flights.map((f) => f.scheduledFlightId).filter(Boolean)
    if (sfIds.length) await ScheduledFlight.deleteMany({ _id: { $in: sfIds } })
    await CharterFlight.deleteMany({ contractId })
    await CharterContract.findByIdAndDelete(contractId)

    return { ok: true }
  })

  // ── GET /charter/flights ──
  app.get('/charter/flights', async (req) => {
    const { contractId } = z.object({ contractId: z.string().min(1) }).parse(req.query)
    return CharterFlight.find({ contractId }).sort({ flightDate: 1, stdUtc: 1 }).lean()
  })

  // ── POST /charter/flights ──
  app.post('/charter/flights', async (req) => {
    const body = flightCreateSchema.parse(req.body)
    const flightId = crypto.randomUUID()
    const sfId = crypto.randomUUID()
    const now = nowIso()

    // 1. Create linked ScheduledFlight for Gantt visibility
    await ScheduledFlight.create({
      _id: sfId,
      operatorId: body.operatorId,
      airlineCode: body.operatorCode,
      flightNumber: body.flightNumber,
      depStation: body.departureIata,
      arrStation: body.arrivalIata,
      stdUtc: body.stdUtc,
      staUtc: body.staUtc,
      blockMinutes: body.blockMinutes,
      arrivalDayOffset: body.arrivalDayOffset,
      daysOfWeek: getDowForDate(body.flightDate),
      aircraftTypeIcao: body.aircraftTypeIcao || null,
      serviceType: body.legType === 'positioning' ? 'P' : 'C',
      source: 'charter',
      status: 'draft',
      effectiveFrom: normalizeDate(body.flightDate) ?? body.flightDate,
      effectiveUntil: normalizeDate(body.flightDate) ?? body.flightDate,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    // 2. Create charter flight
    await CharterFlight.create({
      _id: flightId,
      operatorId: body.operatorId,
      contractId: body.contractId,
      flightNumber: body.flightNumber,
      flightDate: body.flightDate,
      departureIata: body.departureIata,
      arrivalIata: body.arrivalIata,
      stdUtc: body.stdUtc,
      staUtc: body.staUtc,
      blockMinutes: body.blockMinutes,
      arrivalDayOffset: body.arrivalDayOffset,
      aircraftTypeIcao: body.aircraftTypeIcao || null,
      aircraftRegistration: body.aircraftRegistration || null,
      legType: body.legType,
      paxBooked: body.paxBooked,
      cargoKg: body.cargoKg,
      status: body.status,
      scheduledFlightId: sfId,
      crewNotes: body.crewNotes || null,
      slotRequested: body.slotRequested,
      slotStatus: body.slotStatus || null,
      createdAt: now,
    })

    return { id: flightId }
  })

  // ── DELETE /charter/flights/:id ──
  app.delete<{ Params: { id: string } }>('/charter/flights/:id', async (req) => {
    const flight = await CharterFlight.findById(req.params.id).lean()
    if (!flight) throw { statusCode: 404, message: 'Flight not found' }

    // Delete linked scheduled flight
    if (flight.scheduledFlightId) {
      await ScheduledFlight.findByIdAndDelete(flight.scheduledFlightId)
    }

    await CharterFlight.findByIdAndDelete(req.params.id)
    return { ok: true }
  })

  // ── GET /charter/stats ──
  app.get('/charter/stats', async (req) => {
    const { contractId } = z.object({ contractId: z.string().min(1) }).parse(req.query)

    const flights = await CharterFlight.find({ contractId, status: { $ne: 'cancelled' } }).lean()
    if (!flights.length) {
      return {
        totalFlights: 0,
        revenueFlights: 0,
        positioningFlights: 0,
        totalBlockMinutes: 0,
        estimatedRevenue: 0,
        paxTotal: 0,
      }
    }

    const contract = await CharterContract.findById(contractId).lean()

    const revenueFlights = flights.filter((f) => f.legType === 'revenue').length
    const totalBlockMinutes = flights.reduce((sum, f) => sum + (f.blockMinutes || 0), 0)

    let estimatedRevenue = 0
    if (contract?.ratePerSector) {
      estimatedRevenue = revenueFlights * contract.ratePerSector
    } else if (contract?.ratePerBlockHour) {
      estimatedRevenue = (totalBlockMinutes / 60) * contract.ratePerBlockHour
    }

    return {
      totalFlights: flights.length,
      revenueFlights,
      positioningFlights: flights.filter((f) => f.legType === 'positioning').length,
      totalBlockMinutes,
      estimatedRevenue,
      paxTotal: flights.reduce((sum, f) => sum + (f.paxBooked || 0), 0),
    }
  })

  // ── GET /charter/next-flight-number ──
  app.get('/charter/next-flight-number', async () => {
    const last = await CharterFlight.findOne().sort({ flightNumber: -1 }).select('flightNumber').lean()
    if (!last) return { flightNumber: '9001' }
    const num = parseInt(last.flightNumber, 10)
    if (isNaN(num)) return { flightNumber: '9001' }
    return { flightNumber: String(Math.min(num + 1, 9999)) }
  })

  // ── POST /charter/generate-positioning ──
  app.post('/charter/generate-positioning', async (req) => {
    const { contractId, operatorCode, homeBase } = positioningGenSchema.parse(req.body)

    const flights = await CharterFlight.find({ contractId }).sort({ flightDate: 1, stdUtc: 1 }).lean()
    const revenueFlights = flights.filter((f) => f.legType === 'revenue' && f.status !== 'cancelled')

    if (!revenueFlights.length) return { legs: [] }

    const legs: Array<{ from: string; to: string; date: string; before?: string }> = []

    // Positioning from home base to first revenue flight
    const first = revenueFlights[0]
    if (first.departureIata !== homeBase) {
      legs.push({
        from: homeBase,
        to: first.departureIata,
        date: first.flightDate,
        before: `${operatorCode}${first.flightNumber}`,
      })
    }

    // Between consecutive revenue flights
    for (let i = 0; i < revenueFlights.length - 1; i++) {
      const curr = revenueFlights[i]
      const next = revenueFlights[i + 1]
      if (curr.arrivalIata !== next.departureIata) {
        legs.push({
          from: curr.arrivalIata,
          to: next.departureIata,
          date: next.flightDate,
          before: `${operatorCode}${next.flightNumber}`,
        })
      }
    }

    // Positioning back to home base from last revenue flight
    const last = revenueFlights[revenueFlights.length - 1]
    if (last.arrivalIata !== homeBase) {
      legs.push({
        from: last.arrivalIata,
        to: homeBase,
        date: last.flightDate,
      })
    }

    return { legs }
  })
}
