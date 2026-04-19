import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { ManpowerPlan } from '../models/ManpowerPlan.js'
import { ManpowerPlanSettings } from '../models/ManpowerPlanSettings.js'
import { ManpowerPositionSettings } from '../models/ManpowerPositionSettings.js'
import { ManpowerFleetOverride } from '../models/ManpowerFleetOverride.js'
import { ManpowerFleetUtilization } from '../models/ManpowerFleetUtilization.js'
import { ManpowerEvent } from '../models/ManpowerEvent.js'
import { CrewMember } from '../models/CrewMember.js'
import { CrewQualification } from '../models/CrewQualification.js'
import { CrewPosition } from '../models/CrewPosition.js'
import { CrewComplement } from '../models/CrewComplement.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { ensureManpowerBasePlan } from '../services/ensure-manpower-base-plan.js'
import {
  eventSchema,
  fleetOverrideSchema,
  fleetUtilizationSchema,
  planCreateSchema,
  planSettingsSchema,
  planUpdateSchema,
  positionSettingsSchema,
} from '../schemas/manpower.js'

export async function manpowerRoutes(app: FastifyInstance): Promise<void> {
  // ─── Plans ───────────────────────────────────────────────
  app.get('/manpower/plans', async (req) => {
    const operatorId = req.operatorId
    await ensureManpowerBasePlan(operatorId)
    return ManpowerPlan.find({ operatorId }).sort({ sortOrder: 1, createdAt: 1 }).lean()
  })

  app.post('/manpower/plans', async (req, reply) => {
    const operatorId = req.operatorId
    const parsed = planCreateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })

    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const year = parsed.data.year ?? new Date().getFullYear() + 1
    const count = await ManpowerPlan.countDocuments({ operatorId })
    const plan = await ManpowerPlan.create({
      _id: id,
      operatorId,
      name: parsed.data.name,
      color: parsed.data.color ?? '#0063F7',
      isBasePlan: false,
      sortOrder: count,
      year,
      createdAt: now,
      updatedAt: now,
    })
    await ManpowerPlanSettings.create({
      _id: id,
      planId: id,
      operatorId,
      wetLeaseActive: false,
      naOtherIsDrain: false,
      updatedAt: now,
    })

    // Clone settings + position settings + utilisation from source plan if provided.
    if (parsed.data.sourceId) {
      const source = await ManpowerPlan.findOne({ _id: parsed.data.sourceId, operatorId }).lean()
      if (source) {
        const [sourceSettings, sourcePosSettings, sourceUtil] = await Promise.all([
          ManpowerPlanSettings.findOne({ planId: source._id }).lean(),
          ManpowerPositionSettings.find({ planId: source._id }).lean(),
          ManpowerFleetUtilization.find({ planId: source._id }).lean(),
        ])
        if (sourceSettings) {
          await ManpowerPlanSettings.updateOne(
            { planId: id },
            {
              $set: {
                wetLeaseActive: sourceSettings.wetLeaseActive,
                naOtherIsDrain: sourceSettings.naOtherIsDrain,
                updatedAt: now,
              },
            },
          )
        }
        if (sourcePosSettings.length > 0) {
          await ManpowerPositionSettings.insertMany(
            sourcePosSettings.map((s) => ({
              _id: crypto.randomUUID(),
              planId: id,
              positionId: s.positionId,
              operatorId,
              bhTarget: s.bhTarget,
              naSick: s.naSick,
              naAnnual: s.naAnnual,
              naTraining: s.naTraining,
              naMaternity: s.naMaternity,
              naAttrition: s.naAttrition,
              naOther: s.naOther,
              updatedAt: now,
            })),
          )
        }
        if (sourceUtil.length > 0) {
          await ManpowerFleetUtilization.insertMany(
            sourceUtil.map((u) => ({
              _id: crypto.randomUUID(),
              planId: id,
              operatorId,
              aircraftTypeIcao: u.aircraftTypeIcao,
              dailyUtilizationHours: u.dailyUtilizationHours,
              updatedAt: now,
            })),
          )
        }
      }
    }
    return reply.code(201).send(plan.toObject())
  })

  app.patch('/manpower/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = planUpdateSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await ManpowerPlan.findOneAndUpdate(
      { _id: id, operatorId },
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Plan not found' })
    return doc
  })

  app.delete('/manpower/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const plan = await ManpowerPlan.findOne({ _id: id, operatorId }).lean()
    if (!plan) return reply.code(404).send({ error: 'Plan not found' })
    if (plan.isBasePlan) return reply.code(400).send({ error: 'Cannot delete base plan' })
    await Promise.all([
      ManpowerPlan.deleteOne({ _id: id, operatorId }),
      ManpowerPlanSettings.deleteOne({ planId: id }),
      ManpowerPositionSettings.deleteMany({ planId: id }),
      ManpowerFleetOverride.deleteMany({ planId: id }),
      ManpowerFleetUtilization.deleteMany({ planId: id }),
      ManpowerEvent.deleteMany({ planId: id }),
    ])
    return { success: true }
  })

  // ─── Settings ────────────────────────────────────────────
  app.get('/manpower/plans/:id/settings', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const plan = await ManpowerPlan.exists({ _id: id, operatorId })
    if (!plan) return reply.code(404).send({ error: 'Plan not found' })
    const [settings, positionSettings] = await Promise.all([
      ManpowerPlanSettings.findOne({ planId: id }).lean(),
      ManpowerPositionSettings.find({ planId: id }).lean(),
    ])
    return { settings, positionSettings }
  })

  app.put('/manpower/plans/:id/settings', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = planSettingsSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    await ManpowerPlanSettings.updateOne(
      { planId: id },
      {
        $set: { ...parsed.data, updatedAt: new Date().toISOString() },
        $setOnInsert: { _id: id, planId: id, operatorId },
      },
      { upsert: true },
    )
    return ManpowerPlanSettings.findOne({ planId: id }).lean()
  })

  app.put('/manpower/plans/:id/position-settings/:positionId', async (req, reply) => {
    const { id, positionId } = req.params as { id: string; positionId: string }
    const operatorId = req.operatorId
    const parsed = positionSettingsSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    await ManpowerPositionSettings.updateOne(
      { planId: id, positionId },
      {
        $set: { ...parsed.data, updatedAt: new Date().toISOString() },
        $setOnInsert: { _id: crypto.randomUUID(), planId: id, positionId, operatorId },
      },
      { upsert: true },
    )
    return ManpowerPositionSettings.findOne({ planId: id, positionId }).lean()
  })

  // ─── Fleet overrides ─────────────────────────────────────
  app.get('/manpower/plans/:id/fleet-overrides', async (req) => {
    const { id } = req.params as { id: string }
    const { year } = req.query as { year?: string }
    const filter: Record<string, unknown> = { planId: id }
    if (year) filter.planYear = Number(year)
    return ManpowerFleetOverride.find(filter).lean()
  })

  app.put('/manpower/plans/:id/fleet-overrides', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = fleetOverrideSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const now = new Date().toISOString()
    await ManpowerFleetOverride.updateOne(
      {
        planId: id,
        aircraftTypeIcao: parsed.data.aircraftTypeIcao,
        monthIndex: parsed.data.monthIndex,
        planYear: parsed.data.planYear,
      },
      {
        $set: { acCount: parsed.data.acCount, updatedAt: now },
        $setOnInsert: { _id: crypto.randomUUID(), operatorId, createdAt: now },
      },
      { upsert: true },
    )
    return ManpowerFleetOverride.findOne({
      planId: id,
      aircraftTypeIcao: parsed.data.aircraftTypeIcao,
      monthIndex: parsed.data.monthIndex,
      planYear: parsed.data.planYear,
    }).lean()
  })

  app.delete('/manpower/plans/:id/fleet-overrides/:overrideId', async (req) => {
    const { id, overrideId } = req.params as { id: string; overrideId: string }
    await ManpowerFleetOverride.deleteOne({ _id: overrideId, planId: id })
    return { success: true }
  })

  // ─── Fleet utilisation ───────────────────────────────────
  app.get('/manpower/plans/:id/fleet-utilization', async (req) => {
    const { id } = req.params as { id: string }
    return ManpowerFleetUtilization.find({ planId: id }).lean()
  })

  app.put('/manpower/plans/:id/fleet-utilization', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = fleetUtilizationSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const now = new Date().toISOString()
    await ManpowerFleetUtilization.updateOne(
      { planId: id, aircraftTypeIcao: parsed.data.aircraftTypeIcao },
      {
        $set: { dailyUtilizationHours: parsed.data.dailyUtilizationHours, updatedAt: now },
        $setOnInsert: { _id: crypto.randomUUID(), operatorId },
      },
      { upsert: true },
    )
    return ManpowerFleetUtilization.findOne({
      planId: id,
      aircraftTypeIcao: parsed.data.aircraftTypeIcao,
    }).lean()
  })

  // ─── Events ──────────────────────────────────────────────
  app.get('/manpower/plans/:id/events', async (req) => {
    const { id } = req.params as { id: string }
    const { year } = req.query as { year?: string }
    const filter: Record<string, unknown> = { planId: id }
    if (year) filter.planYear = Number(year)
    return ManpowerEvent.find(filter).sort({ monthIndex: 1 }).lean()
  })

  app.post('/manpower/plans/:id/events', async (req, reply) => {
    const { id } = req.params as { id: string }
    const operatorId = req.operatorId
    const parsed = eventSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const now = new Date().toISOString()
    const doc = await ManpowerEvent.create({
      _id: crypto.randomUUID(),
      planId: id,
      operatorId,
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    })
    return reply.code(201).send(doc.toObject())
  })

  app.patch('/manpower/plans/:id/events/:eventId', async (req, reply) => {
    const { id, eventId } = req.params as { id: string; eventId: string }
    const parsed = eventSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Validation', details: parsed.error.issues })
    const doc = await ManpowerEvent.findOneAndUpdate(
      { _id: eventId, planId: id },
      { $set: { ...parsed.data, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean()
    if (!doc) return reply.code(404).send({ error: 'Event not found' })
    return doc
  })

  app.delete('/manpower/plans/:id/events/:eventId', async (req) => {
    const { id, eventId } = req.params as { id: string; eventId: string }
    await ManpowerEvent.deleteOne({ _id: eventId, planId: id })
    return { success: true }
  })

  // ─── Derived views ───────────────────────────────────────
  // GET /manpower/plans/:id/schedule-bh?year= — aggregate block hours by
  // aircraft type × month from the operator's active scheduled flights,
  // SSIM-expanding the daysOfWeek pattern across each flight's effective
  // window. Falls back to STA−STD (with day-offset) when blockMinutes is
  // not stored on the flight row.
  app.get('/manpower/plans/:id/schedule-bh', async (req) => {
    const operatorId = req.operatorId
    const { year } = req.query as { year?: string }
    const planYear = Number(year) || new Date().getFullYear() + 1
    const flights = await ScheduledFlight.find(
      { operatorId, status: 'active', scenarioId: null },
      {
        aircraftTypeIcao: 1,
        blockMinutes: 1,
        stdUtc: 1,
        staUtc: 1,
        departureDayOffset: 1,
        arrivalDayOffset: 1,
        daysOfWeek: 1,
        effectiveFrom: 1,
        effectiveUntil: 1,
      },
    ).lean()

    const result: Record<string, number[]> = {}
    const start = Date.UTC(planYear, 0, 1)
    const end = Date.UTC(planYear, 11, 31, 23, 59, 59)
    const DAY_MS = 86_400_000

    const hhmmToMin = (s: string | null | undefined): number | null => {
      if (!s) return null
      const [h, m] = s.split(':').map(Number)
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null
      return h * 60 + m
    }

    for (const f of flights) {
      if (!f.aircraftTypeIcao) continue
      // Derive block minutes: prefer stored value, else STA − STD with
      // day-offset (mod 1440 to handle overnight).
      let blockMin = f.blockMinutes ?? 0
      if (!blockMin) {
        const dep = hhmmToMin(f.stdUtc)
        const arr = hhmmToMin(f.staUtc)
        if (dep === null || arr === null) continue
        const depOff = (f.departureDayOffset ?? 1) - 1
        const arrOff = (f.arrivalDayOffset ?? 1) - 1
        const diff = arr + arrOff * 1440 - (dep + depOff * 1440)
        blockMin = diff > 0 ? diff : diff + 1440
      }
      if (!blockMin || blockMin <= 0) continue

      const effFrom = Date.parse(f.effectiveFrom)
      const effUntil = Date.parse(f.effectiveUntil)
      if (!Number.isFinite(effFrom) || !Number.isFinite(effUntil)) continue
      const rangeStart = Math.max(start, effFrom)
      const rangeEnd = Math.min(end, effUntil)
      if (rangeStart > rangeEnd) continue
      const dop = f.daysOfWeek
      const bh = blockMin / 60
      if (!result[f.aircraftTypeIcao]) result[f.aircraftTypeIcao] = new Array(12).fill(0)

      for (let ts = rangeStart; ts <= rangeEnd; ts += DAY_MS) {
        const d = new Date(ts)
        const jsDay = d.getUTCDay()
        const ssimIdx = jsDay === 0 ? 6 : jsDay - 1
        const char = dop[ssimIdx]
        if (!char || char === '0' || char === ' ' || char === '.') continue
        result[f.aircraftTypeIcao][d.getUTCMonth()] += bh
      }
    }
    return result
  })

  // GET /manpower/plans/:id/crew-headcount?year= — live headcount by
  // positionName × aircraftType × month, respecting employmentDate.
  app.get('/manpower/plans/:id/crew-headcount', async (req) => {
    const operatorId = req.operatorId
    const { year } = req.query as { year?: string }
    const planYear = Number(year) || new Date().getFullYear() + 1

    const [members, quals, positions] = await Promise.all([
      CrewMember.find({ operatorId, status: 'active' }, { _id: 1, position: 1, employmentDate: 1 }).lean(),
      CrewQualification.find({ operatorId, endDate: null }, { crewId: 1, aircraftType: 1 }).lean(),
      CrewPosition.find({ operatorId }, { _id: 1, name: 1, code: 1 }).lean(),
    ])

    const posName = new Map<string, string>(positions.map((p) => [p._id as string, p.name]))
    const memberById = new Map(members.map((m) => [m._id as string, m]))

    // posName -> icao -> number[12]
    const result: Record<string, Record<string, number[]>> = {}

    const monthStarts: number[] = Array.from({ length: 12 }, (_, i) => Date.UTC(planYear, i, 1))
    const yearEnd = Date.UTC(planYear, 11, 31, 23, 59, 59)

    // For each qualification (crew × aircraftType), add the crew member to
    // each month they've been employed by month-end.
    for (const q of quals) {
      const member = memberById.get(q.crewId)
      if (!member || !member.position) continue
      const pName = posName.get(member.position)
      if (!pName) continue
      const empTime = member.employmentDate ? Date.parse(member.employmentDate) : 0
      if (!result[pName]) result[pName] = {}
      if (!result[pName][q.aircraftType]) result[pName][q.aircraftType] = new Array(12).fill(0)
      for (let m = 0; m < 12; m++) {
        const monthEnd = m < 11 ? monthStarts[m + 1] - 1 : yearEnd
        if (empTime <= monthEnd) {
          result[pName][q.aircraftType][m] += 1
        }
      }
    }
    return result
  })

  // GET /manpower/plans/:id/monthly-ac-count?year= — active aircraft per
  // month using dateOfDelivery. Resolves ICAO by joining AircraftType —
  // `AircraftRegistration` stores `aircraftTypeId`, not `aircraftTypeIcao`.
  app.get('/manpower/plans/:id/monthly-ac-count', async (req) => {
    const operatorId = req.operatorId
    const { year } = req.query as { year?: string }
    const planYear = Number(year) || new Date().getFullYear() + 1

    const [regs, types] = await Promise.all([
      AircraftRegistration.find({ operatorId, isActive: true }, { aircraftTypeId: 1, dateOfDelivery: 1 }).lean(),
      AircraftType.find({ operatorId }, { _id: 1, icaoType: 1 }).lean(),
    ])
    const icaoById = new Map<string, string>(types.map((t) => [t._id as string, t.icaoType]))

    const result: Record<string, number[]> = {}
    const monthEnds: number[] = Array.from({ length: 12 }, (_, m) =>
      m < 11 ? Date.UTC(planYear, m + 1, 1) - 1 : Date.UTC(planYear, 11, 31, 23, 59, 59),
    )
    for (const r of regs) {
      const icao = r.aircraftTypeId ? icaoById.get(r.aircraftTypeId) : undefined
      if (!icao) continue
      if (!result[icao]) result[icao] = new Array(12).fill(0)
      // If delivery date is unset, assume the aircraft is already in the
      // fleet for the whole plan year.
      const dod = r.dateOfDelivery ? Date.parse(r.dateOfDelivery) : 0
      for (let m = 0; m < 12; m++) {
        if (dod <= monthEnds[m]) result[icao][m] += 1
      }
    }
    return result
  })

  // GET /manpower/plans/:id/standard-complements — wrap CrewComplement
  // standard template as { icao: { posCode: count } }.
  app.get('/manpower/plans/:id/standard-complements', async (req) => {
    const operatorId = req.operatorId
    const complements = await CrewComplement.find({
      operatorId,
      templateKey: 'standard',
      isActive: { $ne: false },
    }).lean()
    const result: Record<string, Record<string, number>> = {}
    for (const c of complements) {
      const icao = (c as { aircraftTypeIcao?: string | null }).aircraftTypeIcao
      if (!icao) continue
      const counts = (c as { counts?: Record<string, number> | Map<string, number> }).counts
      const obj: Record<string, number> = {}
      if (counts) {
        if (counts instanceof Map) {
          counts.forEach((v, k) => (obj[k] = v))
        } else {
          Object.assign(obj, counts)
        }
      }
      result[icao] = obj
    }
    return result
  })
}
