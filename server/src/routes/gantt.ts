import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { Airport } from '../models/Airport.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { LopaConfig } from '../models/LopaConfig.js'

// ── Zod schemas ──

const flightsQuerySchema = z.object({
  operatorId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scenarioId: z.string().optional(),
  acTypeFilter: z.string().optional(),
  statusFilter: z.string().optional(),
})

const assignSchema = z.object({
  operatorId: z.string().min(1),
  flightIds: z.array(z.string().min(1)).min(1),
  registration: z.string().min(1),
})

const unassignSchema = z.object({
  operatorId: z.string().min(1),
  flightIds: z.array(z.string().min(1)).min(1),
})

// ── Helpers ──

const DAY_MS = 86_400_000

/** Convert "0630" or "06:30" → milliseconds from midnight */
function timeStringToMs(time: string): number {
  const clean = time.replace(':', '')
  const h = parseInt(clean.slice(0, 2), 10) || 0
  const m = parseInt(clean.slice(2, 4), 10) || 0
  return (h * 60 + m) * 60_000
}

/** Normalize date: "01/04/2026" (DD/MM/YYYY) or "2026-04-01" (ISO) → "2026-04-01" */
function normalizeDate(d: string): string {
  if (d.includes('/')) {
    const [day, month, year] = d.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return d
}

/** Date string (ISO or DD/MM/YYYY) → UTC epoch ms at midnight */
function dateToDayMs(dateStr: string): number {
  return new Date(normalizeDate(dateStr) + 'T00:00:00Z').getTime()
}

// ── Routes ──

export async function ganttRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /gantt/flights — expand scheduled flight patterns into per-date instances ──
  app.get('/gantt/flights', async (req, reply) => {
    const parsed = flightsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, from, to, scenarioId, acTypeFilter, statusFilter } = parsed.data

    // Build ScheduledFlight filter
    // Date range filtering done in JS expansion loop (DB stores DD/MM/YYYY and ISO inconsistently)
    const sfFilter: Record<string, unknown> = {
      operatorId,
      isActive: { $ne: false },
    }
    if (scenarioId) sfFilter.scenarioId = scenarioId
    sfFilter.status = statusFilter
      ? { $in: statusFilter.split(',') }
      : { $ne: 'cancelled' }
    if (acTypeFilter) {
      sfFilter.aircraftTypeIcao = { $in: acTypeFilter.split(',') }
    }

    // Parallel queries
    const [scheduledFlights, registrations, acTypes] = await Promise.all([
      ScheduledFlight.find(sfFilter).lean(),
      AircraftRegistration.find({ operatorId, isActive: true }).lean(),
      AircraftType.find({ operatorId, isActive: true }).lean(),
    ])

    // AC type lookup by _id
    const acTypeMap = new Map(acTypes.map(t => [t._id, t]))

    // Date expansion
    const fromMs = dateToDayMs(from)
    const toMs = dateToDayMs(to)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flights: any[] = []

    for (const sf of scheduledFlights) {
      const effFromMs = dateToDayMs(sf.effectiveFrom)
      const effUntilMs = dateToDayMs(sf.effectiveUntil)
      const rangeStart = Math.max(effFromMs, fromMs)
      const rangeEnd = Math.min(effUntilMs, toMs)
      const dow = sf.daysOfWeek
      const depOffset = sf.departureDayOffset ?? 1
      const arrOffset = sf.arrivalDayOffset ?? 1

      for (let dayMs = rangeStart; dayMs <= rangeEnd; dayMs += DAY_MS) {
        const opDate = new Date(dayMs).toISOString().slice(0, 10)
        // DOW from schedule date string, noon UTC to avoid parsing edge cases
        const jsDay = new Date(opDate + 'T12:00:00Z').getUTCDay()
        const ssimDay = jsDay === 0 ? 7 : jsDay
        if (!dow.includes(String(ssimDay))) continue
        // SSIM offset 1 = operating date (same day), 2 = next day, etc.
        const stdMs = dayMs + (depOffset - 1) * DAY_MS + timeStringToMs(sf.stdUtc)
        const staMs = dayMs + (arrOffset - 1) * DAY_MS + timeStringToMs(sf.staUtc)
        const block = sf.blockMinutes ?? Math.round((staMs - stdMs) / 60_000)

        flights.push({
          id: `${sf._id}|${opDate}`,
          scheduledFlightId: sf._id,
          flightNumber: sf.flightNumber,
          depStation: sf.depStation,
          arrStation: sf.arrStation,
          stdUtc: stdMs,
          staUtc: staMs,
          blockMinutes: block,
          operatingDate: opDate,
          aircraftTypeIcao: sf.aircraftTypeIcao ?? null,
          aircraftReg: sf.aircraftReg ?? null,
          status: sf.status,
          serviceType: sf.serviceType ?? 'J',
          scenarioId: sf.scenarioId ?? null,
          rotationId: sf.rotationId ?? null,
          rotationSequence: sf.rotationSequence ?? null,
          rotationLabel: sf.rotationLabel ?? null,
        })
      }
    }

    flights.sort((a, b) => a.stdUtc - b.stdUtc)

    // Aircraft with joined type info, sorted by type then registration
    const aircraft = registrations
      .map(r => {
        const t = acTypeMap.get(r.aircraftTypeId)
        return {
          id: r._id,
          registration: r.registration,
          aircraftTypeId: r.aircraftTypeId,
          aircraftTypeIcao: t?.icaoType ?? null,
          aircraftTypeName: t?.name ?? null,
          status: r.status,
          homeBaseIcao: r.homeBaseIcao ?? null,
          color: t?.color ?? null,
        }
      })
      .sort((a, b) =>
        (a.aircraftTypeIcao ?? '').localeCompare(b.aircraftTypeIcao ?? '')
        || a.registration.localeCompare(b.registration)
      )

    const aircraftTypes = acTypes.map(t => ({
      id: t._id,
      icaoType: t.icaoType,
      name: t.name,
      category: t.category ?? 'narrow_body',
      color: t.color ?? null,
      tatDefaultMinutes: t.tat?.defaultMinutes ?? null,
    }))

    return {
      flights,
      aircraft,
      aircraftTypes,
      meta: { from, to, totalFlights: flights.length, totalAircraft: aircraft.length, expandedAt: Date.now() },
    }
  })

  // ── PATCH /gantt/assign — assign tail to scheduled flight patterns ──
  app.patch('/gantt/assign', async (req, reply) => {
    const parsed = assignSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, flightIds, registration } = parsed.data
    const sfIds = [...new Set(flightIds.map(id => id.split('|')[0]))]
    const result = await ScheduledFlight.updateMany(
      { _id: { $in: sfIds }, operatorId },
      { $set: { aircraftReg: registration, updatedAt: new Date().toISOString() } }
    )
    return { updated: result.modifiedCount }
  })

  // ── PATCH /gantt/unassign — remove tail assignment ──
  app.patch('/gantt/unassign', async (req, reply) => {
    const parsed = unassignSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, flightIds } = parsed.data
    const sfIds = [...new Set(flightIds.map(id => id.split('|')[0]))]
    const result = await ScheduledFlight.updateMany(
      { _id: { $in: sfIds }, operatorId },
      { $set: { aircraftReg: null, updatedAt: new Date().toISOString() } }
    )
    return { updated: result.modifiedCount }
  })

  // ── GET /gantt/flight-detail — full flight data for Flight Information dialog ──
  app.get('/gantt/flight-detail', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.operatorId || !q.sfId || !q.opDate) {
      return reply.code(400).send({ error: 'operatorId, sfId, and opDate required' })
    }

    const sf = await ScheduledFlight.findOne({ _id: q.sfId, operatorId: q.operatorId }).lean()
    if (!sf) return reply.code(404).send({ error: 'ScheduledFlight not found' })

    // Parallel joins — station codes may be ICAO (VVTS) or IATA (SGN)
    const findAirport = (code: string) =>
      Airport.findOne({ $or: [{ icaoCode: code }, { iataCode: code }] }).lean()

    const [depAirport, arrAirport, acType, acReg, instance, lopa] = await Promise.all([
      findAirport(sf.depStation as string),
      findAirport(sf.arrStation as string),
      sf.aircraftTypeIcao
        ? AircraftType.findOne({ operatorId: q.operatorId, icaoType: sf.aircraftTypeIcao }).lean()
        : null,
      sf.aircraftReg
        ? AircraftRegistration.findOne({ operatorId: q.operatorId, registration: sf.aircraftReg }).lean()
        : null,
      FlightInstance.findOne({ operatorId: q.operatorId, flightNumber: sf.flightNumber, operatingDate: q.opDate }).lean(),
      sf.aircraftTypeIcao
        ? LopaConfig.findOne({ operatorId: q.operatorId, aircraftType: sf.aircraftTypeIcao, isDefault: true, isActive: true }).lean()
        : null,
    ])

    const fmtAirport = (a: typeof depAirport) => a ? {
      icaoCode: a.icaoCode, iataCode: a.iataCode ?? null,
      name: a.name, city: a.city ?? null, country: a.country ?? null,
      timezone: a.timezone, utcOffsetHours: a.utcOffsetHours ?? null,
    } : null

    // Expand STD/STA to epoch ms for the operating date
    const dayMs = new Date(q.opDate + 'T00:00:00Z').getTime()
    const depOffset = (sf.departureDayOffset as number) ?? 1
    const arrOffset = (sf.arrivalDayOffset as number) ?? 1
    const stdMs = dayMs + (depOffset - 1) * DAY_MS + timeStringToMs(sf.stdUtc as string)
    const staMs = dayMs + (arrOffset - 1) * DAY_MS + timeStringToMs(sf.staUtc as string)

    return {
      id: `${sf._id}|${q.opDate}`,
      scheduledFlightId: sf._id,
      flightNumber: sf.flightNumber,
      airlineCode: sf.airlineCode ?? '',
      operatingDate: q.opDate,

      depStation: sf.depStation,
      arrStation: sf.arrStation,
      depAirport: fmtAirport(depAirport),
      arrAirport: fmtAirport(arrAirport),

      stdUtc: stdMs,
      staUtc: staMs,
      blockMinutes: sf.blockMinutes ?? Math.round((staMs - stdMs) / 60_000),
      daysOfWeek: sf.daysOfWeek,
      effectiveFrom: sf.effectiveFrom,
      effectiveUntil: sf.effectiveUntil,
      departureDayOffset: depOffset,
      arrivalDayOffset: arrOffset,

      aircraftTypeIcao: sf.aircraftTypeIcao ?? null,
      aircraftType: acType ? {
        icaoType: acType.icaoType, name: acType.name,
        category: acType.category ?? 'narrow_body',
        paxCapacity: acType.paxCapacity ?? null,
        manufacturer: acType.manufacturer ?? null,
      } : null,
      aircraftReg: sf.aircraftReg ?? null,
      aircraft: acReg ? {
        registration: acReg.registration,
        serialNumber: acReg.serialNumber ?? null,
        homeBaseIcao: acReg.homeBaseIcao ?? null,
        status: acReg.status,
      } : null,

      hasInstance: !!instance,
      actual: {
        doorCloseUtc: instance?.actual?.doorCloseUtc ?? null,
        atdUtc: instance?.actual?.atdUtc ?? null,
        offUtc: instance?.actual?.offUtc ?? null,
        onUtc: instance?.actual?.onUtc ?? null,
        ataUtc: instance?.actual?.ataUtc ?? null,
      },
      depInfo: {
        terminal: instance?.depInfo?.terminal ?? null,
        gate: instance?.depInfo?.gate ?? null,
        stand: instance?.depInfo?.stand ?? null,
        ctot: instance?.depInfo?.ctot ?? null,
      },
      arrInfo: {
        terminal: instance?.arrInfo?.terminal ?? null,
        gate: instance?.arrInfo?.gate ?? null,
        stand: instance?.arrInfo?.stand ?? null,
      },
      pax: instance?.pax ? {
        adultExpected: instance.pax.adultExpected ?? null,
        adultActual: instance.pax.adultActual ?? null,
        childExpected: instance.pax.childExpected ?? null,
        childActual: instance.pax.childActual ?? null,
        infantExpected: instance.pax.infantExpected ?? null,
        infantActual: instance.pax.infantActual ?? null,
      } : null,
      fuel: instance?.fuel ? {
        initial: instance.fuel.initial ?? null,
        uplift: instance.fuel.uplift ?? null,
        burn: instance.fuel.burn ?? null,
        flightPlan: instance.fuel.flightPlan ?? null,
      } : null,
      cargo: (instance?.cargo ?? []).map(c => ({ category: c.category, weight: c.weight ?? null, pieces: c.pieces ?? null })),
      delays: (instance?.delays ?? []).map(d => ({ code: d.code, minutes: d.minutes, reason: d.reason ?? '', category: d.category ?? '' })),
      crew: (instance?.crew ?? []).map(c => ({ employeeId: c.employeeId, role: c.role, name: c.name })),
      memos: (instance?.memos ?? []).map(m => ({ id: m.id, category: m.category ?? 'general', content: m.content, author: m.author ?? '', pinned: !!m.pinned, createdAt: m.createdAt ?? '' })),
      connections: {
        outgoing: (instance?.connections?.outgoing ?? []).map(c => ({ flightNumber: c.flightNumber, pax: c.pax ?? 0 })),
        incoming: (instance?.connections?.incoming ?? []).map(c => ({ flightNumber: c.flightNumber, pax: c.pax ?? 0 })),
      },

      status: sf.status,
      serviceType: sf.serviceType ?? 'J',
      cockpitCrewRequired: sf.cockpitCrewRequired ?? null,
      cabinCrewRequired: sf.cabinCrewRequired ?? null,
      isEtops: !!sf.isEtops,
      isOverwater: !!sf.isOverwater,
      rotationId: sf.rotationId ?? null,
      rotationLabel: sf.rotationLabel ?? null,
      rotationSequence: sf.rotationSequence ?? null,
      source: sf.source ?? 'manual',
      createdAt: sf.createdAt ?? null,
      updatedAt: sf.updatedAt ?? null,

      lopa: lopa ? {
        configName: lopa.configName,
        totalSeats: lopa.totalSeats,
        cabins: (lopa.cabins ?? []).map(c => ({ classCode: c.classCode, seats: c.seats })),
      } : null,
    }
  })

  // ── PUT /gantt/flight-instance — save operational data for a flight ──
  app.put('/gantt/flight-instance', async (req, reply) => {
    const body = req.body as Record<string, unknown>
    const operatorId = body.operatorId as string
    const scheduledFlightId = body.scheduledFlightId as string
    const operatingDate = body.operatingDate as string
    const flightNumber = body.flightNumber as string

    if (!operatorId || !scheduledFlightId || !operatingDate || !flightNumber) {
      return reply.code(400).send({ error: 'operatorId, scheduledFlightId, operatingDate, flightNumber required' })
    }

    const compositeId = `${scheduledFlightId}|${operatingDate}`

    // Look up station codes from ScheduledFlight for dep/arr
    const sf = await ScheduledFlight.findOne({ _id: scheduledFlightId, operatorId }).lean()
    if (!sf) return reply.code(404).send({ error: 'ScheduledFlight not found' })

    const findAirportIata = async (code: string) => {
      const ap = await Airport.findOne({ $or: [{ icaoCode: code }, { iataCode: code }] }).lean()
      return { icao: ap?.icaoCode ?? code, iata: ap?.iataCode ?? code }
    }
    const [depCodes, arrCodes] = await Promise.all([
      findAirportIata(sf.depStation as string),
      findAirportIata(sf.arrStation as string),
    ])

    const dayMs = new Date(operatingDate + 'T00:00:00Z').getTime()
    const depOff = (sf.departureDayOffset as number) ?? 1
    const arrOff = (sf.arrivalDayOffset as number) ?? 1
    const stdMs = dayMs + (depOff - 1) * DAY_MS + timeStringToMs(sf.stdUtc as string)
    const staMs = dayMs + (arrOff - 1) * DAY_MS + timeStringToMs(sf.staUtc as string)

    const update = {
      operatorId,
      flightNumber,
      operatingDate,
      dep: depCodes,
      arr: arrCodes,
      schedule: { stdUtc: stdMs, staUtc: staMs },
      actual: body.actual ?? {},
      depInfo: body.depInfo ?? {},
      arrInfo: body.arrInfo ?? {},
      tail: { registration: sf.aircraftReg ?? null, icaoType: sf.aircraftTypeIcao ?? null },
      pax: body.pax ?? {},
      fuel: body.fuel ?? {},
      cargo: body.cargo ?? [],
      delays: body.delays ?? [],
      memos: body.memos ?? [],
      connections: body.connections ?? { outgoing: [], incoming: [] },
      status: body.instanceStatus ?? 'scheduled',
      syncMeta: { updatedAt: Date.now(), version: 1 },
    }

    await FlightInstance.findOneAndUpdate(
      { _id: compositeId },
      { $set: update },
      { upsert: true, new: true }
    )

    return { success: true, id: compositeId }
  })
}
