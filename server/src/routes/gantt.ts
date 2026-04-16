import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { Airport } from '../models/Airport.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { LopaConfig } from '../models/LopaConfig.js'
import { CabinClass } from '../models/CabinClass.js'
import { Operator } from '../models/Operator.js'
import { OptimizerRun } from '../models/OptimizerRun.js'
import { SlotSeries } from '../models/SlotSeries.js'
import { SlotDate } from '../models/SlotDate.js'
import { MovementMessageLog } from '../models/MovementMessageLog.js'
import { encodeMvtMessage } from '@skyhub/logic/src/iata/mvt-encoder'
import type { MvtActionCode } from '@skyhub/logic/src/iata/types'

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
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
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
    sfFilter.status = statusFilter ? { $in: statusFilter.split(',') } : { $ne: 'cancelled' }
    if (acTypeFilter) {
      sfFilter.aircraftTypeIcao = { $in: acTypeFilter.split(',') }
    }

    // Parallel queries — include FlightInstance overlays for per-date assignments
    const [scheduledFlights, registrations, acTypes, instances, operator, lopaConfigs, cabinClasses] =
      await Promise.all([
        ScheduledFlight.find(sfFilter).lean(),
        AircraftRegistration.find({ operatorId, isActive: true }).lean(),
        AircraftType.find({ operatorId, isActive: true }).lean(),
        // Extend range by 7 days before 'from' to cover flights with departureDayOffset lookback
        FlightInstance.find(
          {
            operatorId,
            operatingDate: {
              $gte: new Date(new Date(from + 'T00:00:00Z').getTime() - 7 * DAY_MS).toISOString().slice(0, 10),
              $lte: to,
            },
          },
          {
            _id: 1,
            'tail.registration': 1,
            'tail.icaoType': 1,
            status: 1,
            'actual.atdUtc': 1,
            'actual.offUtc': 1,
            'actual.onUtc': 1,
            'actual.ataUtc': 1,
            'estimated.etdUtc': 1,
            'estimated.etaUtc': 1,
            isProtected: 1,
          },
        ).lean(),
        Operator.findById(operatorId, { countryIso2: 1 }).lean(),
        LopaConfig.find({ operatorId, isActive: true }, { _id: 1, aircraftType: 1, cabins: 1, isDefault: 1 }).lean(),
        CabinClass.find({ operatorId, isActive: true }, { code: 1, sortOrder: 1 }).sort({ sortOrder: 1 }).lean(),
      ])

    const operatorCountry = (operator?.countryIso2 as string) ?? null

    // Build instance overlay map: compositeId → { reg, cancelled, actual/estimated times }
    const instanceMap = new Map<
      string,
      {
        reg: string | null
        cancelled: boolean
        atdUtc: number | null
        offUtc: number | null
        onUtc: number | null
        ataUtc: number | null
        etdUtc: number | null
        etaUtc: number | null
        isProtected: boolean
      }
    >()
    for (const inst of instances) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = (inst as any).actual
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = (inst as any).estimated
      instanceMap.set(inst._id as string, {
        reg: inst.tail?.registration ?? null,
        cancelled: inst.status === 'cancelled',
        atdUtc: a?.atdUtc ?? null,
        offUtc: a?.offUtc ?? null,
        onUtc: a?.onUtc ?? null,
        ataUtc: a?.ataUtc ?? null,
        etdUtc: e?.etdUtc ?? null,
        etaUtc: e?.etaUtc ?? null,
        isProtected: !!(inst as any).isProtected,
      })
    }

    // AC type lookup by _id
    const acTypeMap = new Map(acTypes.map((t) => [t._id, t]))

    // LOPA lookup: registration lopaConfigId → config, fallback to type default
    const lopaById = new Map(lopaConfigs.map((l) => [l._id, l]))
    const lopaDefaultByType = new Map<string, (typeof lopaConfigs)[0]>()
    for (const l of lopaConfigs) {
      if (l.isDefault && !lopaDefaultByType.has(l.aircraftType)) lopaDefaultByType.set(l.aircraftType, l)
    }

    // Date expansion
    // Each flight uses its own day offsets to determine the operating date range.
    // A flight with departureDayOffset=3 actually departs 2 days after its operating date,
    // so we look back (offset-1) days per flight to catch rotations starting before the view.
    const fromMs = dateToDayMs(from)
    const toMs = dateToDayMs(to)
    const visibleEndMs = toMs + DAY_MS // inclusive of last day
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flights: any[] = []

    for (const sf of scheduledFlights) {
      const effFromMs = dateToDayMs(sf.effectiveFrom)
      const effUntilMs = dateToDayMs(sf.effectiveUntil)
      const dow = sf.daysOfWeek
      const depOffset = sf.departureDayOffset ?? 1
      const arrOffset = sf.arrivalDayOffset ?? 1
      const maxOffset = Math.max(depOffset, arrOffset)

      // Expand operating dates from (from - offset lookback) to (to)
      const rangeStart = Math.max(effFromMs, fromMs - (maxOffset - 1) * DAY_MS)
      const rangeEnd = Math.min(effUntilMs, toMs)

      for (let dayMs = rangeStart; dayMs <= rangeEnd; dayMs += DAY_MS) {
        const opDate = new Date(dayMs).toISOString().slice(0, 10)
        const jsDay = new Date(opDate + 'T12:00:00Z').getUTCDay()
        const ssimDay = jsDay === 0 ? 7 : jsDay
        if (!dow.includes(String(ssimDay))) continue

        const stdMs = dayMs + (depOffset - 1) * DAY_MS + timeStringToMs(sf.stdUtc)
        const staMs = dayMs + (arrOffset - 1) * DAY_MS + timeStringToMs(sf.staUtc)

        // Only include if the flight overlaps the visible window
        if (staMs < fromMs || stdMs >= visibleEndMs) continue

        const block = sf.blockMinutes ?? Math.round((staMs - stdMs) / 60_000)

        // Per-date: check FlightInstance for overrides or cancellation
        const compositeId = `${sf._id}|${opDate}`
        const inst = instanceMap.get(compositeId)
        if (inst?.cancelled) continue // removed from this date
        const aircraftReg = inst
          ? inst.reg // explicit per-date assignment (or null if unassigned)
          : ((sf.aircraftReg as string) ?? null) // fallback to pattern default

        flights.push({
          id: compositeId,
          scheduledFlightId: sf._id,
          airlineCode: sf.airlineCode ?? null,
          flightNumber: sf.flightNumber,
          depStation: sf.depStation,
          arrStation: sf.arrStation,
          stdUtc: stdMs,
          staUtc: staMs,
          blockMinutes: block,
          operatingDate: opDate,
          aircraftTypeIcao: sf.aircraftTypeIcao ?? null,
          aircraftReg,
          status: sf.status,
          serviceType: sf.serviceType ?? 'J',
          scenarioId: sf.scenarioId ?? null,
          rotationId: sf.rotationId ?? null,
          rotationSequence: sf.rotationSequence ?? null,
          rotationLabel: sf.rotationLabel ?? null,
          // OOOI actual + estimated times from FlightInstance
          atdUtc: inst?.atdUtc ?? null,
          offUtc: inst?.offUtc ?? null,
          onUtc: inst?.onUtc ?? null,
          ataUtc: inst?.ataUtc ?? null,
          etdUtc: inst?.etdUtc ?? null,
          etaUtc: inst?.etaUtc ?? null,
          isProtected: inst?.isProtected ?? false,
        })
      }
    }

    flights.sort((a, b) => a.stdUtc - b.stdUtc)

    // ── Slot status + utilization join ──
    const sfIds = [...new Set(flights.map((f) => f.scheduledFlightId).filter(Boolean))]
    if (sfIds.length > 0) {
      const slotSeriesDocs = await SlotSeries.find(
        { linkedScheduledFlightId: { $in: sfIds } },
        { linkedScheduledFlightId: 1, status: 1, _id: 1, airportIata: 1 },
      ).lean()

      // Build sfId → series info map
      const slotMap = new Map<string, { status: string; seriesId: string; airportIata: string }>()
      const seriesIds: string[] = []
      for (const ss of slotSeriesDocs) {
        if (ss.linkedScheduledFlightId) {
          slotMap.set(ss.linkedScheduledFlightId, {
            status: ss.status,
            seriesId: ss._id as string,
            airportIata: ss.airportIata,
          })
          seriesIds.push(ss._id as string)
        }
      }

      // Batch utilization aggregation for all series (past dates only)
      const todayISO = new Date().toISOString().split('T')[0]
      const utilAgg =
        seriesIds.length > 0
          ? await SlotDate.aggregate([
              { $match: { seriesId: { $in: seriesIds }, slotDate: { $lte: todayISO } } },
              {
                $group: {
                  _id: '$seriesId',
                  total: { $sum: 1 },
                  operated: { $sum: { $cond: [{ $eq: ['$operationStatus', 'operated'] }, 1, 0] } },
                  jnus: { $sum: { $cond: [{ $eq: ['$operationStatus', 'jnus'] }, 1, 0] } },
                },
              },
            ])
          : []

      const utilMap = new Map<string, { pct: number; operated: number; jnus: number; total: number }>()
      for (const row of utilAgg) {
        const total = row.total as number
        const operated = row.operated as number
        const jnusCount = row.jnus as number
        const pct = total > 0 ? Math.round(((operated + jnusCount) / total) * 100) : 0
        utilMap.set(row._id as string, { pct, operated, jnus: jnusCount, total })
      }

      // Attach slot data to each flight
      for (const f of flights) {
        const slot = slotMap.get(f.scheduledFlightId)
        if (!slot) continue
        if (slot.status !== 'draft' && slot.status !== 'submitted') {
          f.slotStatus = slot.status
        }
        f.slotSeriesId = slot.seriesId
        const util = utilMap.get(slot.seriesId)
        if (util) {
          f.slotUtilizationPct = util.pct
          f.slotRiskLevel = util.pct >= 85 ? 'safe' : util.pct >= 80 ? 'close' : 'at_risk'
        }
      }
    }

    // Aircraft with joined type info, sorted by type then registration
    const aircraft = registrations
      .map((r) => {
        const t = acTypeMap.get(r.aircraftTypeId)
        // Resolve LOPA: registration's config → type default → null
        const lopa =
          (r.lopaConfigId ? lopaById.get(r.lopaConfigId) : null) ??
          (t?.icaoType ? lopaDefaultByType.get(t.icaoType) : null)
        // Build seat config using ALL cabin classes (sorted by sortOrder), showing 0 for missing classes
        let seatConfig: string | null = null
        if (lopa?.cabins?.length && cabinClasses.length > 0) {
          const lopaCabinMap = new Map(
            (lopa.cabins as { classCode: string; seats: number }[]).map((c) => [c.classCode, c.seats]),
          )
          seatConfig = cabinClasses.map((cc) => lopaCabinMap.get(cc.code as string) ?? 0).join('/')
        }
        return {
          id: r._id,
          registration: r.registration,
          aircraftTypeId: r.aircraftTypeId,
          aircraftTypeIcao: t?.icaoType ?? null,
          aircraftTypeName: t?.name ?? null,
          status: r.status,
          homeBaseIcao: r.homeBaseIcao ?? null,
          color: t?.color ?? null,
          fuelBurnRateKgPerHour: r.fuelBurnRateKgPerHour ?? t?.fuelBurnRateKgPerHour ?? null,
          seatConfig,
        }
      })
      .sort(
        (a, b) =>
          (a.aircraftTypeIcao ?? '').localeCompare(b.aircraftTypeIcao ?? '') ||
          a.registration.localeCompare(b.registration),
      )

    const aircraftTypes = acTypes.map((t) => ({
      id: t._id,
      icaoType: t.icaoType,
      name: t.name,
      category: t.category ?? 'narrow_body',
      color: t.color ?? null,
      tatDefaultMinutes: t.tat?.defaultMinutes ?? null,
      tatDomDom: t.tat?.domDom ?? null,
      tatDomInt: t.tat?.domInt ?? null,
      tatIntDom: t.tat?.intDom ?? null,
      tatIntInt: t.tat?.intInt ?? null,
      fuelBurnRateKgPerHour: t.fuelBurnRateKgPerHour ?? null,
    }))

    // Build station → country map for DOM/INT determination
    const allStations = new Set<string>()
    for (const f of flights) {
      allStations.add(f.depStation)
      allStations.add(f.arrStation)
    }
    const airports = await Airport.find(
      { $or: [{ icaoCode: { $in: [...allStations] } }, { iataCode: { $in: [...allStations] } }] },
      { icaoCode: 1, iataCode: 1, countryIso2: 1, utcOffsetHours: 1, curfews: 1 },
    ).lean()
    const stationCountryMap: Record<string, string> = {}
    const stationUtcOffsetMap: Record<string, number> = {}
    // Curfew map: station code → array of { startTime, endTime, effectiveFrom, effectiveUntil }
    const stationCurfewMap: Record<
      string,
      Array<{ startTime: string; endTime: string; effectiveFrom: string | null; effectiveUntil: string | null }>
    > = {}
    for (const ap of airports) {
      if (ap.icaoCode && ap.countryIso2) stationCountryMap[ap.icaoCode] = ap.countryIso2 as string
      if (ap.iataCode && ap.countryIso2) stationCountryMap[ap.iataCode as string] = ap.countryIso2 as string
      if (ap.utcOffsetHours != null) {
        if (ap.icaoCode) stationUtcOffsetMap[ap.icaoCode] = ap.utcOffsetHours as number
        if (ap.iataCode) stationUtcOffsetMap[ap.iataCode as string] = ap.utcOffsetHours as number
      }
      const curfews = ((ap as any).curfews ?? []) as Array<{
        startTime: string
        endTime: string
        effectiveFrom?: string | null
        effectiveUntil?: string | null
      }>
      if (curfews.length > 0) {
        const entries = curfews.map((c) => ({
          startTime: c.startTime,
          endTime: c.endTime,
          effectiveFrom: c.effectiveFrom ?? null,
          effectiveUntil: c.effectiveUntil ?? null,
        }))
        if (ap.icaoCode) stationCurfewMap[ap.icaoCode] = entries
        if (ap.iataCode) stationCurfewMap[ap.iataCode as string] = entries
      }
    }

    return {
      flights,
      aircraft,
      aircraftTypes,
      operatorCountry,
      stationCountryMap,
      stationUtcOffsetMap,
      stationCurfewMap,
      meta: { from, to, totalFlights: flights.length, totalAircraft: aircraft.length, expandedAt: Date.now() },
    }
  })

  // ── PATCH /gantt/assign — per-date tail assignment via FlightInstance ──
  app.patch('/gantt/assign', async (req, reply) => {
    const parsed = assignSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, flightIds, registration } = parsed.data

    // Lightweight assign — just write the tail
    const bulkOps = flightIds.map((id) => {
      const [sfId, opDate] = id.split('|')
      return {
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              'tail.registration': registration,
              status: 'assigned',
              'syncMeta.updatedAt': Date.now(),
            },
            $setOnInsert: {
              operatorId,
              scheduledFlightId: sfId,
              operatingDate: opDate,
            },
          },
          upsert: true,
        },
      }
    })

    if (bulkOps.length > 0) {
      await FlightInstance.bulkWrite(bulkOps as any[], { ordered: false })
    }

    return { updated: bulkOps.length }
  })

  // ── PATCH /gantt/bulk-assign — batch assign multiple registrations in one request ──
  const bulkAssignSchema = z.object({
    operatorId: z.string().min(1),
    assignments: z.array(
      z.object({
        registration: z.string().min(1),
        flightIds: z.array(z.string().min(1)),
        delays: z
          .array(
            z.object({
              flightId: z.string().min(1),
              delayMinutes: z.number().int().min(0),
              newStdUtcMs: z.number(),
              newStaUtcMs: z.number(),
            }),
          )
          .optional(),
      }),
    ),
  })

  app.patch('/gantt/bulk-assign', async (req, reply) => {
    const parsed = bulkAssignSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, assignments } = parsed.data

    // Lightweight bulk assign — V1 pattern: just write the tail, nothing else
    const allFlightIds = assignments.flatMap((a) => a.flightIds)

    // Build minimal bulk ops — no ScheduledFlight lookup needed
    const bulkOps: any[] = []
    for (const { registration, flightIds, delays } of assignments) {
      // Build delay lookup for this registration group
      const delayMap = new Map<string, { delayMinutes: number; newStdUtcMs: number; newStaUtcMs: number }>()
      if (delays) {
        for (const d of delays) delayMap.set(d.flightId, d)
      }

      for (const id of flightIds) {
        const [sfId, opDate] = id.split('|')
        const delay = delayMap.get(id)

        const $set: Record<string, unknown> = {
          'tail.registration': registration,
          status: delay ? 'delayed' : 'assigned',
          'syncMeta.updatedAt': Date.now(),
        }

        // Apply delay times to estimated fields (preserves original schedule for reporting)
        if (delay) {
          $set['estimated.etdUtc'] = delay.newStdUtcMs
          $set['estimated.etaUtc'] = delay.newStaUtcMs
          $set['delayMinutes'] = delay.delayMinutes
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: id },
            update: {
              $set,
              $setOnInsert: {
                operatorId,
                scheduledFlightId: sfId,
                operatingDate: opDate,
              },
            },
            upsert: true,
          },
        })
      }
    }

    let totalUpserted = 0
    let totalModified = 0
    if (bulkOps.length > 0) {
      for (let i = 0; i < bulkOps.length; i += 5000) {
        const chunk = bulkOps.slice(i, i + 5000)
        const result = await FlightInstance.bulkWrite(chunk, { ordered: false })
        totalUpserted += result.upsertedCount
        totalModified += result.modifiedCount
        app.log.info(
          `bulk-assign chunk ${i / 5000 + 1}: ${chunk.length} ops → ${result.upsertedCount} upserted, ${result.modifiedCount} modified`,
        )
      }
    }

    // Verify: count how many FlightInstance records actually have a tail assigned
    const verifyCount = await FlightInstance.countDocuments({
      _id: { $in: allFlightIds },
      operatorId,
      'tail.registration': { $ne: null },
    })

    const expected = bulkOps.length
    if (verifyCount < expected) {
      app.log.warn(
        `bulk-assign verification: expected ${expected} assigned, found ${verifyCount} (${expected - verifyCount} missing)`,
      )
    }

    resolveIataCodes(operatorId, allFlightIds)
    return { updated: bulkOps.length, upserted: totalUpserted, modified: totalModified, verified: verifyCount }
  })

  // ── PATCH /gantt/unassign — per-date tail removal via FlightInstance ──
  app.patch('/gantt/unassign', async (req, reply) => {
    const parsed = unassignSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, flightIds } = parsed.data

    // Chunk the update to avoid MongoDB query limits
    let totalModified = 0
    for (let i = 0; i < flightIds.length; i += 5000) {
      const chunk = flightIds.slice(i, i + 5000)
      const result = await FlightInstance.updateMany(
        { _id: { $in: chunk }, operatorId },
        {
          $set: {
            'tail.registration': null,
            'tail.icaoType': null,
            status: 'scheduled',
            'syncMeta.updatedAt': Date.now(),
          },
        },
      )
      totalModified += result.modifiedCount
    }

    return { updated: totalModified }
  })

  // ── PATCH /gantt/remove-from-date — cancel specific flight instances ──
  const removeSchema = z.object({
    operatorId: z.string().min(1),
    flightIds: z.array(z.string().min(1)).min(1),
  })

  app.patch('/gantt/remove-from-date', async (req, reply) => {
    const parsed = removeSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, flightIds } = parsed.data

    // Lightweight cancel — just set status
    const bulkOps = flightIds.map((id) => {
      const [sfId, opDate] = id.split('|')
      return {
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              status: 'cancelled',
              'syncMeta.updatedAt': Date.now(),
            },
            $setOnInsert: {
              operatorId,
              scheduledFlightId: sfId,
              operatingDate: opDate,
              'syncMeta.version': 1,
            },
          },
          upsert: true,
        },
      }
    })

    if (bulkOps.length > 0) {
      await FlightInstance.bulkWrite(bulkOps as any[], { ordered: false })
    }

    // ── Phase 3: Cascade cancel to SlotDate records (fire-and-forget) ──
    Promise.resolve().then(async () => {
      try {
        const sfIdSet = new Map<string, string[]>()
        for (const id of flightIds) {
          const [sfId, opDate] = id.split('|')
          if (!sfIdSet.has(sfId)) sfIdSet.set(sfId, [])
          sfIdSet.get(sfId)!.push(opDate)
        }

        const linkedSeries = await SlotSeries.find(
          { linkedScheduledFlightId: { $in: [...sfIdSet.keys()] } },
          { _id: 1, linkedScheduledFlightId: 1 },
        ).lean()

        for (const ss of linkedSeries) {
          const dates = sfIdSet.get(ss.linkedScheduledFlightId as string)
          if (!dates?.length) continue
          await SlotDate.updateMany(
            { seriesId: ss._id, slotDate: { $in: dates }, operationStatus: { $ne: 'jnus' } },
            { $set: { operationStatus: 'cancelled' } },
          )
        }
      } catch (e) {
        console.error('SlotDate cascade error (non-blocking):', e)
      }
    })

    return { removed: bulkOps.length }
  })

  // ── POST /gantt/cancel-impact — simulate slot utilization impact of cancellation ──
  const cancelImpactSchema = z.object({
    operatorId: z.string().min(1),
    flightIds: z.array(z.string().min(1)).min(1),
  })

  app.post('/gantt/cancel-impact', async (req, reply) => {
    const parsed = cancelImpactSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed' })
    }
    const { flightIds } = parsed.data

    // Parse flightIds into scheduledFlightId + operatingDate pairs
    const sfDatePairs = new Map<string, string[]>()
    for (const id of flightIds) {
      const [sfId, opDate] = id.split('|')
      if (!sfDatePairs.has(sfId)) sfDatePairs.set(sfId, [])
      sfDatePairs.get(sfId)!.push(opDate)
    }

    // Find linked slot series
    const linkedSeries = await SlotSeries.find(
      { linkedScheduledFlightId: { $in: [...sfDatePairs.keys()] } },
      {
        _id: 1,
        linkedScheduledFlightId: 1,
        airportIata: 1,
        arrivalFlightNumber: 1,
        departureFlightNumber: 1,
        seasonCode: 1,
      },
    ).lean()

    if (!linkedSeries.length) return { impacts: [] }

    // Get utilization for each series
    const seriesIds = linkedSeries.map((s) => s._id as string)
    const utilAgg = await SlotDate.aggregate([
      { $match: { seriesId: { $in: seriesIds } } },
      {
        $group: {
          _id: '$seriesId',
          total: { $sum: 1 },
          operated: { $sum: { $cond: [{ $eq: ['$operationStatus', 'operated'] }, 1, 0] } },
          jnus: { $sum: { $cond: [{ $eq: ['$operationStatus', 'jnus'] }, 1, 0] } },
        },
      },
    ])
    const utilMap = new Map(utilAgg.map((r: Record<string, unknown>) => [r._id as string, r]))

    // Count how many dates per series would be cancelled
    const cancelCountMap = new Map<string, number>()
    for (const ss of linkedSeries) {
      const dates = sfDatePairs.get(ss.linkedScheduledFlightId as string) || []
      // Count dates that are currently operated or scheduled (not already cancelled/jnus)
      const existingDates = await SlotDate.countDocuments({
        seriesId: ss._id,
        slotDate: { $in: dates },
        operationStatus: { $in: ['operated', 'scheduled'] },
      })
      cancelCountMap.set(ss._id as string, existingDates)
    }

    // Look up airport names
    const airportIatas = [...new Set(linkedSeries.map((s) => s.airportIata))]
    const airports = await Airport.find(
      { iataCode: { $in: airportIatas } },
      { iataCode: 1, name: 1, coordinationLevel: 1 },
    ).lean()
    const airportMap = new Map(airports.map((a) => [a.iataCode, a]))

    // Build impact results
    const impacts = linkedSeries
      .map((ss) => {
        const util = utilMap.get(ss._id as string) as Record<string, number> | undefined
        const total = (util?.total ?? 0) as number
        const operated = (util?.operated ?? 0) as number
        const jnusCount = (util?.jnus ?? 0) as number
        const cancelledCount = cancelCountMap.get(ss._id as string) ?? 0
        const currentPct = total > 0 ? Math.round(((operated + jnusCount) / total) * 100) : 0
        const afterPct = total > 0 ? Math.round(((operated + jnusCount - cancelledCount) / total) * 100) : 0
        const airport = airportMap.get(ss.airportIata) as Record<string, unknown> | undefined

        // Determine next season
        const seasonType = (ss.seasonCode as string)?.[0]
        const seasonNum = parseInt((ss.seasonCode as string)?.slice(1) || '26', 10)
        const nextSeason = seasonType === 'S' ? `W${seasonNum}` : `S${seasonNum + 1}`

        return {
          seriesId: ss._id,
          airportIata: ss.airportIata,
          airportName: (airport?.name as string) ?? ss.airportIata,
          coordinationLevel: (airport?.coordinationLevel as number) ?? 3,
          flightNumber: (ss.arrivalFlightNumber || ss.departureFlightNumber || '') as string,
          currentPct,
          afterPct: Math.max(0, afterPct),
          operated,
          jnus: jnusCount,
          total,
          cancelledCount,
          willBreachThreshold: currentPct >= 80 && afterPct < 80,
          isAlreadyAtRisk: currentPct < 80,
          nextSeason,
        }
      })
      .filter((i) => i.cancelledCount > 0) // Only include series actually impacted

    return { impacts }
  })

  // ── PATCH /gantt/swap — bidirectional per-date tail swap between two aircraft ──
  const swapSchema = z.object({
    operatorId: z.string().min(1),
    aFlightIds: z.array(z.string().min(1)),
    aRegistration: z.string().nullable(),
    bFlightIds: z.array(z.string().min(1)),
    bRegistration: z.string().nullable(),
  })

  app.patch('/gantt/swap', async (req, reply) => {
    const parsed = swapSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const { operatorId, aFlightIds, aRegistration, bFlightIds, bRegistration } = parsed.data

    // Lightweight swap — just write tails, no SF lookup needed
    const buildOps = (flightIds: string[], toReg: string | null) =>
      flightIds.map((id) => {
        const [sfId, opDate] = id.split('|')
        return {
          updateOne: {
            filter: { _id: id },
            update: {
              $set: {
                'tail.registration': toReg,
                status: toReg ? 'assigned' : 'scheduled',
                'syncMeta.updatedAt': Date.now(),
              },
              $setOnInsert: { operatorId, scheduledFlightId: sfId, operatingDate: opDate },
            },
            upsert: true,
          },
        }
      })

    const ops = [...buildOps(aFlightIds, bRegistration), ...buildOps(bFlightIds, aRegistration)]

    if (ops.length > 0) {
      await FlightInstance.bulkWrite(ops as any[], { ordered: false })
    }

    return { updated: ops.length }
  })

  // ── POST /gantt/optimizer/runs — Save an optimizer run ──
  const saveRunSchema = z.object({
    operatorId: z.string().min(1),
    name: z.string().min(1),
    periodFrom: z.string().min(1),
    periodTo: z.string().min(1),
    config: z.object({ preset: z.string(), method: z.string() }),
    stats: z.object({
      totalFlights: z.number(),
      assigned: z.number(),
      overflow: z.number(),
      chainBreaks: z.number(),
      totalFuelKg: z.number().nullable().optional(),
      baselineFuelKg: z.number().nullable().optional(),
      fuelSavingsPercent: z.number().nullable().optional(),
    }),
    assignments: z.array(z.object({ flightId: z.string(), registration: z.string() })),
    overflowFlightIds: z.array(z.string()),
    chainBreaks: z.array(z.object({ flightId: z.string(), prevArr: z.string(), nextDep: z.string() })),
    typeBreakdown: z.array(
      z.object({
        icaoType: z.string(),
        typeName: z.string(),
        totalFlights: z.number(),
        assigned: z.number(),
        overflow: z.number(),
        totalBlockHours: z.number(),
        aircraftCount: z.number(),
        avgBhPerDay: z.number(),
      }),
    ),
    elapsedMs: z.number(),
  })

  app.post('/gantt/optimizer/runs', async (req, reply) => {
    const parsed = saveRunSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const id = crypto.randomUUID()
    await OptimizerRun.create({ _id: id, ...parsed.data, createdAt: new Date().toISOString() })
    return { id }
  })

  // ── GET /gantt/optimizer/runs — List runs for a period (summaries only) ──
  app.get('/gantt/optimizer/runs', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.operatorId || !q.periodFrom || !q.periodTo) {
      return reply.code(400).send({ error: 'operatorId, periodFrom, periodTo required' })
    }
    const runs = await OptimizerRun.find(
      { operatorId: q.operatorId, periodFrom: q.periodFrom, periodTo: q.periodTo },
      { assignments: 0 }, // exclude large assignments array from list
    )
      .sort({ createdAt: -1 })
      .lean()
    return runs
  })

  // ── GET /gantt/optimizer/runs/:id — Full run (including assignments) ──
  app.get('/gantt/optimizer/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const q = req.query as Record<string, string>
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const run = await OptimizerRun.findOne({ _id: id, operatorId: q.operatorId }).lean()
    if (!run) return reply.code(404).send({ error: 'Run not found' })
    return run
  })

  // ── DELETE /gantt/optimizer/runs/:id — Delete a run ──
  app.delete('/gantt/optimizer/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const q = req.query as Record<string, string>
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })
    const result = await OptimizerRun.deleteOne({ _id: id, operatorId: q.operatorId })
    return { removed: result.deletedCount }
  })

  // Background helper: resolve ICAO → IATA codes for dep/arr on newly created instances
  async function resolveIataCodes(operatorId: string, instanceIds: string[]) {
    try {
      const instances = await FlightInstance.find({ _id: { $in: instanceIds }, operatorId }).lean()
      for (const inst of instances) {
        if (!inst.dep || !inst.arr) continue
        if (inst.dep.iata !== inst.dep.icao && inst.arr.iata !== inst.arr.icao) continue
        const [depAp, arrAp] = await Promise.all([
          Airport.findOne({ $or: [{ icaoCode: inst.dep.icao }, { iataCode: inst.dep.icao }] }).lean(),
          Airport.findOne({ $or: [{ icaoCode: inst.arr.icao }, { iataCode: inst.arr.icao }] }).lean(),
        ])
        const update: Record<string, string> = {}
        if (depAp?.iataCode) update['dep.iata'] = depAp.iataCode
        if (depAp?.icaoCode) update['dep.icao'] = depAp.icaoCode
        if (arrAp?.iataCode) update['arr.iata'] = arrAp.iataCode
        if (arrAp?.icaoCode) update['arr.icao'] = arrAp.icaoCode
        if (Object.keys(update).length) {
          await FlightInstance.updateOne({ _id: inst._id }, { $set: update })
        }
      }
    } catch {
      /* non-critical */
    }
  }

  // ── GET /gantt/resolve-flight — find sfId for (flightNumber, date, dep, arr) ──
  // Used by modules outside the Gantt (e.g. Disruption Center right-click)
  // that hold human-readable flight identifiers but need the composite ID
  // ("sfId|opDate") that openFlightInfo() expects. Start from FlightInstance
  // (the operating-day record disruptions attach to) which stores both
  // ICAO and IATA station codes; fall back to ScheduledFlight if no
  // instance exists for the date.
  app.get('/gantt/resolve-flight', async (req, reply) => {
    const q = req.query as { operatorId?: string; flightNumber?: string; date?: string; dep?: string; arr?: string }
    if (!q.operatorId || !q.flightNumber || !q.date) {
      return reply.code(400).send({ error: 'operatorId, flightNumber, date required' })
    }

    // ── 1. FlightInstance lookup ──
    // Disruptions are detected against operating-day instances; the
    // instance carries the scheduledFlightId we need.
    const instances = await FlightInstance.find(
      { operatorId: q.operatorId, flightNumber: q.flightNumber, operatingDate: q.date },
      { _id: 1, scheduledFlightId: 1, dep: 1, arr: 1, schedule: 1 },
    ).lean()

    const matchByStations = (rows: any[]) => {
      if (!q.dep && !q.arr) return rows
      return rows.filter((r) => {
        const depOk = !q.dep || r.dep?.icao === q.dep || r.dep?.iata === q.dep
        const arrOk = !q.arr || r.arr?.icao === q.arr || r.arr?.iata === q.arr
        return depOk && arrOk
      })
    }

    const instanceMatches = matchByStations(instances)
    const usableInstances = (instanceMatches.length > 0 ? instanceMatches : instances).filter(
      (i: any) => i.scheduledFlightId,
    )
    if (usableInstances.length > 0) {
      if (usableInstances.length > 1) {
        app.log.warn(
          { operatorId: q.operatorId, flightNumber: q.flightNumber, date: q.date, count: usableInstances.length },
          'resolve-flight: more than one FlightInstance match — picking earliest STD',
        )
        usableInstances.sort((a: any, b: any) => (a.schedule?.stdUtc ?? 0) - (b.schedule?.stdUtc ?? 0))
      }
      return { scheduledFlightId: usableInstances[0].scheduledFlightId, operatingDate: q.date }
    }

    // ── 2. ScheduledFlight fallback ──
    // Used when no operating-day instance exists yet (e.g. future-dated
    // schedule flag). depStation may be ICAO or IATA on the schedule
    // itself; check both via the Airport collection if exact match fails.
    const candidates = await ScheduledFlight.find(
      {
        operatorId: q.operatorId,
        flightNumber: q.flightNumber,
        effectiveFrom: { $lte: q.date },
        effectiveUntil: { $gte: q.date },
      },
      { _id: 1, depStation: 1, arrStation: 1, daysOfWeek: 1, stdUtc: 1 },
    ).lean()

    const jsDay = new Date(q.date + 'T12:00:00Z').getUTCDay()
    const ssimDay = jsDay === 0 ? 7 : jsDay
    let matches = candidates.filter((c: any) => (c.daysOfWeek as string).includes(String(ssimDay)))

    if (matches.length > 1 && (q.dep || q.arr)) {
      // Translate the disruption's station codes through Airport so we
      // can match either an ICAO or IATA-stored value on the schedule.
      const codes = [q.dep, q.arr].filter(Boolean) as string[]
      const airports = await Airport.find(
        { $or: codes.map((c) => ({ $or: [{ icaoCode: c }, { iataCode: c }] })) },
        { icaoCode: 1, iataCode: 1 },
      ).lean()
      const variants = (code?: string) => {
        if (!code) return null
        const a = airports.find((x: any) => x.icaoCode === code || x.iataCode === code)
        return a ? [a.icaoCode, a.iataCode].filter(Boolean) : [code]
      }
      const depVariants = variants(q.dep)
      const arrVariants = variants(q.arr)
      const narrowed = matches.filter(
        (c: any) =>
          (!depVariants || depVariants.includes(c.depStation)) && (!arrVariants || arrVariants.includes(c.arrStation)),
      )
      if (narrowed.length > 0) matches = narrowed
    }

    if (matches.length === 0) return reply.code(404).send({ error: 'No matching flight on that date' })

    if (matches.length > 1) {
      app.log.warn(
        { operatorId: q.operatorId, flightNumber: q.flightNumber, date: q.date, count: matches.length },
        'resolve-flight: more than one ScheduledFlight match — picking earliest STD',
      )
      matches.sort((a: any, b: any) => String(a.stdUtc).localeCompare(String(b.stdUtc)))
    }

    return { scheduledFlightId: matches[0]._id, operatingDate: q.date }
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
    const findAirport = (code: string) => Airport.findOne({ $or: [{ icaoCode: code }, { iataCode: code }] }).lean()

    // Look up FlightInstance by composite ID first (preferred), fallback to flightNumber+date
    const compositeId = `${q.sfId}|${q.opDate}`
    const instance = await FlightInstance.findOne({
      $or: [{ _id: compositeId }, { operatorId: q.operatorId, flightNumber: sf.flightNumber, operatingDate: q.opDate }],
    }).lean()

    // Per-date tail from FlightInstance overrides ScheduledFlight default
    const tailReg = instance?.tail?.registration ?? (sf.aircraftReg as string) ?? null

    const [depAirport, arrAirport, acType, acReg, lopa] = await Promise.all([
      findAirport(sf.depStation as string),
      findAirport(sf.arrStation as string),
      sf.aircraftTypeIcao
        ? AircraftType.findOne({ operatorId: q.operatorId, icaoType: sf.aircraftTypeIcao }).lean()
        : null,
      tailReg ? AircraftRegistration.findOne({ operatorId: q.operatorId, registration: tailReg }).lean() : null,
      sf.aircraftTypeIcao
        ? LopaConfig.findOne({
            operatorId: q.operatorId,
            aircraftType: sf.aircraftTypeIcao,
            isDefault: true,
            isActive: true,
          }).lean()
        : null,
    ])

    const fmtAirport = (a: typeof depAirport) =>
      a
        ? {
            icaoCode: a.icaoCode,
            iataCode: a.iataCode ?? null,
            name: a.name,
            city: a.city ?? null,
            country: a.country ?? null,
            timezone: a.timezone,
            utcOffsetHours: a.utcOffsetHours ?? null,
          }
        : null

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
      aircraftType: acType
        ? {
            icaoType: acType.icaoType,
            name: acType.name,
            category: acType.category ?? 'narrow_body',
            paxCapacity: acType.paxCapacity ?? null,
            manufacturer: acType.manufacturer ?? null,
          }
        : null,
      aircraftReg: tailReg,
      aircraft: acReg
        ? {
            registration: acReg.registration,
            serialNumber: acReg.serialNumber ?? null,
            homeBaseIcao: acReg.homeBaseIcao ?? null,
            status: acReg.status,
          }
        : null,

      hasInstance: !!instance,
      estimated: {
        etdUtc: instance?.estimated?.etdUtc ?? null,
        etaUtc: instance?.estimated?.etaUtc ?? null,
      },
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
      pax: instance?.pax
        ? {
            adultExpected: instance.pax.adultExpected ?? null,
            adultActual: instance.pax.adultActual ?? null,
            childExpected: instance.pax.childExpected ?? null,
            childActual: instance.pax.childActual ?? null,
            infantExpected: instance.pax.infantExpected ?? null,
            infantActual: instance.pax.infantActual ?? null,
          }
        : null,
      fuel: instance?.fuel
        ? {
            initial: instance.fuel.initial ?? null,
            uplift: instance.fuel.uplift ?? null,
            burn: instance.fuel.burn ?? null,
            flightPlan: instance.fuel.flightPlan ?? null,
          }
        : null,
      cargo: (instance?.cargo ?? []).map((c) => ({
        category: c.category,
        weight: c.weight ?? null,
        pieces: c.pieces ?? null,
      })),
      delays: (instance?.delays ?? []).map((d) => ({
        code: d.code,
        minutes: d.minutes,
        reason: d.reason ?? '',
        category: d.category ?? '',
      })),
      crew: (instance?.crew ?? []).map((c) => ({ employeeId: c.employeeId, role: c.role, name: c.name })),
      memos: (instance?.memos ?? []).map((m) => ({
        id: m.id,
        category: m.category ?? 'general',
        content: m.content,
        author: m.author ?? '',
        pinned: !!m.pinned,
        createdAt: m.createdAt ?? '',
      })),
      connections: {
        outgoing: (instance?.connections?.outgoing ?? []).map((c) => ({
          flightNumber: c.flightNumber,
          pax: c.pax ?? 0,
        })),
        incoming: (instance?.connections?.incoming ?? []).map((c) => ({
          flightNumber: c.flightNumber,
          pax: c.pax ?? 0,
        })),
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

      lopa: lopa
        ? {
            configName: lopa.configName,
            totalSeats: lopa.totalSeats,
            cabins: (lopa.cabins ?? []).map((c) => ({ classCode: c.classCode, seats: c.seats })),
          }
        : null,
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

    // Preserve existing tail assignment from FlightInstance if present
    const existing = await FlightInstance.findOne({ _id: compositeId }).lean()
    const tailReg = existing?.tail?.registration ?? (sf.aircraftReg as string) ?? null
    const tailType = existing?.tail?.icaoType ?? (sf.aircraftTypeIcao as string) ?? null

    const update = {
      operatorId,
      scheduledFlightId,
      flightNumber,
      operatingDate,
      dep: depCodes,
      arr: arrCodes,
      schedule: { stdUtc: stdMs, staUtc: staMs },
      estimated: body.estimated ?? existing?.estimated ?? { etdUtc: null, etaUtc: null },
      actual: body.actual ?? {},
      depInfo: body.depInfo ?? {},
      arrInfo: body.arrInfo ?? {},
      tail: { registration: tailReg, icaoType: tailType },
      pax: body.pax ?? {},
      fuel: body.fuel ?? {},
      cargo: body.cargo ?? [],
      delays: body.delays ?? [],
      memos: body.memos ?? [],
      connections: body.connections ?? { outgoing: [], incoming: [] },
      status: body.instanceStatus ?? (tailReg ? 'assigned' : 'scheduled'),
      syncMeta: { updatedAt: Date.now(), version: 1 },
    }

    await FlightInstance.findOneAndUpdate({ _id: compositeId }, { $set: update }, { upsert: true, new: true })

    // ── MVT auto-generation on OOOI change ──
    const newActual = (body.actual as Record<string, number | null>) ?? {}
    const prevActual = (existing?.actual as Record<string, number | null>) ?? {}

    // Detect which OOOI event just occurred
    let mvtAction: MvtActionCode | null = null
    if ((newActual.onUtc || newActual.ataUtc) && !prevActual.onUtc && !prevActual.ataUtc) {
      mvtAction = 'AA'
    } else if ((newActual.atdUtc || newActual.offUtc) && !prevActual.atdUtc && !prevActual.offUtc) {
      mvtAction = 'AD'
    }

    if (mvtAction) {
      const epochToHHMM = (ms: number): string => {
        const d = new Date(ms)
        return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`
      }

      const mvtRaw = encodeMvtMessage({
        flightId: {
          airline: flightNumber.slice(0, 2),
          flightNumber: flightNumber.slice(2),
          dayOfMonth: operatingDate.slice(-2),
          registration: (tailReg ?? '').replace(/-/g, ''),
          station: mvtAction === 'AD' ? depCodes.iata : arrCodes.iata,
        },
        actionCode: mvtAction,
        offBlocks: newActual.atdUtc ? epochToHHMM(newActual.atdUtc) : undefined,
        airborne: newActual.offUtc ? epochToHHMM(newActual.offUtc) : undefined,
        touchdown: newActual.onUtc ? epochToHHMM(newActual.onUtc) : undefined,
        onBlocks: newActual.ataUtc ? epochToHHMM(newActual.ataUtc) : undefined,
      })

      const activeScenarioId = (body.scenarioId as string) ?? null
      const now = new Date().toISOString()

      await MovementMessageLog.create({
        _id: crypto.randomUUID(),
        operatorId,
        messageType: 'MVT',
        actionCode: mvtAction,
        direction: 'outbound',
        status: activeScenarioId ? 'held' : 'pending',
        flightNumber,
        flightDate: operatingDate,
        registration: tailReg,
        depStation: depCodes.iata,
        arrStation: arrCodes.iata,
        summary: `MVT ${mvtAction} ${flightNumber} ${operatingDate}`,
        rawMessage: mvtRaw,
        scenarioId: activeScenarioId,
        flightInstanceId: compositeId,
        createdAtUtc: now,
        updatedAtUtc: now,
      })
    }

    return { success: true, id: compositeId }
  })

  // ── GET /gantt/aircraft-detail — aircraft info for popover ──
  app.get('/gantt/aircraft-detail', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (!q.operatorId || !q.registration) {
      return reply.code(400).send({ error: 'operatorId and registration required' })
    }

    const acReg = await AircraftRegistration.findOne({ operatorId: q.operatorId, registration: q.registration }).lean()
    if (!acReg) return reply.code(404).send({ error: 'Aircraft not found' })

    const acType = await AircraftType.findOne({ _id: acReg.aircraftTypeId }).lean()
    const lopa = acReg.lopaConfigId
      ? await LopaConfig.findById(acReg.lopaConfigId).lean()
      : acType?.icaoType
        ? await LopaConfig.findOne({
            operatorId: q.operatorId,
            aircraftType: acType.icaoType,
            isDefault: true,
            isActive: true,
          }).lean()
        : null

    // Fetch cabin class definitions for colors + sort order
    const cabinClasses = await CabinClass.find({ operatorId: q.operatorId, isActive: true }).lean()
    const cabinClassMap = new Map(cabinClasses.map((c) => [c.code, c]))

    return {
      registration: acReg.registration,
      status: acReg.status,
      aircraftTypeIcao: acType?.icaoType ?? null,
      aircraftTypeName: acType?.name ?? null,
      serialNumber: acReg.serialNumber ?? null,
      selcal: acReg.selcal ?? null,
      homeBaseIcao: acReg.homeBaseIcao ?? null,
      variant: acReg.variant ?? null,
      imageUrl: acReg.imageUrl ?? null,
      lopa: lopa
        ? {
            configName: lopa.configName,
            totalSeats: lopa.totalSeats,
            cabins: (lopa.cabins ?? [])
              .map((c) => {
                const cls = cabinClassMap.get(c.classCode)
                return {
                  classCode: c.classCode,
                  seats: c.seats,
                  color: cls?.color ?? null,
                  sortOrder: cls?.sortOrder ?? 99,
                }
              })
              .sort((a, b) => a.sortOrder - b.sortOrder),
          }
        : null,
    }
  })

  // ── PATCH /gantt/protect — Toggle isProtected on flight instances ──
  app.patch('/gantt/protect', async (req) => {
    const body = req.body as { operatorId: string; flightIds: string[]; isProtected: boolean }
    const { operatorId, flightIds, isProtected } = body
    if (!operatorId || !flightIds?.length) return { error: 'operatorId, flightIds required' }

    // Upsert: for flights that don't have a FlightInstance yet, create a minimal one
    let updated = 0
    for (const fid of flightIds) {
      await FlightInstance.findOneAndUpdate(
        { _id: fid },
        {
          $set: { isProtected, 'syncMeta.updatedAt': Date.now() },
          $setOnInsert: { operatorId, flightNumber: '', operatingDate: fid.split('|')[1] ?? '' },
          $inc: { 'syncMeta.version': 1 },
        },
        { upsert: true },
      )
      updated++
    }
    return { updated, isProtected }
  })

  // ── DELETE /gantt/flight-instances — Clear all flight instances for operator ──
  app.delete('/gantt/flight-instances', async (req) => {
    const q = req.query as Record<string, string>
    if (!q.operatorId) return { error: 'operatorId required' }
    const result = await FlightInstance.deleteMany({ operatorId: q.operatorId })
    return { deleted: result.deletedCount }
  })

  // ── POST /gantt/seed-oooi — Seed realistic OOOI data with delay-ripple cascading ──
  app.post('/gantt/seed-oooi', async (req, reply) => {
    const body = req.body as Record<string, unknown>
    const operatorId = body.operatorId as string
    const fromDate = body.from as string // YYYY-MM-DD
    const toDate = body.to as string // YYYY-MM-DD
    const otpTarget = (body.otpTarget as number) ?? 0.85 // 85% on-time (primary delay probability)
    const forceReseed = !!(body.forceReseed ?? false) // clear existing OOOI first

    if (!operatorId || !fromDate || !toDate) {
      return reply.code(400).send({ error: 'operatorId, from, to required' })
    }

    const scheduledFlights = await ScheduledFlight.find({
      operatorId,
      isActive: { $ne: false },
      status: { $ne: 'cancelled' },
    }).lean()

    if (scheduledFlights.length === 0) {
      console.warn(`  OOOI seed: 0 scheduled flights for operator "${operatorId}" — nothing to seed`)
      return { created: 0, skipped: 0, alreadySeeded: 0, repaired: 0, otpTarget, scheduledFlightCount: 0 }
    }

    // Force reseed: clear all existing instances so we can re-roll with ripple
    let cleared = 0
    if (forceReseed) {
      const result = await FlightInstance.deleteMany({
        operatorId,
        operatingDate: { $gte: fromDate, $lte: toDate },
      })
      cleared = result.deletedCount ?? 0
    }

    // Fetch existing instances that already have OOOI to avoid re-rolling.
    // Keep their ATA so they anchor the aircraft rotation chain and ripple delays forward.
    const existingInstances = forceReseed
      ? []
      : await FlightInstance.find(
          { operatorId, operatingDate: { $gte: fromDate, $lte: toDate }, 'actual.atdUtc': { $ne: null } },
          { _id: 1, 'actual.atdUtc': 1, 'actual.ataUtc': 1 },
        ).lean()
    const alreadySeededIds = new Set(existingInstances.map((i) => i._id as string))
    const existingAtaById = new Map<string, number>()
    for (const inst of existingInstances) {
      const atd = (inst.actual as { atdUtc?: number | null } | undefined)?.atdUtc
      const ata = (inst.actual as { ataUtc?: number | null } | undefined)?.ataUtc
      // prefer ATA; fall back to ATD so an in-progress leg still anchors the chain
      const anchor = ata ?? atd
      if (anchor) existingAtaById.set(inst._id as string, anchor)
    }

    const fromMs = new Date(fromDate + 'T00:00:00Z').getTime()
    const toMs = new Date(toDate + 'T00:00:00Z').getTime()
    const nowMs = Date.now()
    const DEFAULT_TAT_MS = 30 * 60_000 // fallback if AC type has no TAT configured

    // Build TAT + seat lookup by ICAO type (e.g. A320 → 25 min / 180 seats, A380 → 45 min / 500 seats)
    const acTypes = await AircraftType.find(
      { operatorId },
      { icaoType: 1, 'tat.defaultMinutes': 1, paxCapacity: 1 },
    ).lean()
    const tatByType = new Map<string, number>()
    const seatsByType = new Map<string, number>()
    for (const t of acTypes) {
      const tatMin = (t.tat as { defaultMinutes?: number | null })?.defaultMinutes
      if (tatMin) tatByType.set(t.icaoType as string, tatMin * 60_000)
      const paxCap = (t as { paxCapacity?: number | null }).paxCapacity
      if (paxCap && paxCap > 0) seatsByType.set(t.icaoType as string, paxCap)
    }

    // ── Phase 1: Expand all scheduled flights into per-date instances ──
    interface ExpandedFlight {
      compositeId: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sf: any
      opDate: string
      stdMs: number
      staMs: number
      blockMin: number
      aircraftReg: string | null
      icaoType: string | null
      rotationId: string | null
    }

    interface ExpandedAnchor {
      compositeId: string
      opDate: string
      stdMs: number
      ataMs: number
      rotationId: string | null
      aircraftReg: string | null
    }

    const allFlights: ExpandedFlight[] = []
    const anchors: ExpandedAnchor[] = []
    let skipped = 0
    let alreadySeeded = 0
    let dateSkipped = 0

    for (const sf of scheduledFlights) {
      const dow = sf.daysOfWeek as string
      const depOffset = (sf.departureDayOffset as number) ?? 1
      const arrOffset = (sf.arrivalDayOffset as number) ?? 1
      const effFrom = (sf.effectiveFrom as string) ?? ''
      const effUntil = (sf.effectiveUntil as string) ?? ''
      if (!effFrom || !effUntil) {
        dateSkipped++
        continue
      }
      const effFromMs = dateToDayMs(effFrom)
      const effUntilMs = dateToDayMs(effUntil)
      if (isNaN(effFromMs) || isNaN(effUntilMs)) {
        dateSkipped++
        continue
      }

      const rangeStart = Math.max(effFromMs, fromMs)
      const rangeEnd = Math.min(effUntilMs, toMs)

      for (let dayMs = rangeStart; dayMs <= rangeEnd; dayMs += DAY_MS) {
        const opDate = new Date(dayMs).toISOString().slice(0, 10)
        const jsDay = new Date(opDate + 'T12:00:00Z').getUTCDay()
        const ssimDay = jsDay === 0 ? 7 : jsDay
        if (!dow.includes(String(ssimDay))) continue

        const stdMs = dayMs + (depOffset - 1) * DAY_MS + timeStringToMs(sf.stdUtc as string)
        const staMs = dayMs + (arrOffset - 1) * DAY_MS + timeStringToMs(sf.staUtc as string)

        if (stdMs > nowMs) {
          skipped++
          continue
        }

        const compositeId = `${sf._id}|${opDate}`
        if (alreadySeededIds.has(compositeId)) {
          alreadySeeded++
          // Still include as a chain anchor so its ATA ripples into later flights.
          const anchorAta = existingAtaById.get(compositeId)
          if (anchorAta) {
            anchors.push({
              compositeId,
              opDate,
              stdMs,
              ataMs: anchorAta,
              rotationId: (sf.rotationId as string) ?? null,
              aircraftReg: (sf.aircraftReg as string) ?? null,
            })
          }
          continue
        }

        const blockMin = (sf.blockMinutes as number) ?? Math.round((staMs - stdMs) / 60_000)
        allFlights.push({
          compositeId,
          sf,
          opDate,
          stdMs,
          staMs,
          blockMin,
          aircraftReg: (sf.aircraftReg as string) ?? null,
          icaoType: (sf.aircraftTypeIcao as string) ?? null,
          rotationId: (sf.rotationId as string) ?? null,
        })
      }
    }

    // ── Phase 2: Group by rotation (preferred) or aircraft reg, merge anchors, sort chronologically ──
    // Each chain entry is either a flight to seed or an anchor (already-seeded) used only for its ATA.
    type ChainItem =
      | { kind: 'flight'; f: ExpandedFlight; stdMs: number }
      | { kind: 'anchor'; a: ExpandedAnchor; stdMs: number }
    const byChain = new Map<string, ChainItem[]>()
    const noChain: ExpandedFlight[] = []

    function chainKey(rotationId: string | null, aircraftReg: string | null): string | null {
      return rotationId ?? aircraftReg ?? null
    }

    for (const f of allFlights) {
      const key = chainKey(f.rotationId, f.aircraftReg)
      if (!key) {
        noChain.push(f)
        continue
      }
      const list = byChain.get(key) ?? []
      list.push({ kind: 'flight', f, stdMs: f.stdMs })
      byChain.set(key, list)
    }
    for (const a of anchors) {
      const key = chainKey(a.rotationId, a.aircraftReg)
      if (!key) continue
      const list = byChain.get(key) ?? []
      list.push({ kind: 'anchor', a, stdMs: a.stdMs })
      byChain.set(key, list)
    }
    for (const [, list] of byChain) list.sort((a, b) => a.stdMs - b.stdMs)

    // ── Phase 3: Walk each aircraft sequentially with delay ripple ──
    // Primary delay codes (root-cause delays)
    const primaryDelayCodes = [
      { code: '81', reason: 'ATC restrictions', category: 'ATFM' },
      { code: '87', reason: 'Airport facility issues', category: 'ATFM' },
      { code: '41', reason: 'Technical defect', category: 'Technical' },
      { code: '93', reason: 'Weather', category: 'Weather' },
      { code: '15', reason: 'Late boarding', category: 'Passenger' },
      { code: '33', reason: 'Cargo loading', category: 'Cargo' },
    ]
    // Reactionary delay code (cascaded from previous flight)
    const reactDelay = { code: '93', reason: 'Reactionary — late inbound aircraft', category: 'Reactionary' }

    interface SeedResult {
      compositeId: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sf: any
      opDate: string
      stdMs: number
      staMs: number
      blockMin: number
      atdUtc: number
      offUtc: number
      onUtc: number
      ataUtc: number
      doorCloseUtc: number
      delayMinutes: number
      delays: Array<{ code: string; minutes: number; reason: string; category: string }>
    }

    function generateRandomPrimaryDelay(): number {
      const r = Math.random()
      if (r < 0.5) return 20 + Math.floor(Math.random() * 25) // 20-45 min
      if (r < 0.8) return 45 + Math.floor(Math.random() * 45) // 45-90 min
      if (r < 0.95) return 90 + Math.floor(Math.random() * 60) // 90-150 min
      return 150 + Math.floor(Math.random() * 30) // 150-180 min
    }

    function computeOooi(f: ExpandedFlight, prevAta: number): SeedResult {
      // Reactionary delay: can't depart until previous flight arrives + turnaround
      const tatMs = (f.icaoType ? tatByType.get(f.icaoType) : null) ?? DEFAULT_TAT_MS
      const earliestDep = prevAta > 0 ? prevAta + tatMs : 0
      const reactDelayMs = Math.max(0, earliestDep - f.stdMs)

      // Primary delay: independent root-cause (weather, technical, etc.)
      let primaryDelayMs = 0
      const hasPrimaryDelay = Math.random() >= otpTarget
      if (hasPrimaryDelay) {
        primaryDelayMs = generateRandomPrimaryDelay() * 60_000
      }

      // Actual departure = latest of (schedule + primary, turnaround constraint)
      const atdUtc = Math.max(f.stdMs + primaryDelayMs, f.stdMs + reactDelayMs)
      const totalDelayMs = atdUtc - f.stdMs
      const delayMinutes = Math.round(totalDelayMs / 60_000)

      // Build delay code array
      const delays: Array<{ code: string; minutes: number; reason: string; category: string }> = []
      const reactMinutes = Math.round(reactDelayMs / 60_000)
      const primaryMinutes = Math.round(primaryDelayMs / 60_000)

      if (reactMinutes > 0 && reactDelayMs >= primaryDelayMs) {
        // Reactionary is the dominant delay
        delays.push({ ...reactDelay, minutes: reactMinutes })
        if (primaryMinutes > 0) {
          const dc = primaryDelayCodes[Math.floor(Math.random() * primaryDelayCodes.length)]
          delays.push({ ...dc, minutes: primaryMinutes })
        }
      } else if (primaryMinutes > 0) {
        const dc = primaryDelayCodes[Math.floor(Math.random() * primaryDelayCodes.length)]
        delays.push({ ...dc, minutes: primaryMinutes })
        if (reactMinutes > 0) {
          delays.push({ ...reactDelay, minutes: reactMinutes })
        }
      }

      // Small on-time variance (±3 min) only when no delay at all
      const variance = delayMinutes === 0 ? Math.floor(Math.random() * 6 - 3) * 60_000 : 0
      const finalAtd = atdUtc + variance

      // OOOI chain
      const doorCloseUtc = finalAtd - 5 * 60_000
      const offUtc = finalAtd + (8 + Math.floor(Math.random() * 7)) * 60_000
      const flightTimeMs = Math.max((f.blockMin - 12) * 60_000, 30 * 60_000)
      const onUtc = offUtc + flightTimeMs + Math.floor((Math.random() * 6 - 3) * 60_000)
      const ataUtc = onUtc + (5 + Math.floor(Math.random() * 8)) * 60_000

      return {
        compositeId: f.compositeId,
        sf: f.sf,
        opDate: f.opDate,
        stdMs: f.stdMs,
        staMs: f.staMs,
        blockMin: f.blockMin,
        atdUtc: finalAtd,
        offUtc,
        onUtc,
        ataUtc,
        doorCloseUtc,
        delayMinutes,
        delays,
      }
    }

    // Process rotation chains — delay ripples through each aircraft's rotation.
    // Anchors carry their known ATA forward without being re-seeded.
    const allResults: SeedResult[] = []

    for (const [, items] of byChain) {
      let prevAta = 0
      for (const item of items) {
        if (item.kind === 'anchor') {
          if (item.a.ataMs > prevAta) prevAta = item.a.ataMs
          continue
        }
        const result = computeOooi(item.f, prevAta)
        allResults.push(result)
        prevAta = result.ataUtc
      }
    }

    // Process unassigned flights (no chain = no ripple, just random primary delays)
    for (const f of noChain) {
      allResults.push(computeOooi(f, 0))
    }

    // ── Phase 4: Bulk upsert all FlightInstances ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bulkOps: any[] = []

    for (const r of allResults) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actual: Record<string, any> = {
        doorCloseUtc: null,
        atdUtc: null,
        offUtc: null,
        onUtc: null,
        ataUtc: null,
      }
      let status: string

      if (nowMs >= r.ataUtc) {
        actual.doorCloseUtc = r.doorCloseUtc
        actual.atdUtc = r.atdUtc
        actual.offUtc = r.offUtc
        actual.onUtc = r.onUtc
        actual.ataUtc = r.ataUtc
        status = 'completed'
      } else if (nowMs >= r.onUtc) {
        actual.doorCloseUtc = r.doorCloseUtc
        actual.atdUtc = r.atdUtc
        actual.offUtc = r.offUtc
        actual.onUtc = r.onUtc
        status = 'arrived'
      } else if (nowMs >= r.offUtc) {
        actual.doorCloseUtc = r.doorCloseUtc
        actual.atdUtc = r.atdUtc
        actual.offUtc = r.offUtc
        status = 'departed'
      } else if (nowMs >= r.atdUtc) {
        actual.doorCloseUtc = r.doorCloseUtc
        actual.atdUtc = r.atdUtc
        status = 'departed'
      } else {
        actual.doorCloseUtc = r.doorCloseUtc
        status = r.delayMinutes > 0 ? 'delayed' : 'assigned'
      }

      const totalDelayMs = r.delayMinutes * 60_000
      const totalSeats = seatsByType.get((r.sf.aircraftTypeIcao as string) ?? '') ?? 180
      const loadFactor = 0.75 + Math.random() * 0.2
      const totalPax = Math.floor(totalSeats * loadFactor)
      const children = Math.floor(totalPax * 0.05)
      const infants = Math.floor(totalPax * 0.02)
      const adults = totalPax - children - infants

      bulkOps.push({
        updateOne: {
          filter: { _id: r.compositeId },
          update: {
            $set: {
              operatorId,
              scheduledFlightId: r.sf._id,
              flightNumber: r.sf.flightNumber,
              operatingDate: r.opDate,
              dep: { icao: r.sf.depStation, iata: r.sf.depStation },
              arr: { icao: r.sf.arrStation, iata: r.sf.arrStation },
              schedule: { stdUtc: r.stdMs, staUtc: r.staMs },
              estimated: { etdUtc: r.stdMs + totalDelayMs, etaUtc: r.staMs + totalDelayMs },
              actual,
              pax: {
                adultExpected: adults,
                adultActual: adults,
                childExpected: children,
                childActual: children,
                infantExpected: infants,
                infantActual: infants,
              },
              delays: r.delays,
              status,
              syncMeta: { updatedAt: Date.now(), version: 1 },
            },
            $setOnInsert: {
              tail: {
                registration: (r.sf.aircraftReg as string) ?? null,
                icaoType: (r.sf.aircraftTypeIcao as string) ?? null,
              },
            },
          },
          upsert: true,
        },
      })
    }

    // Execute in batches of 1000
    let created = 0
    for (let i = 0; i < bulkOps.length; i += 1000) {
      const batch = bulkOps.slice(i, i + 1000)
      const result = await FlightInstance.bulkWrite(batch, { ordered: false })
      created += (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0)
    }

    // Progression: for flights departed before but still missing ATA/ONA where
    // the scheduled arrival has already passed, materialize the arrival so the
    // OTP / Fuel / LF KPIs can recognize them as completed. We preserve the
    // delay already computed on ATD and extend it through to ATA.
    const staleInFlight = await FlightInstance.find({
      operatorId,
      operatingDate: { $gte: fromDate, $lte: toDate },
      'actual.atdUtc': { $ne: null },
      'actual.ataUtc': null,
      'schedule.staUtc': { $lt: nowMs - 10 * 60_000 },
    })
      .select({
        _id: 1,
        'schedule.stdUtc': 1,
        'schedule.staUtc': 1,
        'actual.atdUtc': 1,
        'actual.offUtc': 1,
        'actual.onUtc': 1,
      })
      .lean()

    let progressed = 0
    if (staleInFlight.length > 0) {
      const progressOps: Array<{ updateOne: { filter: { _id: string }; update: Record<string, unknown> } }> = []
      for (const f of staleInFlight) {
        const stdMs = (f.schedule as { stdUtc?: number | null })?.stdUtc ?? 0
        const staMs = (f.schedule as { staUtc?: number | null })?.staUtc ?? 0
        const atdMs = (f.actual as { atdUtc?: number | null })?.atdUtc ?? 0
        const offMs = (f.actual as { offUtc?: number | null })?.offUtc ?? null
        const onMs = (f.actual as { onUtc?: number | null })?.onUtc ?? null
        const delayMs = Math.max(0, atdMs - stdMs)
        const scheduledBlockMs = staMs - stdMs
        const projectedAta = Math.min(atdMs + scheduledBlockMs + delayMs, nowMs)
        const projectedOff = offMs ?? atdMs + 12 * 60_000
        const projectedOn = onMs ?? projectedAta - 5 * 60_000

        progressOps.push({
          updateOne: {
            filter: { _id: f._id as string },
            update: {
              $set: {
                'actual.offUtc': projectedOff,
                'actual.onUtc': projectedOn,
                'actual.ataUtc': projectedAta,
                status: 'completed',
                'syncMeta.updatedAt': Date.now(),
              },
              $inc: { 'syncMeta.version': 1 },
            },
          },
        })
        progressed++
      }
      for (let i = 0; i < progressOps.length; i += 1000) {
        await FlightInstance.bulkWrite(progressOps.slice(i, i + 1000), { ordered: false })
      }
    }

    // Repair: fix any FlightInstances with null tail by restoring from ScheduledFlight
    const nullTailInstances = await FlightInstance.find({
      operatorId,
      'tail.registration': null,
      operatingDate: { $gte: fromDate, $lte: toDate },
    }).lean()

    let repaired = 0
    for (const inst of nullTailInstances) {
      const sfId = inst.scheduledFlightId as string
      const sf = scheduledFlights.find((s) => s._id === sfId)
      if (sf?.aircraftReg) {
        await FlightInstance.findByIdAndUpdate(inst._id, {
          $set: {
            'tail.registration': sf.aircraftReg,
            'tail.icaoType': sf.aircraftTypeIcao ?? null,
          },
        })
        repaired++
      }
    }

    return {
      created,
      skipped,
      alreadySeeded,
      dateSkipped,
      cleared,
      repaired,
      progressed,
      otpTarget,
      scheduledFlightCount: scheduledFlights.length,
    }
  })
}
