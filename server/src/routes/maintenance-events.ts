import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { MaintenanceEvent } from '../models/MaintenanceEvent.js'
import { MaintenanceCheckType } from '../models/MaintenanceCheckType.js'
import { MaintenanceWindow } from '../models/MaintenanceWindow.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { AircraftCheckStatus } from '../models/AircraftCheckStatus.js'
import { AircraftCumulative } from '../models/AircraftCumulative.js'
import { AircraftCheckInterval } from '../models/AircraftCheckInterval.js'
import { FlightInstance } from '../models/FlightInstance.js'

// ── Constants ──

const LINE_CHECK_CODES = new Set(['TR', 'DY', 'WK'])

// ── Zod schemas ──

const eventCreateSchema = z
  .object({
    operatorId: z.string().min(1),
    aircraftId: z.string().min(1),
    checkTypeId: z.string().min(1),
    plannedStartUtc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    plannedEndUtc: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    station: z.string().min(1).max(4),
    hangar: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()

const eventUpdateSchema = z
  .object({
    plannedStartUtc: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    plannedEndUtc: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    actualStartUtc: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    actualEndUtc: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    station: z.string().min(1).max(4).optional(),
    hangar: z.string().nullable().optional(),
    status: z.enum(['planned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'deferred']).optional(),
    phase: z.enum(['planned', 'arrived', 'inducted', 'in_work', 'qa', 'released', 'return_to_flight']).optional(),
    source: z.enum(['manual', 'auto_proposed', 'amos_sync']).optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()

const forecastSchema = z
  .object({
    operatorId: z.string().min(1),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()

// ── Routes ──

export async function maintenanceEventRoutes(app: FastifyInstance): Promise<void> {
  // ────────────────────────────────────────────────
  // FILTER OPTIONS (dropdown values for the UI)
  // ────────────────────────────────────────────────
  app.get('/maintenance-events/filter-options', async (req) => {
    const q = req.query as Record<string, string>
    const operatorId = q.operatorId || ''
    const filter: Record<string, unknown> = {}
    if (operatorId) filter.operatorId = operatorId

    const [acTypes, regs, checkTypes] = await Promise.all([
      AircraftType.find(filter).select('_id icaoType name color').sort({ icaoType: 1 }).lean(),
      AircraftRegistration.find({ ...filter, isActive: true })
        .select('homeBaseIcao')
        .lean(),
      MaintenanceCheckType.find({ ...filter, isActive: true })
        .select('_id code name')
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
    ])

    // Deduplicate bases
    const basesSet = new Map<string, boolean>()
    for (const r of regs) {
      if (r.homeBaseIcao) basesSet.set(r.homeBaseIcao, true)
    }

    return {
      aircraftTypes: acTypes.map((t) => ({ id: t._id, icaoType: t.icaoType, name: t.name })),
      bases: Array.from(basesSet.keys())
        .sort()
        .map((b) => ({ icao: b })),
      checkTypes: checkTypes.map((c) => ({ id: c._id, code: c.code, name: c.name })),
    }
  })

  // ────────────────────────────────────────────────
  // LIST EVENTS (Gantt view with joined data)
  // ────────────────────────────────────────────────
  app.get('/maintenance-events', async (req) => {
    const q = req.query as Record<string, string>
    const operatorId = q.operatorId || ''
    if (!operatorId) return { rows: [], stats: { total: 0, proposed: 0, planned: 0, confirmed: 0, inProgress: 0 } }

    const dateFrom = q.dateFrom || ''
    const dateTo = q.dateTo || ''

    // 1. Fetch all active aircraft
    const acFilter: Record<string, unknown> = { operatorId, isActive: true }
    if (q.aircraftTypeId) acFilter.aircraftTypeId = q.aircraftTypeId
    if (q.base) acFilter.homeBaseIcao = q.base

    const aircraft = await AircraftRegistration.find(acFilter)
      .select('_id registration aircraftTypeId homeBaseIcao')
      .sort({ registration: 1 })
      .lean()

    if (aircraft.length === 0) {
      return { rows: [], stats: { total: 0, proposed: 0, planned: 0, confirmed: 0, inProgress: 0 } }
    }

    const aircraftIds = aircraft.map((a) => a._id)
    const acTypeIds = [...new Set(aircraft.map((a) => a.aircraftTypeId))]

    // 2. Fetch aircraft types for colors + icao
    const acTypes = await AircraftType.find({ _id: { $in: acTypeIds } })
      .select('_id icaoType color')
      .lean()
    const acTypeMap = new Map(acTypes.map((t) => [t._id, t]))

    // 3. Fetch check types
    const checkTypes = await MaintenanceCheckType.find({ operatorId, isActive: true }).lean()
    const ctMap = new Map(checkTypes.map((c) => [c._id, c]))

    // 4. Fetch events in date range
    const evFilter: Record<string, unknown> = {
      operatorId,
      aircraftId: { $in: aircraftIds },
      status: { $ne: 'cancelled' },
    }
    if (dateFrom && dateTo) {
      evFilter.plannedStartUtc = { $lte: dateTo }
      evFilter.$or = [{ plannedEndUtc: { $gte: dateFrom } }, { plannedEndUtc: null }]
    }
    if (q.checkTypeId) evFilter.checkTypeId = q.checkTypeId
    if (q.status) {
      if (q.status === 'proposed') {
        evFilter.source = 'auto_proposed'
        evFilter.status = 'planned'
      } else {
        evFilter.status = q.status
      }
    }

    const events = await MaintenanceEvent.find(evFilter).lean()

    // 5. Fetch forecast markers
    const checkStatuses = await AircraftCheckStatus.find({
      operatorId,
      aircraftId: { $in: aircraftIds },
      forecastDueDate: { $ne: null },
    }).lean()

    // Build events by aircraft
    const eventsByAc = new Map<string, typeof events>()
    for (const ev of events) {
      const list = eventsByAc.get(ev.aircraftId) || []
      list.push(ev)
      eventsByAc.set(ev.aircraftId, list)
    }

    // Build forecast markers by aircraft
    const forecastsByAc = new Map<string, typeof checkStatuses>()
    for (const cs of checkStatuses) {
      if (!cs.forecastDueDate) continue
      if (dateFrom && cs.forecastDueDate < dateFrom) continue
      if (dateTo && cs.forecastDueDate > dateTo) continue
      const list = forecastsByAc.get(cs.aircraftId) || []
      list.push(cs)
      forecastsByAc.set(cs.aircraftId, list)
    }

    // Build rows
    const rows = aircraft.map((ac) => {
      const acType = acTypeMap.get(ac.aircraftTypeId)
      const acEvents = (eventsByAc.get(ac._id) || []).map((ev) => {
        const ct = ctMap.get(ev.checkTypeId)
        return {
          id: ev._id,
          aircraftId: ev.aircraftId,
          registration: ac.registration,
          icaoType: acType?.icaoType || '',
          base: ac.homeBaseIcao || '',
          checkTypeId: ev.checkTypeId,
          checkCode: ct?.code || '?',
          checkName: ct?.name || 'Check',
          checkColor: ct?.color || '#6b7280',
          plannedStart: ev.plannedStartUtc,
          plannedEnd: ev.plannedEndUtc,
          actualStart: ev.actualStartUtc,
          actualEnd: ev.actualEndUtc,
          station: ev.station,
          hangar: ev.hangar,
          status: ev.source === 'auto_proposed' && ev.status === 'planned' ? 'proposed' : ev.status,
          phase: ev.phase,
          source: ev.source,
          notes: ev.notes,
        }
      })

      const acForecasts = (forecastsByAc.get(ac._id) || []).map((cs) => {
        const ct = ctMap.get(cs.checkTypeId)
        const trigger = (cs.forecastDueTrigger || 'calendar') as 'hours' | 'cycles' | 'calendar'
        return {
          checkCode: ct?.code || '?',
          checkName: ct?.name || 'Check',
          trigger,
          dueDate: cs.forecastDueDate!,
          remaining:
            trigger === 'hours'
              ? (cs.remainingHours ?? 0)
              : trigger === 'cycles'
                ? (cs.remainingCycles ?? 0)
                : (cs.remainingDays ?? 0),
          tier: 2 as const,
        }
      })

      return {
        aircraftId: ac._id,
        registration: ac.registration,
        icaoType: acType?.icaoType || '',
        acTypeColor: acType?.color || '',
        base: ac.homeBaseIcao || '',
        events: acEvents,
        forecasts: acForecasts,
      }
    })

    // Sort: aircraft with events/forecasts first
    const sortBy = q.sortBy || 'registration'
    rows.sort((a, b) => {
      const aHas = a.events.length + a.forecasts.length
      const bHas = b.events.length + b.forecasts.length
      if (aHas > 0 && bHas === 0) return -1
      if (aHas === 0 && bHas > 0) return 1
      if (sortBy === 'next_event') {
        const aNext = a.events[0]?.plannedStart || '9999'
        const bNext = b.events[0]?.plannedStart || '9999'
        return aNext.localeCompare(bNext)
      }
      return a.registration.localeCompare(b.registration)
    })

    // Stats
    const allEvents = rows.flatMap((r) => r.events)
    const stats = {
      total: allEvents.length,
      proposed: allEvents.filter((e) => e.status === 'proposed').length,
      planned: allEvents.filter((e) => e.status === 'planned').length,
      confirmed: allEvents.filter((e) => e.status === 'confirmed').length,
      inProgress: allEvents.filter((e) => e.status === 'in_progress').length,
    }

    return { rows, stats }
  })

  // ────────────────────────────────────────────────
  // GET SINGLE EVENT DETAIL (enriched)
  // ────────────────────────────────────────────────
  app.get('/maintenance-events/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const ev = await MaintenanceEvent.findById(id).lean()
    if (!ev) return reply.code(404).send({ error: 'Event not found' })

    const operatorId = ev.operatorId

    // Fetch related data in parallel
    const [ac, ct, cs, cum, interval] = await Promise.all([
      AircraftRegistration.findById(ev.aircraftId).select('registration aircraftTypeId homeBaseIcao').lean(),
      MaintenanceCheckType.findById(ev.checkTypeId).lean(),
      AircraftCheckStatus.findOne({ operatorId, aircraftId: ev.aircraftId, checkTypeId: ev.checkTypeId }).lean(),
      AircraftCumulative.findOne({ operatorId, aircraftId: ev.aircraftId }).lean(),
      AircraftCheckInterval.findOne({ operatorId, aircraftId: ev.aircraftId, checkTypeId: ev.checkTypeId }).lean(),
    ])

    const hoursLimit = interval?.hoursInterval ?? ct?.defaultHoursInterval ?? 0
    const cyclesLimit = interval?.cyclesInterval ?? ct?.defaultCyclesInterval ?? 0
    const daysLimit = interval?.daysInterval ?? ct?.defaultDaysInterval ?? 0

    const totalHours = cum?.totalFlightHours ?? 0
    const totalCycles = cum?.totalCycles ?? 0
    const lastCheckHours = cs?.lastCheckHours ?? 0
    const lastCheckCycles = cs?.lastCheckCycles ?? 0
    const lastCheckDate = cs?.lastCheckDate

    const hoursUsed = totalHours - lastCheckHours
    const cyclesUsed = totalCycles - lastCheckCycles
    const daysUsed = lastCheckDate ? Math.floor((Date.now() - new Date(lastCheckDate).getTime()) / 86400000) : 0

    const remH = hoursLimit > 0 ? Math.max(0, hoursLimit - hoursUsed) : null
    const remC = cyclesLimit > 0 ? Math.max(0, cyclesLimit - cyclesUsed) : null
    const remD = daysLimit > 0 ? Math.max(0, daysLimit - daysUsed) : null

    // Determine trigger axis
    const axes: { axis: string; remaining: number }[] = []
    if (remH != null) axes.push({ axis: 'hours', remaining: remH })
    if (remC != null) axes.push({ axis: 'cycles', remaining: remC })
    if (remD != null) axes.push({ axis: 'calendar', remaining: remD })
    axes.sort((a, b) => a.remaining - b.remaining)

    let acType = null
    if (ac?.aircraftTypeId) {
      acType = await AircraftType.findById(ac.aircraftTypeId).select('icaoType').lean()
    }

    return {
      event: {
        id: ev._id,
        aircraftId: ev.aircraftId,
        registration: ac?.registration || '',
        icaoType: acType?.icaoType || '',
        base: ac?.homeBaseIcao || '',
        checkTypeId: ev.checkTypeId,
        checkCode: ct?.code || '?',
        checkName: ct?.name || 'Check',
        checkColor: ct?.color || '#6b7280',
        plannedStart: ev.plannedStartUtc,
        plannedEnd: ev.plannedEndUtc,
        actualStart: ev.actualStartUtc,
        actualEnd: ev.actualEndUtc,
        station: ev.station,
        hangar: ev.hangar,
        status: ev.source === 'auto_proposed' && ev.status === 'planned' ? 'proposed' : ev.status,
        phase: ev.phase,
        source: ev.source,
        notes: ev.notes,
      },
      forecast: {
        triggerAxis: axes[0]?.axis || 'calendar',
        remainingHours: remH,
        remainingCycles: remC,
        remainingDays: remD,
        hoursUsed: Math.round(hoursUsed * 10) / 10,
        hoursLimit,
        cyclesUsed: Math.round(cyclesUsed),
        cyclesLimit,
        daysUsed,
        daysLimit,
        bufferDays: remD ?? 0,
      },
    }
  })

  // ────────────────────────────────────────────────
  // CREATE EVENT
  // ────────────────────────────────────────────────
  app.post('/maintenance-events', async (req, reply) => {
    const raw = req.body as Record<string, unknown>
    if (raw.station) raw.station = (raw.station as string).toUpperCase()
    const parsed = eventCreateSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }

    // Auto-compute end date from check type duration if not provided
    let endDate = parsed.data.plannedEndUtc ?? null
    if (!endDate) {
      const ct = await MaintenanceCheckType.findById(parsed.data.checkTypeId).select('defaultDurationHours').lean()
      if (ct?.defaultDurationHours) {
        const durationDays = Math.max(1, Math.ceil(ct.defaultDurationHours / 24))
        const start = new Date(parsed.data.plannedStartUtc)
        start.setDate(start.getDate() + durationDays)
        endDate = start.toISOString().slice(0, 10)
      }
    }

    const id = crypto.randomUUID()
    const doc = await MaintenanceEvent.create({
      _id: id,
      operatorId: parsed.data.operatorId,
      aircraftId: parsed.data.aircraftId,
      checkTypeId: parsed.data.checkTypeId,
      plannedStartUtc: parsed.data.plannedStartUtc,
      plannedEndUtc: endDate,
      station: parsed.data.station,
      hangar: parsed.data.hangar ?? null,
      status: 'planned',
      phase: 'planned',
      source: 'manual',
      notes: parsed.data.notes ?? null,
      createdAt: new Date().toISOString(),
    })

    return reply.code(201).send(doc.toObject())
  })

  // ────────────────────────────────────────────────
  // UPDATE EVENT
  // ────────────────────────────────────────────────
  app.patch('/maintenance-events/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const raw = req.body as Record<string, unknown>
    if (raw.station) raw.station = (raw.station as string).toUpperCase()
    const parsed = eventUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }
    const doc = await MaintenanceEvent.findByIdAndUpdate(
      id,
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Event not found' })
    return doc
  })

  // ────────────────────────────────────────────────
  // DELETE EVENT
  // ────────────────────────────────────────────────
  app.delete('/maintenance-events/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await MaintenanceEvent.findByIdAndDelete(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Event not found' })
    return { ok: true }
  })

  // ────────────────────────────────────────────────
  // ACCEPT ALL PROPOSED EVENTS
  // ────────────────────────────────────────────────
  app.post('/maintenance-events/accept-all', async (req) => {
    const { operatorId } = req.body as { operatorId: string }
    if (!operatorId) return { count: 0 }

    const result = await MaintenanceEvent.updateMany(
      { operatorId, source: 'auto_proposed', status: 'planned' },
      { $set: { source: 'manual', updatedAt: new Date().toISOString() } },
    )
    return { count: result.modifiedCount }
  })

  // ────────────────────────────────────────────────
  // REJECT ALL PROPOSED EVENTS
  // ────────────────────────────────────────────────
  app.post('/maintenance-events/reject-all', async (req) => {
    const { operatorId } = req.body as { operatorId: string }
    if (!operatorId) return { count: 0 }

    const result = await MaintenanceEvent.deleteMany({
      operatorId,
      source: 'auto_proposed',
      status: 'planned',
    })
    return { count: result.deletedCount }
  })

  // ────────────────────────────────────────────────
  // RUN FORECAST ENGINE
  // ────────────────────────────────────────────────
  app.post('/maintenance-events/forecast', async (req, reply) => {
    const parsed = forecastSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
    }

    const { operatorId, dateFrom, dateTo } = parsed.data

    // 1. Get all active aircraft
    const aircraft = await AircraftRegistration.find({ operatorId, isActive: true })
      .select('_id registration homeBaseIcao')
      .lean()
    if (aircraft.length === 0) return { totalAircraftAnalyzed: 0, totalProposedEvents: 0 }

    const aircraftIds = aircraft.map((a) => a._id)

    // 2. Get check types (skip line checks)
    const allCheckTypes = await MaintenanceCheckType.find({ operatorId, isActive: true }).lean()
    const significantChecks = allCheckTypes.filter((ct) => !LINE_CHECK_CODES.has(ct.code))
    if (significantChecks.length === 0) return { totalAircraftAnalyzed: aircraft.length, totalProposedEvents: 0 }

    // 3. Get maintenance windows per base
    const windows = await MaintenanceWindow.find({ operatorId }).lean()
    const windowMap = new Map(
      windows.map((w) => [
        w.base,
        {
          startUtc: w.windowStartUtc?.slice(0, 5) || '22:00',
          endUtc: w.windowEndUtc?.slice(0, 5) || '05:00',
          durationHours: w.windowDurationHours ?? 7,
        },
      ]),
    )

    // 4. Batch fetch all supporting data
    const [cumDocs, csDocs, ovDocs, existingDocs] = await Promise.all([
      AircraftCumulative.find({ operatorId, aircraftId: { $in: aircraftIds } }).lean(),
      AircraftCheckStatus.find({ operatorId, aircraftId: { $in: aircraftIds } }).lean(),
      AircraftCheckInterval.find({ operatorId, aircraftId: { $in: aircraftIds } }).lean(),
      MaintenanceEvent.find({
        operatorId,
        aircraftId: { $in: aircraftIds },
        status: { $in: ['planned', 'confirmed', 'in_progress'] },
      })
        .select('aircraftId checkTypeId')
        .lean(),
    ])

    const cumMap = new Map(cumDocs.map((c) => [c.aircraftId, c]))
    const csMap = new Map<string, (typeof csDocs)[0][]>()
    for (const cs of csDocs) {
      const list = csMap.get(cs.aircraftId) || []
      list.push(cs)
      csMap.set(cs.aircraftId, list)
    }
    const ovMap = new Map<string, (typeof ovDocs)[0][]>()
    for (const ov of ovDocs) {
      const list = ovMap.get(ov.aircraftId) || []
      list.push(ov)
      ovMap.set(ov.aircraftId, list)
    }
    const existingEventKeys = new Set(existingDocs.map((e) => `${e.aircraftId}:${e.checkTypeId}`))

    // 5. Batch fetch flights for Tier 1 (optional — may not have tail assignments)
    const flightsByAc = new Map<string, { flightDate: string; blockMinutes: number; arrivalIcao: string }[]>()
    try {
      const flights = await FlightInstance.find({
        operatorId,
        aircraftRegistrationId: { $in: aircraftIds },
        operatingDateUtc: { $gte: dateFrom, $lte: dateTo },
        status: { $ne: 'cancelled' },
      })
        .select('aircraftRegistrationId operatingDateUtc blockMinutes arrivalIcao')
        .sort({ aircraftRegistrationId: 1, operatingDateUtc: 1 })
        .lean()

      for (const f of flights) {
        const acId = (f as Record<string, unknown>).aircraftRegistrationId as string
        const list = flightsByAc.get(acId) || []
        list.push({
          flightDate: ((f as Record<string, unknown>).operatingDateUtc as string)?.slice(0, 10) || '',
          blockMinutes: ((f as Record<string, unknown>).blockMinutes as number) || 0,
          arrivalIcao: ((f as Record<string, unknown>).arrivalIcao as string) || '',
        })
        flightsByAc.set(acId, list)
      }
    } catch {
      // FlightInstance may not have tail assignments yet
    }

    // 6. Process each aircraft
    const proposedEvents: Record<string, unknown>[] = []
    const forecastUpdates: {
      aircraftId: string
      checkTypeId: string
      dueDate: string
      trigger: string
      remH: number | null
      remC: number | null
      remD: number | null
    }[] = []

    for (const ac of aircraft) {
      const cum = cumMap.get(ac._id)
      const totalHours = cum?.totalFlightHours ?? 0
      const totalCycles = cum?.totalCycles ?? 0
      const avgH = cum?.avgDailyFlightHours || 6
      const avgC = cum?.avgDailyCycles || 3
      const acChecks = csMap.get(ac._id) || []
      const acOverrides = ovMap.get(ac._id) || []
      const homeBase = ac.homeBaseIcao || ''
      const assignedFlights = flightsByAc.get(ac._id) || []
      const useTier1 = assignedFlights.length > 0

      // Phase 1: Compute trigger dates
      interface Candidate {
        ct: (typeof significantChecks)[0]
        triggerDate: string
        triggerAxis: 'hours' | 'cycles' | 'calendar'
        triggerRemaining: number
        remH: number | null
        remC: number | null
        remD: number | null
        durationHours: number
      }
      const candidates: Candidate[] = []

      for (const ct of significantChecks) {
        if (existingEventKeys.has(`${ac._id}:${ct._id}`)) continue

        const cs = acChecks.find((s) => s.checkTypeId === ct._id)
        const ov = acOverrides.find((o) => o.checkTypeId === ct._id)

        const hoursInterval = ov?.hoursInterval ?? ct.defaultHoursInterval
        const cyclesInterval = ov?.cyclesInterval ?? ct.defaultCyclesInterval
        const daysInterval = ov?.daysInterval ?? ct.defaultDaysInterval
        const durationHours = ov?.durationHours ?? ct.defaultDurationHours ?? 24

        const lastCheckHours = cs?.lastCheckHours ?? 0
        const lastCheckCycles = cs?.lastCheckCycles ?? 0
        const lastCheckDate = cs?.lastCheckDate

        // Remaining on each axis
        const remH = hoursInterval ? Math.max(0, hoursInterval - (totalHours - lastCheckHours)) : null
        const remC = cyclesInterval ? Math.max(0, cyclesInterval - (totalCycles - lastCheckCycles)) : null
        const remD =
          daysInterval && lastCheckDate
            ? Math.max(0, daysInterval - Math.floor((Date.now() - new Date(lastCheckDate).getTime()) / 86400000))
            : null

        let triggerDate: string | null = null
        let triggerAxis: 'hours' | 'cycles' | 'calendar' = 'calendar'
        let triggerRemaining = 0

        // Tier 1: flight-by-flight simulation
        if (useTier1 && remH != null && hoursInterval) {
          let runningHours = totalHours
          for (const f of assignedFlights) {
            runningHours += (f.blockMinutes || 0) / 60
            if (runningHours - lastCheckHours >= hoursInterval) {
              triggerDate = f.flightDate
              triggerAxis = 'hours'
              triggerRemaining = Math.max(0, hoursInterval - (runningHours - lastCheckHours))
              break
            }
          }
        }

        // Tier 2: average utilization
        if (!triggerDate) {
          const today = new Date()
          const cands: { date: Date; axis: 'hours' | 'cycles' | 'calendar'; rem: number }[] = []
          if (remH != null && avgH > 0) {
            const d = new Date(today)
            d.setDate(d.getDate() + Math.ceil(remH / avgH))
            cands.push({ date: d, axis: 'hours', rem: remH })
          }
          if (remC != null && avgC > 0) {
            const d = new Date(today)
            d.setDate(d.getDate() + Math.ceil(remC / avgC))
            cands.push({ date: d, axis: 'cycles', rem: remC })
          }
          if (remD != null && lastCheckDate) {
            const d = new Date(lastCheckDate)
            d.setDate(d.getDate() + daysInterval!)
            cands.push({ date: d, axis: 'calendar', rem: remD })
          }
          cands.sort((a, b) => a.date.getTime() - b.date.getTime())
          if (cands.length > 0) {
            triggerDate = cands[0].date.toISOString().slice(0, 10)
            triggerAxis = cands[0].axis
            triggerRemaining = cands[0].rem
          }
        }

        if (!triggerDate) continue

        // Always update forecast
        forecastUpdates.push({
          aircraftId: ac._id,
          checkTypeId: ct._id,
          dueDate: triggerDate,
          trigger: triggerAxis,
          remH,
          remC,
          remD,
        })

        // Only propose if within range
        if (triggerDate <= dateTo && triggerDate >= dateFrom) {
          candidates.push({ ct, triggerDate, triggerAxis, triggerRemaining, remH, remC, remD, durationHours })
        }
      }

      // Phase 2: Cascade-aware dedup (heaviest first)
      candidates.sort((a, b) => (b.ct.sortOrder ?? 0) - (a.ct.sortOrder ?? 0))
      const resetCodes = new Set<string>()

      for (const cand of candidates) {
        if (resetCodes.has(cand.ct.code)) continue
        const resets: string[] = cand.ct.resetsCheckCodes || []
        for (const code of resets) resetCodes.add(code)

        // Determine station
        let station = homeBase
        if (useTier1) {
          const before = assignedFlights.filter((f) => f.flightDate <= cand.triggerDate)
          if (before.length > 0) station = before[before.length - 1].arrivalIcao || homeBase
        }

        // Smart scheduling with maintenance windows
        const baseWindow = windowMap.get(homeBase)
        const durationDays = Math.max(1, Math.ceil(cand.durationHours / 24))
        let proposedStart: string
        let proposedEnd: string
        let windowNote = ''

        if (baseWindow && cand.durationHours <= baseWindow.durationHours) {
          const d = new Date(new Date(cand.triggerDate).getTime() - 1 * 86400000)
          proposedStart = d.toISOString().slice(0, 10)
          proposedEnd = proposedStart
          windowNote = ` Scheduled in ${homeBase} maintenance window (${baseWindow.startUtc}–${baseWindow.endUtc} UTC).`
        } else {
          const d = new Date(new Date(cand.triggerDate).getTime() - 2 * 86400000)
          proposedStart = d.toISOString().slice(0, 10)
          proposedEnd = new Date(d.getTime() + durationDays * 86400000).toISOString().slice(0, 10)
          windowNote = ' Aircraft grounded for duration.'
        }

        const cascadeNote = resets.length > 0 ? ` Resets: ${resets.join(', ')}.` : ''

        proposedEvents.push({
          _id: crypto.randomUUID(),
          operatorId,
          aircraftId: ac._id,
          checkTypeId: cand.ct._id,
          plannedStartUtc: proposedStart,
          plannedEndUtc: proposedEnd,
          station,
          status: 'planned',
          phase: 'planned',
          source: 'auto_proposed',
          notes: `Auto-proposed (Tier ${useTier1 ? 1 : 2}). ${cand.triggerAxis}: ${Math.round(cand.triggerRemaining)} remaining.${windowNote}${cascadeNote}`,
          createdAt: new Date().toISOString(),
        })

        existingEventKeys.add(`${ac._id}:${cand.ct._id}`)
      }
    }

    // 7. Bulk insert proposed events
    if (proposedEvents.length > 0) {
      await MaintenanceEvent.insertMany(proposedEvents)
    }

    // 8. Bulk upsert forecast data
    const now = new Date().toISOString()
    const bulkOps = forecastUpdates.map((u) => ({
      updateOne: {
        filter: { operatorId, aircraftId: u.aircraftId, checkTypeId: u.checkTypeId },
        update: {
          $set: {
            forecastDueDate: u.dueDate,
            forecastDueTrigger: u.trigger as 'hours' | 'cycles' | 'calendar',
            remainingHours: u.remH,
            remainingCycles: u.remC,
            remainingDays: u.remD,
            updatedAt: now,
          },
          $setOnInsert: {
            _id: crypto.randomUUID(),
            operatorId,
            aircraftId: u.aircraftId,
            checkTypeId: u.checkTypeId,
            createdAt: now,
          },
        },
        upsert: true,
      },
    }))

    if (bulkOps.length > 0) {
      await AircraftCheckStatus.bulkWrite(bulkOps)
    }

    return { totalAircraftAnalyzed: aircraft.length, totalProposedEvents: proposedEvents.length }
  })
}
