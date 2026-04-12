import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { CityPair } from '../models/CityPair.js'
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
    const nowMs = Date.now()
    const lockMs = config.lockThresholdMinutes * 60_000
    const horizonEndMs = nowMs + config.horizonHours * 3_600_000

    // ── Parallel data queries ──
    const [scheduledFlights, registrations, acTypes, instances, cityPairs, lopaConfigs, operator] = await Promise.all([
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
    ])

    // Instance overlay map
    const instanceMap = new Map<string, (typeof instances)[0]>()
    for (const inst of instances) instanceMap.set(inst._id as string, inst)

    // CityPair revenue lookup: "IATA1-IATA2" → revenue[]
    const revenueMap = new Map<string, (typeof cityPairs)[0]['revenue']>()
    for (const cp of cityPairs) {
      const key = `${cp.station1Iata}-${cp.station2Iata}`
      revenueMap.set(key, cp.revenue ?? [])
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
      estimated_revenue: number
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
          rotation_id: (sf.rotationId as string) ?? null,
          rotation_sequence: (sf.rotationSequence as number) ?? null,
          estimated_revenue: Math.round(estimatedRevenue * 100) / 100,
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
      const hasOOOI = actual?.atdUtc || actual?.offUtc || actual?.onUtc || actual?.ataUtc

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
        `event: locked\ndata: ${JSON.stringify({ departed: departedCount, within_threshold: thresholdCount, beyond_horizon: frozen.length })}\n\n`,
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
