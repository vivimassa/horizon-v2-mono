import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Pairing } from '../models/Pairing.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { Airport } from '../models/Airport.js'
import { AircraftType } from '../models/AircraftType.js'

/*
 * Routes for 4.1.5 Crew Pairing (operating pairings — sequences of flights
 * worked as one duty trip). All endpoints enforce the caller's operatorId
 * via req.operatorId from the auth middleware.
 */

const pairingLegInput = z.object({
  flightId: z.string().min(1),
  flightDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  legOrder: z.number().int().min(0),
  isDeadhead: z.boolean().default(false),
  dutyDay: z.number().int().min(1),
  depStation: z.string().min(1),
  arrStation: z.string().min(1),
  flightNumber: z.string().min(1),
  stdUtcIso: z.string().min(1),
  staUtcIso: z.string().min(1),
  blockMinutes: z.number().int().min(0),
  aircraftTypeIcao: z.string().nullable().optional(),
})

const createPairingSchema = z
  .object({
    pairingCode: z.string().min(1).max(32),
    baseAirport: z.string().min(1).max(4),
    baseId: z.string().nullable().optional(),
    scenarioId: z.string().nullable().optional(),
    seasonCode: z.string().nullable().optional(),
    aircraftTypeIcao: z.string().nullable().optional(),
    aircraftTypeId: z.string().nullable().optional(),
    complementKey: z.string().default('standard'),
    cockpitCount: z.number().int().min(1).max(8).default(2),
    facilityClass: z.string().nullable().optional(),
    crewCounts: z.record(z.string(), z.number()).nullable().optional(),
    reportTime: z.string().nullable().optional(),
    releaseTime: z.string().nullable().optional(),
    workflowStatus: z.enum(['draft', 'committed']).default('draft'),
    fdtlStatus: z.enum(['legal', 'warning', 'violation']).default('legal'),
    lastLegalityResult: z.unknown().nullable().optional(),
    legs: z.array(pairingLegInput).min(1),
  })
  .strict()

const updatePairingSchema = z
  .object({
    pairingCode: z.string().min(1).max(32),
    workflowStatus: z.enum(['draft', 'committed']),
    complementKey: z.string(),
    cockpitCount: z.number().int().min(1).max(8),
    facilityClass: z.string().nullable(),
    crewCounts: z.record(z.string(), z.number()).nullable(),
    reportTime: z.string().nullable(),
    releaseTime: z.string().nullable(),
    legs: z.array(pairingLegInput).min(1),
    fdtlStatus: z.enum(['legal', 'warning', 'violation']),
    lastLegalityResult: z.unknown().nullable(),
  })
  .partial()
  .strict()

/** Aggregate computed fields from a list of legs. */
function summarize(legs: z.infer<typeof pairingLegInput>[]): {
  totalBlockMinutes: number
  totalDutyMinutes: number
  pairingDays: number
  numberOfSectors: number
  layoverAirports: string[]
  startDate: string
  endDate: string
  routeChain: string
} {
  const totalBlock = legs.reduce((sum, l) => sum + l.blockMinutes, 0)
  const dates = [...new Set(legs.map((l) => l.flightDate))].sort()
  const startDate = dates[0] ?? ''
  const endDate = dates[dates.length - 1] ?? ''
  const pairingDays = dates.length
  const layovers = new Set<string>()
  for (let i = 0; i < legs.length - 1; i += 1) {
    if (legs[i].arrStation === legs[i + 1].depStation) layovers.add(legs[i].arrStation)
  }
  const chain = legs.length ? [legs[0].depStation, ...legs.map((l) => l.arrStation)].join('-') : ''
  return {
    totalBlockMinutes: totalBlock,
    totalDutyMinutes: totalBlock + 90 * pairingDays, // conservative pre-legality estimate
    pairingDays,
    numberOfSectors: legs.length,
    layoverAirports: [...layovers],
    startDate,
    endDate,
    routeChain: chain,
  }
}

