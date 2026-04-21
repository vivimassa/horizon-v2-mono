import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Pairing } from '../models/Pairing.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { Airport } from '../models/Airport.js'
import { AircraftType } from '../models/AircraftType.js'
import { CrewAssignment } from '../models/CrewAssignment.js'
import { loadSerializedRuleSet } from '../services/fdtl-rule-set.js'
import { evaluatePairingLegality } from '../services/evaluate-pairing-legality.js'

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
  // Tail is captured at pairing-save time so the inspector keeps the correct
  // registration even after the virtual-placement overlay is cleared. Without
  // this field here, Zod strips it silently and the Pairing doc persists
  // `tailNumber: null` for every leg.
  tailNumber: z.string().nullable().optional(),
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
  // ── TEMP: probe tail coverage for a date — surfaces what's actually in the DB ──
  app.get('/pairings/debug/tail-probe', async (req) => {
    const q = req.query as Record<string, string>
    const date = q.date ?? new Date().toISOString().slice(0, 10)
    const operatorId = req.operatorId
    const total = await FlightInstance.countDocuments({ operatorId, operatingDate: date })
    const withTail = await FlightInstance.countDocuments({
      operatorId,
      operatingDate: date,
      'tail.registration': { $ne: null },
    })
    const sample = await FlightInstance.find(
      { operatorId, operatingDate: date },
      { _id: 1, operatingDate: 1, 'tail.registration': 1, scheduledFlightId: 1 },
    )
      .limit(5)
      .lean()
    const distinctOpDates = await FlightInstance.distinct('operatingDate', {
      operatorId,
      operatingDate: { $regex: '^2026-04' },
    })
    return {
      operatorId,
      queriedDate: date,
      total,
      withTail,
      sample,
      aprilOperatingDatesFound: distinctOpDates.sort(),
    }
  })

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
    // `includeBleed=1` asks for cross-midnight flights whose operating date is
    // the day BEFORE dateFrom but whose STA lands inside the window. The Gantt
    // view (4.1.5.2) opts in so overnight bars render on the first day; the
    // Text view (4.1.5.1) stays strict so new pairings never get a
    // prior-period startDate.
    const includeBleed = q.includeBleed === '1' || q.includeBleed === 'true'

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
    // Per-date tail overlay — match by composite `_id` (`${sfId}|${opDate}`)
    // directly, same shape Movement Control's `/gantt/flights` and
    // `/gantt/bulk-assign` use. We build candidate ids up front from the
    // schedule pattern so a pre-existing FlightInstance doc (one whose
    // `operatingDate` / `scheduledFlightId` fields may never have been
    // populated — e.g. created by a prior seed with only `_id` set) is
    // still matched by its composite id.
    const instanceTailById = new Map<string, string>()
    if (flights.length > 0) {
      const DAY_MS_TAIL = 86_400_000
      const fromMsTail = new Date(dateFrom + 'T00:00:00Z').getTime()
      const toMsTail = new Date(dateTo + 'T00:00:00Z').getTime()
      const candidateIds: string[] = []
      for (const f of flights) {
        const effFromMs = new Date(`${f.effectiveFrom}T00:00:00Z`).getTime()
        const effUntilMs = new Date(`${f.effectiveUntil}T00:00:00Z`).getTime()
        // Movement Control keys FlightInstance by the schedule's operating
        // date (dayMs). For a cross-midnight flight (arrivalDayOffset > 1
        // or a late-night STD that we expand via the main-loop lookback)
        // the instance key is the DAY BEFORE the visible window starts.
        // Extend the candidate range back by maxOffset days so those are
        // included — otherwise they look unassigned even when MC has a
        // real tail on them.
        const depOffset = (f.departureDayOffset ?? 1) - 1
        const arrOffset = (f.arrivalDayOffset ?? 1) - 1
        const maxOffset = Math.max(depOffset, arrOffset)
        const lookbackMs = (maxOffset + 1) * DAY_MS_TAIL
        const start = Math.max(effFromMs, fromMsTail - lookbackMs)
        const end = Math.min(effUntilMs, toMsTail)
        const dow = f.daysOfWeek ?? '1234567'
        for (let ms = start; ms <= end; ms += DAY_MS_TAIL) {
          const iso = new Date(ms).toISOString().slice(0, 10)
          const jsDay = new Date(iso + 'T12:00:00Z').getUTCDay()
          const ssimDay = jsDay === 0 ? 7 : jsDay
          if (!dow.includes(String(ssimDay))) continue
          candidateIds.push(`${f._id as string}|${iso}`)
        }
      }
      if (candidateIds.length > 0) {
        const instances = await FlightInstance.find(
          { operatorId: req.operatorId, _id: { $in: candidateIds }, 'tail.registration': { $ne: null } },
          { _id: 1, 'tail.registration': 1 },
        ).lean()
        for (const inst of instances) {
          const reg = (inst as unknown as { tail?: { registration?: string | null } }).tail?.registration
          if (reg && inst._id) {
            instanceTailById.set(inst._id as string, reg)
          }
        }
        req.log.info(
          {
            dateFrom,
            dateTo,
            candidateIds: candidateIds.length,
            matched: instances.length,
            sampleCandidate: candidateIds[0],
            sampleMatched: instances[0]?._id,
          },
          '[pairing-flight-pool] tail overlay id match',
        )
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

    // Visible window edges in epoch-ms — used to filter flights whose STD/STA
    // falls outside the query period even when their operating date does.
    const DAY_MS = 86_400_000
    const fromMs = fromD.getTime()
    const visibleEndMs = toD.getTime() + DAY_MS // inclusive of last day

    for (const f of flights) {
      const effFrom = new Date(`${f.effectiveFrom}T00:00:00Z`)
      const effTo = new Date(`${f.effectiveUntil}T00:00:00Z`)

      const depOffset = (f.departureDayOffset ?? 1) - 1 // 0 = same day, 1 = +1, …
      const arrOffset = (f.arrivalDayOffset ?? 1) - 1

      // Expand operating dates inside the requested period. In strict mode
      // (Text view, the default) we do NOT reach back into the prior day —
      // otherwise a cross-midnight flight would leak its prior-month
      // operating date into newly-created pairings (pairing.startDate = 31
      // MAR). In bleed mode (Gantt view, opt-in via ?includeBleed=1) we
      // reach back by `maxOffset + 1` days so overnight bars render on the
      // first visible day. The downstream std/sta visibility filter below
      // trims anything that doesn't actually overlap the window.
      const lookbackDays = includeBleed ? Math.max(depOffset, arrOffset) + 1 : 0
      const lookbackFromD = lookbackDays > 0 ? new Date(fromD.getTime() - lookbackDays * DAY_MS) : fromD
      const start = effFrom > lookbackFromD ? effFrom : lookbackFromD
      const end = effTo < toD ? effTo : toD

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        // SSIM daysOfWeek: each digit is an operating day number (Mon=1..Sun=7).
        // E.g. "1234567" = every day, "135" = Mon/Wed/Fri. A flight with
        // digit N present in the string operates on that SSIM day. This matches
        // Movement Control's `/gantt/flights` expansion — not a bitmask.
        const jsDay = d.getUTCDay() // Sun=0..Sat=6
        const ssimDay = jsDay === 0 ? 7 : jsDay
        if (!(f.daysOfWeek ?? '1234567').includes(String(ssimDay))) continue

        const instanceDate = d.toISOString().slice(0, 10)
        const depDate = addDays(instanceDate, depOffset)
        const arrDate = addDays(instanceDate, arrOffset)
        const stdIsoForInstance = composeIso(depDate, f.stdUtc)
        const staIsoForInstance = composeIso(arrDate, f.staUtc)

        // Skip flights whose entire block falls outside the visible window.
        // This covers the lookback window: an operating date from the
        // previous month whose STA is also before fromD is excluded, but
        // a cross-midnight flight whose STA lands inside the query period
        // is kept. Matches Movement Control's `/gantt/flights` filter.
        const stdMs = new Date(stdIsoForInstance).getTime()
        const staMs = new Date(staIsoForInstance).getTime()
        if (staMs < fromMs || stdMs >= visibleEndMs) continue

        // Fallback block minutes if the DB row is missing the value —
        // compute directly from the two ISO timestamps.
        const derivedBlock = Math.max(0, Math.round((staMs - stdMs) / 60000))
        const blockMinutes = f.blockMinutes && f.blockMinutes > 0 ? f.blockMinutes : derivedBlock

        const id = `${f._id}__${instanceDate}`

        // Movement Control's `/gantt/assign` writes instances keyed
        // `${scheduledFlightId}|${operatingDate}` — look up with that shape.
        const instanceTail = instanceTailById.get(`${f._id as string}|${instanceDate}`) ?? null
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

  // ── Schedule changes (ad-hoc delta against current FlightInstance) ──
  // TODO: Replace with a proper flight-amendment audit log once the
  // FlightInstance model emits change events. Today we synthesise the
  // delta by comparing the pairing's frozen leg times to the current
  // FlightInstance `schedule.stdUtc/staUtc` values.
  app.get('/pairings/:id/schedule-changes', async (req, reply) => {
    const { id } = req.params as { id: string }
    const pairing = await Pairing.findOne({ _id: id, operatorId: req.operatorId }).lean()
    if (!pairing) return reply.code(404).send({ error: 'Pairing not found' })

    // FlightInstance._id = `${scheduledFlightId}|${yyyy-mm-dd}`.
    // Pairing leg `flightId` may be scoped with `__` separators — the
    // scheduledFlightId is always the first segment.
    const instanceIds = pairing.legs.map((l) => `${l.flightId.split('__')[0]}|${l.flightDate}`)
    const instances = await FlightInstance.find(
      { operatorId: req.operatorId, _id: { $in: instanceIds } },
      { _id: 1, schedule: 1, syncMeta: 1 },
    ).lean()
    const instByKey = new Map<string, (typeof instances)[number]>()
    for (const inst of instances) instByKey.set(inst._id as string, inst)

    const changes = pairing.legs.map((leg) => {
      const key = `${leg.flightId.split('__')[0]}|${leg.flightDate}`
      const inst = instByKey.get(key)
      const pairingStdMs = Date.parse(leg.stdUtcIso)
      const pairingStaMs = Date.parse(leg.staUtcIso)
      const currentStdMs = inst?.schedule?.stdUtc ?? null
      const currentStaMs = inst?.schedule?.staUtc ?? null
      const stdDeltaMin =
        currentStdMs !== null && !Number.isNaN(pairingStdMs) ? Math.round((currentStdMs - pairingStdMs) / 60_000) : null
      const staDeltaMin =
        currentStaMs !== null && !Number.isNaN(pairingStaMs) ? Math.round((currentStaMs - pairingStaMs) / 60_000) : null
      return {
        flightId: leg.flightId,
        flightDate: leg.flightDate,
        flightNumber: leg.flightNumber,
        depStation: leg.depStation,
        arrStation: leg.arrStation,
        legOrder: leg.legOrder,
        pairingStdUtcIso: leg.stdUtcIso,
        pairingStaUtcIso: leg.staUtcIso,
        currentStdUtcMs: currentStdMs,
        currentStaUtcMs: currentStaMs,
        stdDeltaMin,
        staDeltaMin,
        hasChange: (stdDeltaMin !== null && stdDeltaMin !== 0) || (staDeltaMin !== null && staDeltaMin !== 0),
        lastChangedAtMs: inst?.syncMeta?.updatedAt ?? null,
        instanceMissing: !inst,
      }
    })

    return {
      pairingId: pairing._id,
      pairingCode: pairing.pairingCode,
      pairingCommittedAt: pairing.updatedAt,
      changes,
    }
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

    // Auto-run FDTL engine when the client didn't pre-compute a result.
    // Keeps `lastLegalityResult` populated for every saved pairing so the
    // inspector's FDP / Legality rows never show blanks.
    let legalityResult: unknown = body.lastLegalityResult ?? null
    let fdtlStatus = body.fdtlStatus
    if (!legalityResult) {
      const ruleSet = await loadSerializedRuleSet(req.operatorId)
      const evalResult = evaluatePairingLegality(
        {
          baseAirport: body.baseAirport,
          complementKey: body.complementKey,
          cockpitCount: body.cockpitCount,
          facilityClass: body.facilityClass ?? null,
          legs: body.legs,
        },
        ruleSet,
      )
      if (evalResult) {
        legalityResult = evalResult.result
        fdtlStatus = evalResult.status
      }
    }

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
      fdtlStatus,
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
      lastLegalityResult: legalityResult,
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

    // Re-run legality when legs changed and the caller didn't supply a
    // fresh result. Pulls the current doc for unchanged fields (base /
    // complement) so the engine sees the complete pairing.
    if (body.legs && body.lastLegalityResult === undefined) {
      const current = await Pairing.findOne({ _id: id, operatorId: req.operatorId }).lean()
      if (current) {
        const ruleSet = await loadSerializedRuleSet(req.operatorId)
        const evalResult = evaluatePairingLegality(
          {
            baseAirport: (body.baseAirport as string | undefined) ?? current.baseAirport,
            complementKey: (body.complementKey as string | undefined) ?? current.complementKey,
            cockpitCount: (body.cockpitCount as number | undefined) ?? current.cockpitCount,
            facilityClass:
              body.facilityClass !== undefined ? (body.facilityClass as string | null) : current.facilityClass,
            legs: body.legs,
          },
          ruleSet,
        )
        if (evalResult) {
          patch.lastLegalityResult = evalResult.result
          patch.fdtlStatus = evalResult.status
        }
      }
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
  // Cascade: remove any CrewAssignment rows still bound to this pairing so
  // the crew-schedule Gantt (4.1.6) doesn't render orphan bars pointing at
  // a missing pairing. Runs *before* the pairing delete so a partial
  // failure leaves the assignments intact for retry.
  app.delete('/pairings/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const exists = await Pairing.exists({ _id: id, operatorId: req.operatorId })
    if (!exists) return reply.code(404).send({ error: 'Pairing not found' })
    const assignments = await CrewAssignment.deleteMany({ pairingId: id, operatorId: req.operatorId })
    await Pairing.deleteOne({ _id: id, operatorId: req.operatorId })
    return { success: true, deletedAssignments: assignments.deletedCount ?? 0 }
  })

  // ── Bulk create — replicate flow fires one request instead of N ──
  app.post('/pairings/bulk', async (req, reply) => {
    const parsed = z.object({ items: z.array(createPairingSchema).min(1).max(500) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const items = parsed.data.items

    // Tenant check — every referenced flight must belong to the caller.
    const flightIds = [...new Set(items.flatMap((b) => b.legs.map((l) => l.flightId.split('__')[0])))]
    const found = await ScheduledFlight.countDocuments({
      _id: { $in: flightIds },
      operatorId: req.operatorId,
    })
    if (found !== flightIds.length) {
      return reply.code(400).send({ error: 'One or more referenced flights do not belong to this operator' })
    }

    const now = new Date().toISOString()
    const createdBy = (req as { user?: { sub?: string } }).user?.sub ?? 'system'
    // Load rule set once for the whole batch — saves N-1 DB round-trips
    // when the client didn't pre-compute legality on every pairing.
    const needEngine = items.some((b) => !b.lastLegalityResult)
    const ruleSet = needEngine ? await loadSerializedRuleSet(req.operatorId) : null
    const docs = items.map((body) => {
      const summary = summarize(body.legs)
      let legalityResult: unknown = body.lastLegalityResult ?? null
      let fdtlStatus = body.fdtlStatus
      if (!legalityResult) {
        const evalResult = evaluatePairingLegality(
          {
            baseAirport: body.baseAirport,
            complementKey: body.complementKey,
            cockpitCount: body.cockpitCount,
            facilityClass: body.facilityClass ?? null,
            legs: body.legs,
          },
          ruleSet,
        )
        if (evalResult) {
          legalityResult = evalResult.result
          fdtlStatus = evalResult.status
        }
      }
      return {
        _id: crypto.randomUUID(),
        operatorId: req.operatorId,
        scenarioId: body.scenarioId ?? null,
        seasonCode: body.seasonCode ?? null,
        pairingCode: body.pairingCode,
        baseAirport: body.baseAirport,
        baseId: body.baseId ?? null,
        aircraftTypeIcao: body.aircraftTypeIcao ?? null,
        aircraftTypeId: body.aircraftTypeId ?? null,
        fdtlStatus,
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
        lastLegalityResult: legalityResult,
        createdBy,
        createdAt: now,
        updatedAt: now,
      }
    })

    // `ordered: false` lets good docs land even if one fails tenant-level
    // checks. Returning failed count lets the UI surface the number.
    try {
      await Pairing.insertMany(docs, { ordered: false })
      return { created: docs, failed: 0 }
    } catch (err) {
      const writeErrors = (err as { writeErrors?: unknown[] }).writeErrors ?? []
      const failed = Array.isArray(writeErrors) ? writeErrors.length : 1
      const insertedIds = new Set(
        ((err as { insertedDocs?: Array<{ _id: string }> }).insertedDocs ?? []).map((d) => d._id),
      )
      const created = insertedIds.size > 0 ? docs.filter((d) => insertedIds.has(d._id)) : []
      return { created, failed }
    }
  })

  // ── Bulk delete — parent-group "Delete all 30 instances" flow ──
  app.post('/pairings/bulk-delete', async (req, reply) => {
    const parsed = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues })
    const ids = parsed.data.ids
    const assignments = await CrewAssignment.deleteMany({
      pairingId: { $in: ids },
      operatorId: req.operatorId,
    })
    const res = await Pairing.deleteMany({ _id: { $in: ids }, operatorId: req.operatorId })
    return { deletedCount: res.deletedCount ?? 0, deletedAssignments: assignments.deletedCount ?? 0 }
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
