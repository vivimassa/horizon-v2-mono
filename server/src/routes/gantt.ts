import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'

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
      const arrOffset = sf.arrivalDayOffset ?? 0

      for (let dayMs = rangeStart; dayMs <= rangeEnd; dayMs += DAY_MS) {
        const opDate = new Date(dayMs).toISOString().slice(0, 10)
        // DOW from schedule date string, noon UTC to avoid parsing edge cases
        const jsDay = new Date(opDate + 'T12:00:00Z').getUTCDay()
        const ssimDay = jsDay === 0 ? 7 : jsDay
        if (!dow.includes(String(ssimDay))) continue
        const stdMs = dayMs + timeStringToMs(sf.stdUtc)
        const staMs = dayMs + arrOffset * DAY_MS + timeStringToMs(sf.staUtc)
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
}