export async function pairingRoutes(app: FastifyInstance): Promise<void> {
  // ── Context: bases + aircraft types the user can pair with ──
  app.get('/pairings/context', async (req) => {
    const operatorId = req.operatorId
    const [bases, aircraftTypes] = await Promise.all([
      Airport.find({ isCrewBase: true }).lean(),
      AircraftType.find({ operatorId, isActive: { $ne: false } }).lean(),
    ])
    return {
      bases: bases.map((b) => ({ _id: b._id, iata: b.iataCode, icao: b.icaoCode, name: b.name })),
      aircraftTypes: aircraftTypes.map((t) => ({
        _id: t._id,
        icaoType: t.icaoType,
        iataType: t.iataType,
      })),
    }
  })

  // ── Flight pool for a period (expands schedule days-of-week into instances) ──
  app.get('/pairings/flight-pool', async (req, reply) => {
    const q = req.query as Record<string, string>
    const dateFrom = q.dateFrom
    const dateTo = q.dateTo
    if (!dateFrom || !dateTo) return reply.code(400).send({ error: 'dateFrom and dateTo are required' })

    const scenarioId = q.scenarioId ?? null
    const filter: Record<string, unknown> = {
      operatorId: req.operatorId,
      effectiveFrom: { $lte: dateTo },
      effectiveUntil: { $gte: dateFrom },
    }
    if (scenarioId) filter.scenarioId = scenarioId
    else filter.scenarioId = { $in: [null, undefined] }
    if (q.aircraftTypes) {
      const types = q.aircraftTypes.split(',').filter(Boolean)
      if (types.length) filter.aircraftTypeIcao = { $in: types }
    }

    const flights = await ScheduledFlight.find(filter).lean()

    // Per-date tail overlays — written by the Network Gantt drag-to-assign UI
    // into the `flightInstances` collection. ScheduledFlight.aircraftReg is
    // rarely populated directly (SSIM import doesn't set it), so reading the
    // instance overlay is the only way to surface tails the planner has
    // actually assigned. Keyed here as `${scheduledFlightId}__${operatingDate}`.
    const instanceTails = new Map<string, string>()
    if (flights.length > 0) {
      const instances = await FlightInstance.find(
        {
          operatorId: req.operatorId,
          operatingDate: { $gte: dateFrom, $lte: dateTo },
          scheduledFlightId: { $in: flights.map((f) => f._id as string) },
        },
        { scheduledFlightId: 1, operatingDate: 1, 'tail.registration': 1 },
      ).lean()
      for (const inst of instances) {
        const reg = (inst as unknown as { tail?: { registration?: string | null } }).tail?.registration
        if (reg && inst.scheduledFlightId && inst.operatingDate) {
          instanceTails.set(`${inst.scheduledFlightId}__${inst.operatingDate}`, reg)
        }
      }
    }

    // Expand each scheduled flight into date instances between [dateFrom, dateTo]
    // that fall on an active day-of-week AND match the existing pairing coverage.
    const fromD = new Date(`${dateFrom}T00:00:00Z`)
    const toD = new Date(`${dateTo}T00:00:00Z`)
    const out: Array<{
      id: string
      scheduledFlightId: string
      instanceDate: string
      flightNumber: string
      departureAirport: string
      arrivalAirport: string
      std: string
      sta: string
      stdUtc: string
      staUtc: string
      blockMinutes: number
      aircraftType: string
      tailNumber: string | null
      rotationId: string | null
      rotationLabel: string | null
      serviceType: string | null
      daysOfWeek: string | null
      departureDayOffset: number
      arrivalDayOffset: number
      status: string
      /** Schedule-level effectivity — displayed in the FROM column. */
      effectiveFrom: string
      /** Schedule-level effectivity — displayed in the TO column. */
      effectiveUntil: string
      pairingId: string | null
    }> = []

    // Existing pairing coverage — maps "{flightId}__{date}" → pairingId
    const existing = await Pairing.find({
      operatorId: req.operatorId,
      scenarioId: scenarioId ?? null,
      startDate: { $lte: dateTo },
      endDate: { $gte: dateFrom },
    })
      .select('_id legs')
      .lean()
    const coveredById = new Map<string, string>()
    for (const p of existing) {
      for (const l of p.legs ?? []) {
        coveredById.set(`${l.flightId}__${l.flightDate}`, p._id as string)
      }
    }

    for (const f of flights) {
      const effFrom = new Date(`${f.effectiveFrom}T00:00:00Z`)
      const effTo = new Date(`${f.effectiveUntil}T00:00:00Z`)
      const start = effFrom > fromD ? effFrom : fromD
      const end = effTo < toD ? effTo : toD

      const depOffset = (f.departureDayOffset ?? 1) - 1 // 0 = same day, 1 = +1, …
      const arrOffset = (f.arrivalDayOffset ?? 1) - 1

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        // daysOfWeek is 7-char bitmask, Monday-first. 1 = active.
        const dow = (d.getUTCDay() + 6) % 7
        if ((f.daysOfWeek ?? '1111111')[dow] !== '1') continue

        const instanceDate = d.toISOString().slice(0, 10)
        const depDate = addDays(instanceDate, depOffset)
        const arrDate = addDays(instanceDate, arrOffset)
        const stdIsoForInstance = composeIso(depDate, f.stdUtc)
        const staIsoForInstance = composeIso(arrDate, f.staUtc)

        // Fallback block minutes if the DB row is missing the value —
        // compute directly from the two ISO timestamps.
        const derivedBlock = Math.max(
          0,
          Math.round((new Date(staIsoForInstance).getTime() - new Date(stdIsoForInstance).getTime()) / 60000),
        )
        const blockMinutes = f.blockMinutes && f.blockMinutes > 0 ? f.blockMinutes : derivedBlock

        const id = `${f._id}__${instanceDate}`

        const instanceTail = instanceTails.get(`${f._id as string}__${instanceDate}`) ?? null
        out.push({
          id,
          scheduledFlightId: f._id as string,
          instanceDate,
          flightNumber: `${f.airlineCode}${f.flightNumber}${f.suffix ?? ''}`,
          departureAirport: f.depStation,
          arrivalAirport: f.arrStation,
          std: f.stdLocal ? `${depDate}T${normalizeClock(f.stdLocal)}` : stdIsoForInstance,
          sta: f.staLocal ? `${arrDate}T${normalizeClock(f.staLocal)}` : staIsoForInstance,
          stdUtc: stdIsoForInstance,
          staUtc: staIsoForInstance,
          blockMinutes,
          aircraftType: f.aircraftTypeIcao ?? '',
          // Prefer per-date assignment from FlightInstance; fall back to the
          // pattern default on ScheduledFlight.
          tailNumber: instanceTail ?? f.aircraftReg ?? null,
          rotationId: f.rotationId ?? null,
          rotationLabel: f.rotationLabel ?? null,
          serviceType: f.serviceType ?? null,
          daysOfWeek: f.daysOfWeek ?? null,
          departureDayOffset: depOffset + 1,
          arrivalDayOffset: arrOffset + 1,
          status: f.status ?? 'active',
          // Display FROM/TO clamped to the requested period — same behaviour as
          // 1.1.1 Scheduling XL. Planners viewing April should see 01/04 → 30/04
          // on every row, even when the underlying schedule is a full-year series.
          effectiveFrom: f.effectiveFrom < dateFrom ? dateFrom : f.effectiveFrom,
          effectiveUntil: f.effectiveUntil > dateTo ? dateTo : f.effectiveUntil,
          pairingId: coveredById.get(id) ?? null,
        })
      }
    }

    out.sort((a, b) => a.stdUtc.localeCompare(b.stdUtc))
    return out
  })

  // ── List pairings ──
  app.get('/pairings', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = { operatorId: req.operatorId }
    if (q.scenarioId) filter.scenarioId = q.scenarioId
    else filter.scenarioId = { $in: [null, undefined] }
    if (q.dateFrom) filter.endDate = { $gte: q.dateFrom }
    if (q.dateTo) filter.startDate = { $lte: q.dateTo }
    if (q.baseAirport) filter.baseAirport = q.baseAirport
    return Pairing.find(filter).sort({ startDate: 1, pairingCode: 1 }).lean()
  })

  // ── Get one ──
  app.get('/pairings/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await Pairing.findOne({ _id: id, operatorId: req.operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'Pairing not found' })
    return doc
  })

  // ── Create ──
  app.post('/pairings', async (req, reply) => {
    const parsed = createPairingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const body = parsed.data

    // Verify every referenced flight belongs to this operator (tenant safety).
    const flightIds = [...new Set(body.legs.map((l) => l.flightId.split('__')[0]))]
    const found = await ScheduledFlight.countDocuments({
      _id: { $in: flightIds },
      operatorId: req.operatorId,
    })
    if (found !== flightIds.length) {
      return reply.code(400).send({ error: 'One or more referenced flights do not belong to this operator' })
    }

    const summary = summarize(body.legs)
    const now = new Date().toISOString()

    const doc = await Pairing.create({
      _id: crypto.randomUUID(),
      operatorId: req.operatorId,
      scenarioId: body.scenarioId ?? null,
      seasonCode: body.seasonCode ?? null,
      pairingCode: body.pairingCode,
      baseAirport: body.baseAirport,
      baseId: body.baseId ?? null,
      aircraftTypeIcao: body.aircraftTypeIcao ?? null,
      aircraftTypeId: body.aircraftTypeId ?? null,
      fdtlStatus: body.fdtlStatus,
      workflowStatus: body.workflowStatus,
      ...summary,
      reportTime: body.reportTime ?? null,
      releaseTime: body.releaseTime ?? null,
      numberOfDuties: summary.pairingDays,
      complementKey: body.complementKey,
      cockpitCount: body.cockpitCount,
      facilityClass: body.facilityClass ?? null,
      crewCounts: body.crewCounts ?? null,
      legs: body.legs,
      lastLegalityResult: body.lastLegalityResult ?? null,
      createdBy: (req as { user?: { sub?: string } }).user?.sub ?? 'system',
      createdAt: now,
      updatedAt: now,
    })

    return doc.toObject()
  })

  // ── Update ──
  app.patch('/pairings/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = updatePairingSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const body = parsed.data

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    Object.assign(patch, body)
    if (body.legs) {
      Object.assign(patch, summarize(body.legs))
      patch.numberOfDuties = (patch as { pairingDays: number }).pairingDays
    }

    const updated = await Pairing.findOneAndUpdate(
      { _id: id, operatorId: req.operatorId },
      { $set: patch },
      { new: true },
    ).lean()
    if (!updated) return reply.code(404).send({ error: 'Pairing not found' })
    return updated
  })

  // ── Delete ──
  app.delete('/pairings/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const res = await Pairing.deleteOne({ _id: id, operatorId: req.operatorId })
    if (res.deletedCount === 0) return reply.code(404).send({ error: 'Pairing not found' })
    return { success: true }
  })

  // ── Legality check (thin wrapper — full FDTL integration TBD) ──
  app.post('/pairings/legality/check', async (req, reply) => {
    const body = req.body as {
      legs?: unknown
      complementKey?: string
      cockpitCount?: number
      facilityClass?: string | null
    }
    const parsed = z.array(pairingLegInput).min(1).safeParse(body.legs)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    // Stub result until the server-side FDTL call is wired — the client-side
    // @skyhub/logic FDTL engine currently computes locally. This endpoint is a
    // placeholder for future server-side revalidation.
    return reply.code(501).send({ error: 'Server-side legality check not yet implemented — compute client-side.' })
  })
}

