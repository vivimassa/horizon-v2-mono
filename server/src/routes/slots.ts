import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SlotSeries } from '../models/SlotSeries.js'
import { SlotDate } from '../models/SlotDate.js'
import { SlotMessage } from '../models/SlotMessage.js'
import { SlotActionLog } from '../models/SlotActionLog.js'
import { Airport } from '../models/Airport.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { FlightInstance } from '../models/FlightInstance.js'

// ── Zod Schemas ──

const operatorQuery = z.object({ operatorId: z.string().min(1) })

const seriesQuery = z.object({
  operatorId: z.string().min(1),
  airportIata: z.string().min(3).max(4),
  seasonCode: z.string().regex(/^[SW]\d{2}$/),
})

const seriesCreateSchema = z.object({
  operatorId: z.string().min(1),
  airportIata: z.string().min(3),
  seasonCode: z.string(),
  arrivalFlightNumber: z.string().nullable().optional(),
  departureFlightNumber: z.string().nullable().optional(),
  arrivalOriginIata: z.string().nullable().optional(),
  departureDestIata: z.string().nullable().optional(),
  requestedArrivalTime: z.number().nullable().optional(),
  requestedDepartureTime: z.number().nullable().optional(),
  allocatedArrivalTime: z.number().nullable().optional(),
  allocatedDepartureTime: z.number().nullable().optional(),
  overnightIndicator: z.number().optional().default(0),
  periodStart: z.string(),
  periodEnd: z.string(),
  daysOfOperation: z.string().optional().default('1234567'),
  frequencyRate: z.number().optional().default(1),
  seats: z.number().nullable().optional(),
  aircraftTypeIcao: z.string().nullable().optional(),
  arrivalServiceType: z.string().nullable().optional(),
  departureServiceType: z.string().nullable().optional(),
  status: z.string().optional().default('draft'),
  priorityCategory: z.string().optional().default('new'),
  historicEligible: z.boolean().optional().default(false),
  lastActionCode: z.string().nullable().optional(),
  lastCoordinatorCode: z.string().nullable().optional(),
  flexibilityArrival: z.string().nullable().optional(),
  flexibilityDeparture: z.string().nullable().optional(),
  minTurnaroundMinutes: z.number().nullable().optional(),
  coordinatorRef: z.string().nullable().optional(),
  coordinatorReasonArrival: z.string().nullable().optional(),
  coordinatorReasonDeparture: z.string().nullable().optional(),
  waitlistPosition: z.number().nullable().optional(),
  linkedScheduledFlightId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const dateStatusSchema = z.object({
  operationStatus: z.enum(['scheduled', 'operated', 'cancelled', 'no_show', 'jnus']),
  jnusReason: z.string().nullable().optional(),
})

const bulkDateSchema = z.object({
  seriesId: z.string().min(1),
  dateRangeStart: z.string(),
  dateRangeEnd: z.string(),
  operationStatus: z.enum(['scheduled', 'operated', 'cancelled', 'no_show', 'jnus']),
  jnusReason: z.string().nullable().optional(),
})

const messageCreateSchema = z.object({
  operatorId: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  messageType: z.string().min(1),
  airportIata: z.string().min(3),
  seasonCode: z.string(),
  rawText: z.string().min(1),
  parseStatus: z.enum(['pending', 'parsed', 'error', 'partial']).optional().default('pending'),
  parseErrors: z.any().nullable().optional(),
  parsedSeriesCount: z.number().optional().default(0),
  source: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
})

const actionLogSchema = z.object({
  seriesId: z.string().min(1),
  actionCode: z.string().min(1),
  actionSource: z.enum(['airline', 'coordinator']),
  messageId: z.string().nullable().optional(),
  details: z.any().nullable().optional(),
})

// ── Helpers ──

function expandSeriesToDates(
  seriesId: string,
  periodStart: Date,
  periodEnd: Date,
  daysOfOperation: string,
  frequencyRate: number,
): { _id: string; seriesId: string; slotDate: string }[] {
  const dates: { _id: string; seriesId: string; slotDate: string }[] = []
  const current = new Date(periodStart)
  let weekCount = 0
  let lastIsoWeek = -1

  while (current <= periodEnd) {
    const jsDay = current.getDay()
    const iataDay = jsDay === 0 ? 7 : jsDay

    const isoWeek = getISOWeek(current)
    if (isoWeek !== lastIsoWeek) {
      weekCount++
      lastIsoWeek = isoWeek
    }

    const dayActive = daysOfOperation.includes(String(iataDay))
    const weekActive = frequencyRate === 1 || weekCount % 2 === 1

    if (dayActive && weekActive) {
      dates.push({
        _id: crypto.randomUUID(),
        seriesId,
        slotDate: current.toISOString().split('T')[0],
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return dates
}

function getISOWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function parseTimeToHHMM(timeStr: string | null): number | null {
  if (!timeStr) return null
  const parts = timeStr.replace(':', '').match(/^(\d{2})(\d{2})/)
  if (!parts) return null
  return parseInt(parts[1], 10) * 100 + parseInt(parts[2], 10)
}

// ── Route Registration ──

export async function slotRoutes(app: FastifyInstance): Promise<void> {

  // ─── GET /slots/airports ───
  app.get('/slots/airports', async () => {
    const airports = await Airport.find({
      isSlotControlled: true,
    }).sort({ iataCode: 1 }).lean()

    return airports.map((a: Record<string, unknown>) => ({
      iataCode: a.iataCode ?? '',
      name: a.name ?? '',
      coordinationLevel: a.coordinationLevel ?? 3,
      slotsPerHourDay: a.slotsPerHourDay ?? null,
      slotsPerHourNight: a.slotsPerHourNight ?? null,
      coordinatorName: a.coordinatorName ?? null,
      coordinatorEmail: a.coordinatorEmail ?? null,
    }))
  })

  // ─── GET /slots/fleet-stats ───
  // Returns per-airport aggregated stats for the fleet overview
  app.get('/slots/fleet-stats', async (req) => {
    const { operatorId, seasonCode } = z.object({
      operatorId: z.string().min(1),
      seasonCode: z.string().regex(/^[SW]\d{2}$/),
    }).parse(req.query)

    // Get all series grouped by airport
    const seriesAgg = await SlotSeries.aggregate([
      { $match: { operatorId, seasonCode } },
      { $group: {
        _id: '$airportIata',
        total: { $sum: 1 },
        confirmed: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
        offered: { $sum: { $cond: [{ $eq: ['$status', 'offered'] }, 1, 0] } },
        waitlisted: { $sum: { $cond: [{ $eq: ['$status', 'waitlisted'] }, 1, 0] } },
        refused: { $sum: { $cond: [{ $eq: ['$status', 'refused'] }, 1, 0] } },
        draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
        seriesIds: { $push: '$_id' },
      }},
    ])

    // Get utilization for all series at once
    const allSeriesIds = seriesAgg.flatMap((a: Record<string, unknown>) => (a.seriesIds as string[]) || [])
    const dateAgg = allSeriesIds.length > 0 ? await SlotDate.aggregate([
      { $match: { seriesId: { $in: allSeriesIds } } },
      { $lookup: { from: 'slotSeries', localField: 'seriesId', foreignField: '_id', as: 'series' } },
      { $unwind: '$series' },
      { $group: {
        _id: '$series.airportIata',
        totalDates: { $sum: 1 },
        operated: { $sum: { $cond: [{ $eq: ['$operationStatus', 'operated'] }, 1, 0] } },
        jnus: { $sum: { $cond: [{ $eq: ['$operationStatus', 'jnus'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$operationStatus', 'cancelled'] }, 1, 0] } },
      }},
    ]) : []

    const dateMap = new Map(dateAgg.map((d: Record<string, unknown>) => [d._id as string, d]))

    return seriesAgg.map((a: Record<string, unknown>) => {
      const iata = a._id as string
      const dates = dateMap.get(iata) as Record<string, number> | undefined
      const totalDates = dates?.totalDates ?? 0
      const operated = dates?.operated ?? 0
      const jnusCount = dates?.jnus ?? 0
      const utilizationPct = totalDates > 0 ? Math.round(((operated + jnusCount) / totalDates) * 100) : 0

      return {
        airportIata: iata,
        totalSeries: a.total,
        confirmed: a.confirmed,
        offered: a.offered,
        waitlisted: a.waitlisted,
        refused: a.refused,
        draft: a.draft,
        submitted: a.submitted,
        totalDates,
        operated,
        jnus: jnusCount,
        cancelled: dates?.cancelled ?? 0,
        utilizationPct,
      }
    })
  })

  // ─── GET /slots/series ───
  app.get('/slots/series', async (req) => {
    const { operatorId, airportIata, seasonCode } = seriesQuery.parse(req.query)
    return SlotSeries.find({ operatorId, airportIata, seasonCode })
      .sort({ arrivalFlightNumber: 1 })
      .lean()
  })

  // ─── GET /slots/series/:id ───
  app.get('/slots/series/:id', async (req) => {
    const { id } = req.params as { id: string }
    const doc = await SlotSeries.findById(id).lean()
    if (!doc) return { error: 'Not found' }
    return doc
  })

  // ─── GET /slots/dates ───
  app.get('/slots/dates', async (req) => {
    const { seriesId } = z.object({ seriesId: z.string().min(1) }).parse(req.query)
    return SlotDate.find({ seriesId }).sort({ slotDate: 1 }).lean()
  })

  // ─── GET /slots/messages ───
  app.get('/slots/messages', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, string> = { operatorId: q.operatorId }
    if (q.airportIata) filter.airportIata = q.airportIata
    if (q.seasonCode) filter.seasonCode = q.seasonCode
    if (q.direction) filter.direction = q.direction
    if (q.messageType) filter.messageType = q.messageType
    return SlotMessage.find(filter).sort({ createdAt: -1 }).lean()
  })

  // ─── GET /slots/action-log ───
  app.get('/slots/action-log', async (req) => {
    const { seriesId } = z.object({ seriesId: z.string().min(1) }).parse(req.query)
    return SlotActionLog.find({ seriesId }).sort({ createdAt: -1 }).lean()
  })

  // ─── GET /slots/stats ───
  app.get('/slots/stats', async (req) => {
    const { operatorId, airportIata, seasonCode } = seriesQuery.parse(req.query)
    const seriesList = await SlotSeries.find({ operatorId, airportIata, seasonCode })
      .select('_id status').lean()

    const stats = {
      totalSeries: seriesList.length,
      confirmed: 0, offered: 0, waitlisted: 0, refused: 0, atRisk80: 0,
    }
    for (const s of seriesList) {
      if (s.status === 'confirmed') stats.confirmed++
      else if (s.status === 'offered') stats.offered++
      else if (s.status === 'waitlisted') stats.waitlisted++
      else if (s.status === 'refused') stats.refused++
    }

    // Compute at-risk from utilization
    if (seriesList.length > 0) {
      const seriesIds = seriesList.map(s => s._id)
      const pipeline = [
        { $match: { seriesId: { $in: seriesIds } } },
        { $group: {
          _id: '$seriesId',
          total: { $sum: 1 },
          operated: { $sum: { $cond: [{ $eq: ['$operationStatus', 'operated'] }, 1, 0] } },
          jnus: { $sum: { $cond: [{ $eq: ['$operationStatus', 'jnus'] }, 1, 0] } },
        }},
      ]
      const agg = await SlotDate.aggregate(pipeline)
      for (const row of agg) {
        if (row.total > 0) {
          const pct = Math.round(((row.operated + row.jnus) / row.total) * 100)
          if (pct < 80) stats.atRisk80++
        }
      }
    }

    return stats
  })

  // ─── GET /slots/utilization ───
  app.get('/slots/utilization', async (req) => {
    const { operatorId, airportIata, seasonCode } = seriesQuery.parse(req.query)
    const seriesList = await SlotSeries.find({ operatorId, airportIata, seasonCode })
      .select('_id').lean()

    if (!seriesList.length) return []

    const seriesIds = seriesList.map(s => s._id)
    const pipeline = [
      { $match: { seriesId: { $in: seriesIds } } },
      { $group: {
        _id: '$seriesId',
        total: { $sum: 1 },
        operated: { $sum: { $cond: [{ $eq: ['$operationStatus', 'operated'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$operationStatus', 'cancelled'] }, 1, 0] } },
        jnus: { $sum: { $cond: [{ $eq: ['$operationStatus', 'jnus'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$operationStatus', 'no_show'] }, 1, 0] } },
        scheduled: { $sum: { $cond: [{ $eq: ['$operationStatus', 'scheduled'] }, 1, 0] } },
      }},
    ]
    const agg = await SlotDate.aggregate(pipeline)

    return agg.map((row: Record<string, number | string>) => {
      const total = row.total as number
      const operated = row.operated as number
      const jnus = row.jnus as number
      const pct = total > 0 ? Math.round(((operated + jnus) / total) * 100) : 0
      return {
        seriesId: row._id,
        totalDates: total,
        operated,
        cancelled: row.cancelled,
        jnus,
        noShow: row.noShow,
        scheduled: row.scheduled,
        utilizationPct: pct,
        isAtRisk: pct < 80,
        isClose: pct >= 80 && pct < 85,
      }
    })
  })

  // ─── GET /slots/calendar ───
  app.get('/slots/calendar', async (req) => {
    const { operatorId, airportIata, seasonCode } = seriesQuery.parse(req.query)
    const seriesList = await SlotSeries.find({ operatorId, airportIata, seasonCode })
      .select('_id').lean()

    if (!seriesList.length) return {}

    const seriesIds = seriesList.map(s => s._id)
    const allDates = await SlotDate.find({ seriesId: { $in: seriesIds } })
      .select('seriesId slotDate operationStatus').sort({ slotDate: 1 }).lean()

    const result: Record<string, Array<{ weekNumber: number; operated: number; cancelled: number; jnus: number; total: number }>> = {}

    for (const seriesId of seriesIds) {
      const dates = allDates.filter(d => d.seriesId === seriesId)
      const weekMap = new Map<number, { weekNumber: number; operated: number; cancelled: number; jnus: number; total: number }>()

      for (const d of dates) {
        const wk = getISOWeek(new Date(d.slotDate))
        const entry = weekMap.get(wk) || { weekNumber: wk, operated: 0, cancelled: 0, jnus: 0, total: 0 }
        entry.total++
        if (d.operationStatus === 'operated') entry.operated++
        else if (d.operationStatus === 'cancelled' || d.operationStatus === 'no_show') entry.cancelled++
        else if (d.operationStatus === 'jnus') entry.jnus++
        weekMap.set(wk, entry)
      }

      result[seriesId] = Array.from(weekMap.values()).sort((a, b) => a.weekNumber - b.weekNumber)
    }

    return result
  })

  // ─── GET /slots/scheduled-flights ───
  app.get('/slots/scheduled-flights', async (req) => {
    const q = z.object({ operatorId: z.string().min(1), airportIata: z.string().min(3) }).parse(req.query)

    const [arrivals, departures] = await Promise.all([
      ScheduledFlight.find({
        operatorId: q.operatorId,
        arrStation: q.airportIata,
        status: { $in: ['draft', 'active'] },
      }).sort({ flightNumber: 1 }).lean(),
      ScheduledFlight.find({
        operatorId: q.operatorId,
        depStation: q.airportIata,
        status: { $in: ['draft', 'active'] },
      }).sort({ flightNumber: 1 }).lean(),
    ])

    const result = []
    for (const row of arrivals) {
      result.push({
        id: row._id,
        airlineCode: row.airlineCode,
        flightNumber: row.flightNumber,
        depStation: row.depStation,
        arrStation: row.arrStation,
        stdUtc: row.stdUtc,
        staUtc: row.staUtc,
        daysOfOperation: row.daysOfWeek,
        periodStart: row.effectiveFrom,
        periodEnd: row.effectiveUntil,
        aircraftTypeIcao: row.aircraftTypeIcao,
        status: row.status,
        direction: 'arrival',
      })
    }
    for (const row of departures) {
      result.push({
        id: row._id,
        airlineCode: row.airlineCode,
        flightNumber: row.flightNumber,
        depStation: row.depStation,
        arrStation: row.arrStation,
        stdUtc: row.stdUtc,
        staUtc: row.staUtc,
        daysOfOperation: row.daysOfWeek,
        periodStart: row.effectiveFrom,
        periodEnd: row.effectiveUntil,
        aircraftTypeIcao: row.aircraftTypeIcao,
        status: row.status,
        direction: 'departure',
      })
    }
    return result
  })

  // ─── POST /slots/series ───
  app.post('/slots/series', async (req) => {
    const data = seriesCreateSchema.parse(req.body)
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    await SlotSeries.create({
      _id: id,
      ...data,
      createdAt: now,
      updatedAt: now,
    })

    // Expand to individual dates
    const dates = expandSeriesToDates(
      id,
      new Date(data.periodStart),
      new Date(data.periodEnd),
      data.daysOfOperation,
      data.frequencyRate,
    )

    if (dates.length > 0) {
      await SlotDate.insertMany(dates)
    }

    return { id, datesCreated: dates.length }
  })

  // ─── PATCH /slots/series/:id ───
  app.patch('/slots/series/:id', async (req) => {
    const { id } = req.params as { id: string }
    const data = seriesCreateSchema.partial().parse(req.body)

    const needsReExpand = data.periodStart || data.periodEnd ||
      data.daysOfOperation || data.frequencyRate

    await SlotSeries.updateOne({ _id: id }, {
      $set: { ...data, updatedAt: new Date().toISOString() },
    })

    if (needsReExpand) {
      const updated = await SlotSeries.findById(id).lean()
      if (updated) {
        await SlotDate.deleteMany({ seriesId: id })
        const dates = expandSeriesToDates(
          id,
          new Date(updated.periodStart),
          new Date(updated.periodEnd),
          updated.daysOfOperation,
          updated.frequencyRate,
        )
        if (dates.length > 0) {
          await SlotDate.insertMany(dates)
        }
      }
    }

    return { ok: true }
  })

  // ─── DELETE /slots/series/:id ───
  app.delete('/slots/series/:id', async (req) => {
    const { id } = req.params as { id: string }
    await Promise.all([
      SlotSeries.deleteOne({ _id: id }),
      SlotDate.deleteMany({ seriesId: id }),
      SlotActionLog.deleteMany({ seriesId: id }),
    ])
    return { ok: true }
  })

  // ─── PATCH /slots/dates/:id ───
  app.patch('/slots/dates/:id', async (req) => {
    const { id } = req.params as { id: string }
    const data = dateStatusSchema.parse(req.body)

    const update: Record<string, unknown> = { operationStatus: data.operationStatus }
    if (data.operationStatus === 'jnus' && data.jnusReason) {
      update.jnusReason = data.jnusReason
    } else {
      update.jnusReason = null
    }

    await SlotDate.updateOne({ _id: id }, { $set: update })
    return { ok: true }
  })

  // ─── PATCH /slots/dates/bulk ───
  app.patch('/slots/dates/bulk', async (req) => {
    const data = bulkDateSchema.parse(req.body)

    const update: Record<string, unknown> = { operationStatus: data.operationStatus }
    if (data.operationStatus === 'jnus' && data.jnusReason) {
      update.jnusReason = data.jnusReason
    } else {
      update.jnusReason = null
    }

    const result = await SlotDate.updateMany(
      {
        seriesId: data.seriesId,
        slotDate: { $gte: data.dateRangeStart, $lte: data.dateRangeEnd },
      },
      { $set: update },
    )
    return { updated: result.modifiedCount }
  })

  // ─── POST /slots/messages ───
  app.post('/slots/messages', async (req) => {
    const data = messageCreateSchema.parse(req.body)
    const id = crypto.randomUUID()
    await SlotMessage.create({
      _id: id,
      ...data,
      createdAt: new Date().toISOString(),
    })
    return { id }
  })

  // ─── POST /slots/action-log ───
  app.post('/slots/action-log', async (req) => {
    const data = actionLogSchema.parse(req.body)
    const id = crypto.randomUUID()
    await SlotActionLog.create({
      _id: id,
      ...data,
      createdAt: new Date().toISOString(),
    })

    // Update last action code on the series
    const updateField = data.actionSource === 'airline'
      ? { lastActionCode: data.actionCode }
      : { lastCoordinatorCode: data.actionCode }
    await SlotSeries.updateOne(
      { _id: data.seriesId },
      { $set: { ...updateField, updatedAt: new Date().toISOString() } },
    )

    return { id }
  })

  // ─── POST /slots/import-from-schedule ───
  app.post('/slots/import-from-schedule', async (req) => {
    const { operatorId, airportIata, seasonCode } = seriesQuery.parse(req.body)

    // Get flights at this airport
    const [arrivals, departures] = await Promise.all([
      ScheduledFlight.find({
        operatorId, arrStation: airportIata,
        status: { $in: ['draft', 'active'] },
      }).lean(),
      ScheduledFlight.find({
        operatorId, depStation: airportIata,
        status: { $in: ['draft', 'active'] },
      }).lean(),
    ])

    if (!arrivals.length && !departures.length) return { created: 0, skipped: 0 }

    // Check existing
    const existing = await SlotSeries.find({ operatorId, airportIata, seasonCode })
      .select('arrivalFlightNumber departureFlightNumber').lean()
    const existingFlights = new Set(
      existing.flatMap(s => [s.arrivalFlightNumber, s.departureFlightNumber].filter(Boolean))
    )

    // Build departure lookup
    const depByNumber = new Map<string, typeof departures[0]>()
    for (const d of departures) depByNumber.set(d.flightNumber, d)

    let created = 0
    let skipped = 0
    const now = new Date().toISOString()

    for (const arr of arrivals) {
      const flightKey = `${arr.airlineCode}${arr.flightNumber}`
      if (existingFlights.has(flightKey)) { skipped++; continue }

      // Try to pair: same airline code, flight number ±1
      const fNum = parseInt(arr.flightNumber, 10)
      const dep = !isNaN(fNum)
        ? (depByNumber.get(String(fNum + 1)) || depByNumber.get(String(fNum - 1)))
        : null

      const arrTime = parseTimeToHHMM(arr.staUtc)
      const depTime = dep ? parseTimeToHHMM(dep.stdUtc) : null

      const id = crypto.randomUUID()
      await SlotSeries.create({
        _id: id, operatorId, airportIata, seasonCode,
        arrivalFlightNumber: flightKey,
        departureFlightNumber: dep ? `${dep.airlineCode}${dep.flightNumber}` : null,
        arrivalOriginIata: arr.depStation,
        departureDestIata: dep?.arrStation || null,
        requestedArrivalTime: arrTime,
        requestedDepartureTime: depTime,
        overnightIndicator: 0,
        periodStart: arr.effectiveFrom,
        periodEnd: arr.effectiveUntil,
        daysOfOperation: arr.daysOfWeek || '1234567',
        frequencyRate: 1,
        aircraftTypeIcao: arr.aircraftTypeIcao,
        arrivalServiceType: 'J', departureServiceType: 'J',
        status: 'draft', priorityCategory: 'new',
        linkedScheduledFlightId: arr._id,
        createdAt: now, updatedAt: now,
      })

      const dates = expandSeriesToDates(id, new Date(arr.effectiveFrom), new Date(arr.effectiveUntil), arr.daysOfWeek || '1234567', 1)
      if (dates.length) await SlotDate.insertMany(dates)

      created++
      if (dep) depByNumber.delete(dep.flightNumber)
    }

    // Handle remaining unpaired departures
    for (const [, dep] of depByNumber) {
      const flightKey = `${dep.airlineCode}${dep.flightNumber}`
      if (existingFlights.has(flightKey)) { skipped++; continue }

      const id = crypto.randomUUID()
      await SlotSeries.create({
        _id: id, operatorId, airportIata, seasonCode,
        departureFlightNumber: flightKey,
        departureDestIata: dep.arrStation,
        requestedDepartureTime: parseTimeToHHMM(dep.stdUtc),
        overnightIndicator: 0,
        periodStart: dep.effectiveFrom,
        periodEnd: dep.effectiveUntil,
        daysOfOperation: dep.daysOfWeek || '1234567',
        frequencyRate: 1,
        aircraftTypeIcao: dep.aircraftTypeIcao,
        arrivalServiceType: 'J', departureServiceType: 'J',
        status: 'draft', priorityCategory: 'new',
        linkedScheduledFlightId: dep._id,
        createdAt: now, updatedAt: now,
      })

      const dates = expandSeriesToDates(id, new Date(dep.effectiveFrom), new Date(dep.effectiveUntil), dep.daysOfWeek || '1234567', 1)
      if (dates.length) await SlotDate.insertMany(dates)

      created++
    }

    return { created, skipped }
  })

  // ─── POST /slots/sync-from-instances ───
  app.post('/slots/sync-from-instances', async (req) => {
    const { operatorId, airportIata, seasonCode } = seriesQuery.parse(req.body)

    const seriesList = await SlotSeries.find({ operatorId, airportIata, seasonCode })
      .select('_id arrivalFlightNumber departureFlightNumber').lean()

    if (!seriesList.length) return { synced: 0, errors: 0 }

    let synced = 0
    let errors = 0

    for (const series of seriesList) {
      const slotDates = await SlotDate.find({ seriesId: series._id }).lean()
      if (!slotDates.length) continue

      const flightNumbers = [series.arrivalFlightNumber, series.departureFlightNumber].filter(Boolean) as string[]
      if (!flightNumbers.length) continue

      // Extract just the numeric part for matching against FlightInstance.flightNumber
      const instances = await FlightInstance.find({
        operatorId,
        flightNumber: { $in: flightNumbers },
      }).select('flightNumber operatingDate status').lean()

      if (!instances.length) continue

      const statusByDate = new Map<string, string>()
      for (const inst of instances) {
        const dateKey = inst.operatingDate
        const current = statusByDate.get(dateKey)
        if (!current || inst.status === 'completed' || inst.status === 'arrived' ||
            (inst.status === 'cancelled' && current === 'scheduled')) {
          statusByDate.set(dateKey, inst.status)
        }
      }

      for (const sd of slotDates) {
        if (sd.operationStatus === 'jnus') continue

        const instanceStatus = statusByDate.get(sd.slotDate)
        if (!instanceStatus) continue

        let newStatus: string = 'scheduled'
        if (['completed', 'arrived', 'departed', 'onTime', 'delayed'].includes(instanceStatus)) newStatus = 'operated'
        else if (instanceStatus === 'cancelled') newStatus = 'cancelled'

        if (sd.operationStatus === newStatus) continue

        try {
          await SlotDate.updateOne({ _id: sd._id }, { $set: { operationStatus: newStatus } })
          synced++
        } catch {
          errors++
        }
      }
    }

    return { synced, errors }
  })
}
