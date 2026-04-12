import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { CityPair } from '../models/CityPair.js'
import { Airport } from '../models/Airport.js'
import { LopaConfig } from '../models/LopaConfig.js'
import { Operator } from '../models/Operator.js'
import { RecoveryRun } from '../models/RecoveryRun.js'

const DAY_MS = 86_400_000

function timeStringToMs(time: string): number {
  const clean = time.replace(':', '')
  const h = parseInt(clean.slice(0, 2), 10) || 0
  const m = parseInt(clean.slice(2, 4), 10) || 0
  return (h * 60 + m) * 60_000
}

// ── Zod Schemas ──

const solveSchema = z.object({
  operatorId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  config: z.object({
    objective: z.enum(['min_delay', 'min_cancel', 'min_cost', 'max_revenue']),
    horizonHours: z.number().min(1).max(72),
    lockThresholdMinutes: z.number().min(0).max(360),
    maxSolutions: z.number().int().min(1).max(5),
    maxSolveSeconds: z.number().min(5).max(300),
    delayCostPerMinute: z.number().min(0),
    cancelCostPerFlight: z.number().min(0),
    fuelPricePerKg: z.number().min(0),
    referenceTimeUtc: z.string().optional(),
    maxDelayPerFlightMinutes: z.number().int().min(0).max(180).default(0),
    // Advanced constraints
    connectionProtectionMinutes: z.number().int().min(0).max(180).default(0),
    respectCurfews: z.boolean().default(false),
    maxCrewDutyHours: z.number().min(0).max(20).default(0),
    maxSwapsPerAircraft: z.number().int().min(0).max(10).default(0),
    propagationMultiplier: z.number().min(1.0).max(5.0).default(1.0),
    minImprovementUsd: z.number().min(0).default(0),
    objectiveWeights: z
      .object({ delay: z.number(), cost: z.number(), cancel: z.number(), revenue: z.number() })
      .nullable()
      .default(null),
  }),
})

const saveRunSchema = z.object({
  operatorId: z.string().min(1),
  name: z.string().min(1),
  periodFrom: z.string(),
  periodTo: z.string(),
  config: z.any(),
  locked: z.any(),
  selectedSolutionIndex: z.number().int().optional(),
  solutions: z.array(z.any()),
  solveTimeMs: z.number(),
})

// ── Routes ──