/** Shift a 'YYYY-MM-DD' by N whole days. */
function addDays(dateYmd: string, days: number): string {
  if (!days) return dateYmd
  const d = new Date(`${dateYmd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Normalize a clock like "0800", "08:00", or "08:00:00" to "HH:MM:SS". */
function normalizeClock(clock: string): string {
  if (!clock) return '00:00:00'
  const compact = clock.replace(/:/g, '')
  if (/^\d{4}$/.test(compact)) return `${compact.slice(0, 2)}:${compact.slice(2)}:00`
  if (/^\d{6}$/.test(compact)) return `${compact.slice(0, 2)}:${compact.slice(2, 4)}:${compact.slice(4)}`
  return clock // already in HH:MM or HH:MM:SS form
}

/** Combine a date (YYYY-MM-DD) with a clock string to form a full UTC ISO.
 *  ScheduledFlight stores stdUtc / staUtc as plain "HH:MM" (see Zod schema
 *  in scheduled-flights.ts) but may occasionally carry a full ISO with 'T'.
 *  Accept both shapes. */
function composeIso(dateYmd: string, clockOrIso: string): string {
  if (!clockOrIso) return `${dateYmd}T00:00:00.000Z`

  // Full ISO — extract the clock portion
  if (clockOrIso.includes('T')) {
    const m = clockOrIso.match(/T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/)
    const clock = m ? m[1] : '00:00:00'
    const withSeconds = /:\d{2}$/.test(clock) || /:\d{2}\./.test(clock) ? clock : `${clock}:00`
    return `${dateYmd}T${withSeconds}${withSeconds.includes('.') ? '' : '.000'}Z`
  }

  // Plain HH:MM — the primary shape in v2's ScheduledFlight model
  const m = clockOrIso.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return `${dateYmd}T00:00:00.000Z`
  const hh = m[1].padStart(2, '0')
  return `${dateYmd}T${hh}:${m[2]}:00.000Z`
}