export async function recoveryRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /recovery/solve — Marshal data, classify flights, proxy to Python solver ──
  app.post('/recovery/solve', async (req, reply) => {
    const parsed = solveSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const { operatorId, from, to, config } = parsed.data
    // Use referenceTimeUtc for testing, or real now for live operations
    const refStr = config.referenceTimeUtc?.trim() || null
    const parsedRef = refStr ? new Date(refStr.endsWith('Z') ? refStr : refStr + 'Z').getTime() : NaN
    const nowMs = !isNaN(parsedRef) ? parsedRef : Date.now()
    const lockMs = config.lockThresholdMinutes * 60_000
    const horizonEndMs = nowMs + config.horizonHours * 3_600_000

    console.log('[recovery/solve] refStr:', refStr, '→ nowMs:', nowMs, '→', new Date(nowMs).toISOString())
    console.log(
      '[recovery/solve] lock until:',
      new Date(nowMs + lockMs).toISOString(),
      'horizon end:',
      new Date(horizonEndMs).toISOString(),
    )
    console.log('[recovery/solve] period from:', from, 'to:', to)

    // ── Parallel data queries ──
    const [scheduledFlights, registrations, acTypes, instances, cityPairs, lopaConfigs, operator, airports] =
      await Promise.all([
        ScheduledFlight.find({ operatorId, isActive: { $ne: false }, status: { $ne: 'cancelled' } }).lean(),
        AircraftRegistration.find({ operatorId, isActive: true }).lean(),
        AircraftType.find({ operatorId, isActive: true }).lean(),
        FlightInstance.find({
          operatorId,
          operatingDate: { $gte: from, $lte: to },
        }).lean(),
        CityPair.find({ operatorId, isActive: true }).lean(),
        LopaConfig.find({ operatorId, isActive: true }).lean(),
        Operator.findById(operatorId).lean(),
        Airport.find({ operatorId, isActive: true }).lean(),
      ])

    // Instance overlay map
    const instanceMap = new Map<string, (typeof instances)[0]>()
    for (const inst of instances) instanceMap.set(inst._id as string, inst)

    // CityPair revenue lookup: "IATA1-IATA2" → revenue[]
    // CityPair route type lookup: "IATA1-IATA2" → "domestic" | "international"
    const revenueMap = new Map<string, (typeof cityPairs)[0]['revenue']>()
    const routeTypeMap = new Map<string, string>()
    for (const cp of cityPairs) {
      const key = `${cp.station1Iata}-${cp.station2Iata}`
      revenueMap.set(key, cp.revenue ?? [])
      if ((cp as any).routeType) {
        routeTypeMap.set(key, (cp as any).routeType)
        // Also set reverse direction
        routeTypeMap.set(`${cp.station2Iata}-${cp.station1Iata}`, (cp as any).routeType)
      }
    }

    // LOPA lookup for seat counts
    const lopaByType = new Map<string, number>()
    for (const lopa of lopaConfigs) {
      if (lopa.isDefault) {
        const totalSeats =
          (lopa.cabins as Array<{ classCode: string; seats: number }>)?.reduce((s, c) => s + (c.seats ?? 0), 0) ?? 0
        lopaByType.set(lopa.aircraftType as string, totalSeats)
      }
    }

    // Airport curfew lookup: IATA → { startRelativeMs, endRelativeMs } (relative to midnight UTC)
    const curfewMap = new Map<string, { startRelativeMs: number; endRelativeMs: number }>()
    for (const apt of airports) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = apt as any
      if (!a.hasCurfew || !a.curfewStart || !a.curfewEnd) continue
      const offsetMs = ((a.utcOffsetHours as number) ?? 0) * 3_600_000
      const startLocalMs = timeStringToMs(a.curfewStart)
      const endLocalMs = timeStringToMs(a.curfewEnd)
      curfewMap.set(a.iataCode as string, {
        startRelativeMs: startLocalMs - offsetMs,
        endRelativeMs: endLocalMs - offsetMs,
      })
    }

    // CityPair average load factor lookup for pax estimation
    const loadFactorMap = new Map<string, number>()
    for (const cp of cityPairs) {
      const key1 = `${cp.station1Iata}-${cp.station2Iata}`
      const key2 = `${cp.station2Iata}-${cp.station1Iata}`
      const rev = cp.revenue as Array<{ loadFactor?: number }> | undefined
      if (rev && rev.length > 0) {
        const avgLf = rev.reduce((s, r) => s + (r.loadFactor ?? 0.85), 0) / rev.length
        loadFactorMap.set(key1, avgLf)
        loadFactorMap.set(key2, avgLf)
      }
    }

    // Rotation size lookup: rotationId → total legs count
    const rotationSizeMap = new Map<string, number>()
    for (const sf of scheduledFlights) {
      const rid = sf.rotationId as string | null
      if (rid) rotationSizeMap.set(rid, (rotationSizeMap.get(rid) ?? 0) + 1)
    }

    // ── Expand flights (same logic as gantt.ts) ──
    const fromMs = new Date(from + 'T00:00:00Z').getTime()
    const toMs = new Date(to + 'T00:00:00Z').getTime()
    const visibleEndMs = toMs + DAY_MS

    interface ExpandedFlight {
      id: string
      flight_number: string
      dep_station: string
      arr_station: string
      std_utc: number
      sta_utc: number
      block_minutes: number
      aircraft_type_icao: string | null
      aircraft_reg: string | null
      rotation_id: string | null
      rotation_sequence: number | null
      route_type: string
      estimated_revenue: number
      pax_count: number
      connecting_pax: number
      is_priority: boolean
      rotation_total_legs: number
      arr_curfew_start_utc: number | null
      arr_curfew_end_utc: number | null
    }

    const allFlights: ExpandedFlight[] = []

    for (const sf of scheduledFlights) {
      const effFromMs = new Date(
        ((sf.effectiveFrom as string) ?? '').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1') + 'T00:00:00Z',
      ).getTime()
      const effUntilMs = new Date(
        ((sf.effectiveUntil as string) ?? '').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1') + 'T00:00:00Z',
      ).getTime()
      if (isNaN(effFromMs) || isNaN(effUntilMs)) continue
      const dow = sf.daysOfWeek as string
      const depOffset = (sf.departureDayOffset as number) ?? 1
      const arrOffset = (sf.arrivalDayOffset as number) ?? 1
      const maxOffset = Math.max(depOffset, arrOffset)

      const rangeStart = Math.max(effFromMs, fromMs - (maxOffset - 1) * DAY_MS)
      const rangeEnd = Math.min(effUntilMs, toMs)

      for (let dayMs = rangeStart; dayMs <= rangeEnd; dayMs += DAY_MS) {
        const opDate = new Date(dayMs).toISOString().slice(0, 10)
        const jsDay = new Date(opDate + 'T12:00:00Z').getUTCDay()
        const ssimDay = jsDay === 0 ? 7 : jsDay
        if (!dow.includes(String(ssimDay))) continue

        const stdMs = dayMs + (depOffset - 1) * DAY_MS + timeStringToMs(sf.stdUtc as string)
        const staMs = dayMs + (arrOffset - 1) * DAY_MS + timeStringToMs(sf.staUtc as string)
        if (staMs < fromMs || stdMs >= visibleEndMs) continue

        const compositeId = `${sf._id}|${opDate}`
        const inst = instanceMap.get(compositeId)
        if ((inst?.status as string) === 'cancelled') continue
        const aircraftReg = inst ? (inst.tail?.registration ?? null) : ((sf.aircraftReg as string) ?? null)

        // Revenue estimation
        const depIata = sf.depStation as string
        const arrIata = sf.arrStation as string
        const cpKey1 = `${depIata}-${arrIata}`
        const cpKey2 = `${arrIata}-${depIata}`
        const revenue = revenueMap.get(cpKey1) ?? revenueMap.get(cpKey2) ?? []
        let estimatedRevenue = 0
        const acTypeIcao = (sf.aircraftTypeIcao as string) ?? null
        const totalSeats = acTypeIcao ? (lopaByType.get(acTypeIcao) ?? 180) : 180
        for (const rev of revenue) {
          // Simplified: use total seats × load factor × yield (assuming single class dominates)
          estimatedRevenue += totalSeats * (rev.loadFactor ?? 0.85) * (rev.dir1YieldPerPax ?? 0)
        }
        // If multiple classes, estimatedRevenue sums them all — divide by class count for avg
        if (revenue.length > 1) estimatedRevenue = estimatedRevenue / revenue.length

        // Resolve route type from CityPair
        const rtKey = `${depIata}-${arrIata}`
        const routeType = routeTypeMap.get(rtKey) ?? 'domestic'

        // Pax count: prefer FlightInstance expected pax, fall back to LOPA × load factor
        const instPax = inst?.pax as
          | { adultExpected?: number; childExpected?: number; infantExpected?: number }
          | undefined
        const expectedPax =
          (instPax?.adultExpected ?? 0) + (instPax?.childExpected ?? 0) + (instPax?.infantExpected ?? 0)
        const avgLoadFactor = loadFactorMap.get(rtKey) ?? 0.85
        const lopaPax = Math.round(totalSeats * avgLoadFactor)
        const paxCount = expectedPax > 0 ? expectedPax : lopaPax

        // Connecting pax from FlightInstance outgoing connections
        const instConn = (inst as any)?.connections?.outgoing as Array<{ pax?: number }> | undefined
        const connectingPax = instConn?.reduce((s: number, c) => s + (c.pax ?? 0), 0) ?? 0

        // Rotation context
        const rotationId = (sf.rotationId as string) ?? null
        const rotationTotalLegs = rotationId ? (rotationSizeMap.get(rotationId) ?? 1) : 1

        // Arrival airport curfew (convert to absolute UTC ms for this operating day)
        const arrCurfew = curfewMap.get(arrIata)
        const dayBaseMs = dayMs + (arrOffset - 1) * DAY_MS // arrival day base
        const arrCurfewStartUtc = arrCurfew ? dayBaseMs + arrCurfew.startRelativeMs : null
        const arrCurfewEndUtc = arrCurfew ? dayBaseMs + arrCurfew.endRelativeMs : null

        allFlights.push({
          id: compositeId,
          flight_number: sf.flightNumber as string,
          dep_station: depIata,
          arr_station: arrIata,
          std_utc: stdMs,
          sta_utc: staMs,
          block_minutes: (sf.blockMinutes as number) ?? Math.round((staMs - stdMs) / 60_000),
          aircraft_type_icao: acTypeIcao,
          aircraft_reg: aircraftReg,
          rotation_id: rotationId,
          rotation_sequence: (sf.rotationSequence as number) ?? null,
          route_type: routeType,
          estimated_revenue: Math.round(estimatedRevenue * 100) / 100,
          pax_count: paxCount,
          connecting_pax: connectingPax,
          is_priority: false,
          rotation_total_legs: rotationTotalLegs,
          arr_curfew_start_utc: arrCurfewStartUtc,
          arr_curfew_end_utc: arrCurfewEndUtc,
        })
      }
    }

    allFlights.sort((a, b) => a.std_utc - b.std_utc)

    // ── Classify flights ──
    const available: typeof allFlights = []
    const locked: typeof allFlights = []
    const frozen: typeof allFlights = []
    let departedCount = 0
    let thresholdCount = 0

    for (const flight of allFlights) {
      const inst = instanceMap.get(flight.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actual = (inst as any)?.actual
      // When using reference time, only consider OOOI that happened BEFORE the reference
      // (flights that "departed after" the reference time are still available in our simulation)
      const hasOOOI = actual?.atdUtc
        ? actual.atdUtc < nowMs // departed before reference time → locked
        : false

      if (hasOOOI) {
        locked.push(flight)
        departedCount++
      } else if (flight.std_utc <= nowMs + lockMs) {
        locked.push(flight)
        thresholdCount++
      } else if (flight.std_utc > horizonEndMs) {
        frozen.push(flight)
      } else {
        available.push(flight)
      }
    }

    console.log(
      '[recovery/solve] total:',
      allFlights.length,
      'departed:',
      departedCount,
      'threshold:',
      thresholdCount,
      'frozen:',
      frozen.length,
      'available:',
      available.length,
    )

    // Log sample flights for debugging when nothing is available
    if (available.length === 0 && allFlights.length > 0) {
      // Find flights that SHOULD be available (STD between lock window and horizon)
      const shouldBeAvailable = allFlights.filter((f) => f.std_utc > nowMs + lockMs && f.std_utc <= horizonEndMs)
      console.log('[recovery/solve] flights in time window (should be available):', shouldBeAvailable.length)
      for (const f of shouldBeAvailable.slice(0, 5)) {
        const inst = instanceMap.get(f.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const atd = (inst as any)?.actual?.atdUtc
        console.log(
          `  ${f.flight_number} STD:${new Date(f.std_utc).toISOString()} ATD:${atd ? new Date(atd).toISOString() : 'null'} ATD<now:${atd != null ? atd < nowMs : 'n/a'} instExists:${!!inst}`,
        )
      }
    }

    // ── Build aircraft list with current positions ──
    const acTypeMap = new Map(acTypes.map((t) => [t._id, t]))
    const aircraftList = registrations.map((reg) => {
      const acType = acTypeMap.get(reg.aircraftTypeId as string)
      const lastLocked = [...locked]
        .filter((f) => f.aircraft_reg === reg.registration)
        .sort((a, b) => b.sta_utc - a.sta_utc)[0]

      return {
        registration: reg.registration as string,
        aircraft_type_icao: (acType?.icaoType as string) ?? '',
        home_base_icao: (reg.homeBaseIcao as string) ?? null,
        fuel_burn_rate_kg_per_hour:
          (reg.fuelBurnRateKgPerHour as number) ?? (acType?.fuelBurnRateKgPerHour as number) ?? null,
        seat_config: null as string | null,
        current_station: lastLocked?.arr_station ?? (reg.homeBaseIcao as string) ?? null,
        available_from_utc: lastLocked?.sta_utc ?? nowMs,
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acTypeList = acTypes.map((t: any) => ({
      icao_type: t.icaoType as string,
      tat_default_minutes: (t.tat?.defaultMinutes as number) ?? 45,
      tat_dom_dom: (t.tat?.domDom as number) ?? null,
      tat_dom_int: (t.tat?.domInt as number) ?? null,
      tat_int_dom: (t.tat?.intDom as number) ?? null,
      tat_int_int: (t.tat?.intInt as number) ?? null,
      fuel_burn_rate_kg_per_hour: (t.fuelBurnRateKgPerHour as number) ?? null,
    }))

    // ── Proxy to Python solver ──
    const solverUrl = process.env.ML_API_URL || 'http://localhost:8080'
    const solverPayload = {
      available_flights: available,
      locked_flights: locked,
      frozen_flights: frozen,
      aircraft: aircraftList,
      aircraft_types: acTypeList,
      config: {
        objective: config.objective,
        horizon_hours: config.horizonHours,
        lock_threshold_minutes: config.lockThresholdMinutes,
        max_solutions: config.maxSolutions,
        max_solve_seconds: config.maxSolveSeconds,
        delay_cost_per_minute: config.delayCostPerMinute,
        cancel_cost_per_flight: config.cancelCostPerFlight,
        fuel_price_per_kg: config.fuelPricePerKg,
        max_delay_per_flight_minutes: config.maxDelayPerFlightMinutes,
        reference_time_utc_ms: nowMs,
        connection_protection_minutes: config.connectionProtectionMinutes,
        respect_curfews: config.respectCurfews,
        max_crew_duty_hours: config.maxCrewDutyHours,
        max_swaps_per_aircraft: config.maxSwapsPerAircraft,
        propagation_multiplier: config.propagationMultiplier,
        min_improvement_usd: config.minImprovementUsd,
        objective_weights: config.objectiveWeights,
      },
    }

    try {
      const solverRes = await fetch(`${solverUrl}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solverPayload),
      })

      if (!solverRes.ok) {
        const errText = await solverRes.text()
        return reply.code(502).send({ error: 'Solver failed', details: errText })
      }

      // Stream SSE response back to client
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })

      // Inject locked counts as first event
      reply.raw.write(
        `event: locked\ndata: ${JSON.stringify({ departed: departedCount, within_threshold: thresholdCount, beyond_horizon: frozen.length, available: available.length })}\n\n`,
      )

      const reader = solverRes.body?.getReader()
      if (!reader) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: 'No response body from solver' })}\n\n`)
        reply.raw.end()
        return
      }

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply.raw.write(decoder.decode(value, { stream: true }))
      }

      reply.raw.end()
    } catch (err) {
      return reply.code(502).send({
        error: 'Solver unreachable',
        details: err instanceof Error ? err.message : String(err),
      })
    }
  })

  // ── POST /recovery/runs — Save a recovery run ──
  app.post('/recovery/runs', async (req, reply) => {
    const parsed = saveRunSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const data = parsed.data
    const id = crypto.randomUUID()
    await RecoveryRun.create({
      _id: id,
      ...data,
      createdAt: new Date().toISOString(),
    })
    return { id }
  })

  // ── GET /recovery/runs — List runs ──
  app.get('/recovery/runs', async (req) => {
    const q = req.query as Record<string, string>
    const filter: Record<string, unknown> = { operatorId: q.operatorId }
    if (q.periodFrom) filter.periodFrom = { $gte: q.periodFrom }
    if (q.periodTo) filter.periodTo = { $lte: q.periodTo }

    const runs = await RecoveryRun.find(filter, {
      _id: 1,
      name: 1,
      config: 1,
      locked: 1,
      solveTimeMs: 1,
      createdAt: 1,
      'solutions.label': 1,
      'solutions.summary': 1,
      'solutions.metrics': 1,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    return runs
  })

  // ── GET /recovery/runs/:id — Get full run ──
  app.get('/recovery/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const doc = await RecoveryRun.findById(id).lean()
    if (!doc) return reply.code(404).send({ error: 'Recovery run not found' })
    return doc
  })

  // ── DELETE /recovery/runs/:id — Delete run ──
  app.delete('/recovery/runs/:id', async (req) => {
    const { id } = req.params as { id: string }
    await RecoveryRun.findByIdAndDelete(id)
    return { removed: 1 }
  })
}
