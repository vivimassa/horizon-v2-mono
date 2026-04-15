import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { DisruptionIssue } from '../models/DisruptionIssue.js'
import { DisruptionIssueActivity } from '../models/DisruptionIssueActivity.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { MaintenanceEvent } from '../models/MaintenanceEvent.js'
import { AircraftRegistration } from '../models/AircraftRegistration.js'
import { AircraftType } from '../models/AircraftType.js'
import { Airport } from '../models/Airport.js'
import {
  detectSignals,
  type DetectorFlight,
  type DetectorInput,
  type DetectorMaintenanceEvent,
  type DisruptionSignal,
} from '@skyhub/logic/src/disruption/index'

// ── Helpers ──

type ActivityAction = 'created' | 'assigned' | 'started' | 'commented' | 'resolved' | 'closed' | 'hidden' | 'linked'

interface Actor {
  userId?: string | null
  userName?: string | null
}

function actorFromReq(req: FastifyRequest): Actor {
  // JWT payload shape set by registerAuthMiddleware — be defensive
  const user = (req as unknown as { user?: { sub?: string; name?: string; email?: string } }).user
  return {
    userId: user?.sub ?? null,
    userName: user?.name ?? user?.email ?? null,
  }
}

async function logActivity(params: {
  issueId: string
  operatorId: string
  actionType: ActivityAction
  actionDetail?: string | null
  previousStatus?: string | null
  newStatus?: string | null
  actor: Actor
}): Promise<void> {
  await DisruptionIssueActivity.create({
    _id: crypto.randomUUID(),
    issueId: params.issueId,
    operatorId: params.operatorId,
    userId: params.actor.userId ?? null,
    userName: params.actor.userName ?? null,
    actionType: params.actionType,
    actionDetail: params.actionDetail ?? null,
    previousStatus: params.previousStatus ?? null,
    newStatus: params.newStatus ?? null,
    createdAt: new Date().toISOString(),
  })
}

// ── Zod schemas ──

const listQuerySchema = z.object({
  operatorId: z.string().min(1),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  severity: z.string().optional(),
  station: z.string().optional(),
  flightNumber: z.string().optional(),
  includeHidden: z.coerce.boolean().optional(),
})

const createSchema = z.object({
  operatorId: z.string().min(1),
  flightNumber: z.string().nullable().optional(),
  forDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  depStation: z.string().nullable().optional(),
  arrStation: z.string().nullable().optional(),
  tail: z.string().nullable().optional(),
  aircraftType: z.string().nullable().optional(),
  category: z.enum([
    'TAIL_SWAP',
    'DELAY',
    'CANCELLATION',
    'DIVERSION',
    'CONFIG_CHANGE',
    'MISSING_OOOI',
    'MAINTENANCE_RISK',
    'CURFEW_VIOLATION',
    'TAT_VIOLATION',
  ]),
  source: z.enum(['IROPS_AUTO', 'ML_PREDICTION', 'MANUAL']).default('IROPS_AUTO'),
  severity: z.enum(['critical', 'warning', 'info']).default('warning'),
  score: z.number().min(0).max(1).nullable().optional(),
  reasons: z.array(z.string()).optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  linkedModuleCode: z.string().nullable().optional(),
  linkedEntityId: z.string().nullable().optional(),
  sourceAlertId: z.string().nullable().optional(),
  sourcePredictionFlight: z.string().nullable().optional(),
})

const commentSchema = z.object({ text: z.string().min(1) })
const resolveSchema = z.object({
  resolutionType: z.string().min(1),
  resolutionNotes: z.string().optional(),
})

/**
 * Sync request body — a batch of signals from the rule engine. Upserts by
 * (operatorId, sourceAlertId) so repeated detector runs do not create
 * duplicate issues.
 */
const syncSchema = z.object({
  operatorId: z.string().min(1),
  signals: z.array(createSchema.omit({ operatorId: true })),
})

const scanSchema = z.object({
  operatorId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  referenceTimeUtc: z.string().optional(),
  persist: z.boolean().optional().default(true),
})

function timeStringToMs(time: string): number {
  const clean = time.replace(':', '')
  const h = parseInt(clean.slice(0, 2), 10) || 0
  const m = parseInt(clean.slice(2, 4), 10) || 0
  return (h * 60 + m) * 60_000
}

function mapSignalToIssueFields(s: DisruptionSignal): Record<string, unknown> {
  return {
    flightNumber: s.flightNumber,
    forDate: s.forDate,
    depStation: s.depStation,
    arrStation: s.arrStation,
    tail: s.tail,
    aircraftType: s.aircraftType,
    category: s.category,
    source: s.source,
    severity: s.severity,
    score: s.score,
    reasons: s.reasons,
    title: s.title,
    description: s.description,
    sourceAlertId: s.sourceAlertId,
  }
}

// ── Routes ──

export async function disruptionRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /disruptions — list with filters ──
  app.get('/disruptions', async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const q = parsed.data
    const filter: Record<string, unknown> = { operatorId: q.operatorId }
    if (!q.includeHidden) filter.hidden = { $ne: true }
    if (q.status) filter.status = q.status
    if (q.category) filter.category = q.category
    if (q.severity) filter.severity = q.severity
    if (q.flightNumber) filter.flightNumber = q.flightNumber
    if (q.from || q.to) {
      const range: Record<string, unknown> = {}
      if (q.from) range.$gte = q.from
      if (q.to) range.$lte = q.to
      filter.forDate = range
    }
    if (q.station) {
      filter.$or = [{ depStation: q.station }, { arrStation: q.station }]
    }

    const rows = await DisruptionIssue.find(filter).sort({ forDate: -1, createdAt: -1 }).limit(500).lean()
    return rows
  })

  // ── GET /disruptions/:id — detail + activity ──
  app.get('/disruptions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const issue = await DisruptionIssue.findById(id).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })
    const activity = await DisruptionIssueActivity.find({ issueId: id }).sort({ createdAt: 1 }).lean()
    return { issue, activity }
  })

  // ── POST /disruptions — manual create ──
  app.post('/disruptions', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await DisruptionIssue.create({
      _id: id,
      ...parsed.data,
      source: parsed.data.source ?? 'MANUAL',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
    await logActivity({
      issueId: id,
      operatorId: parsed.data.operatorId,
      actionType: 'created',
      newStatus: 'open',
      actor: actorFromReq(req),
    })
    return reply.code(201).send({ id })
  })

  // ── POST /disruptions/sync — bulk upsert from rule engine ──
  app.post('/disruptions/sync', async (req, reply) => {
    const parsed = syncSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const { operatorId, signals } = parsed.data
    const now = new Date().toISOString()
    let created = 0
    let updated = 0

    for (const s of signals) {
      const alertId = s.sourceAlertId
      if (!alertId) continue // unidentified signals cannot be deduped — skip
      const existing = await DisruptionIssue.findOne({ operatorId, sourceAlertId: alertId }).lean()
      if (existing) {
        await DisruptionIssue.updateOne(
          { _id: existing._id },
          {
            $set: {
              severity: s.severity,
              score: s.score ?? null,
              reasons: s.reasons ?? [],
              title: s.title,
              description: s.description ?? null,
              updatedAt: now,
            },
          },
        )
        updated++
      } else {
        const id = crypto.randomUUID()
        await DisruptionIssue.create({
          _id: id,
          operatorId,
          ...s,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        })
        await logActivity({
          issueId: id,
          operatorId,
          actionType: 'created',
          newStatus: 'open',
          actor: actorFromReq(req),
        })
        created++
      }
    }

    return { created, updated }
  })

  // ── POST /disruptions/:id/claim — assign to current user ──
  app.post('/disruptions/:id/claim', async (req, reply) => {
    const { id } = req.params as { id: string }
    const issue = await DisruptionIssue.findById(id).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })
    const actor = actorFromReq(req)
    const now = new Date().toISOString()
    await DisruptionIssue.updateOne(
      { _id: id },
      {
        $set: {
          status: 'assigned',
          assignedTo: actor.userId,
          assignedToName: actor.userName,
          assignedBy: actor.userId,
          assignedByName: actor.userName,
          assignedAt: now,
          updatedAt: now,
        },
      },
    )
    await logActivity({
      issueId: id,
      operatorId: issue.operatorId,
      actionType: 'assigned',
      previousStatus: issue.status,
      newStatus: 'assigned',
      actor,
    })
    return { ok: true }
  })

  // ── POST /disruptions/:id/start — assigned → in_progress ──
  app.post('/disruptions/:id/start', async (req, reply) => {
    const { id } = req.params as { id: string }
    const issue = await DisruptionIssue.findById(id).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })
    await DisruptionIssue.updateOne(
      { _id: id },
      { $set: { status: 'in_progress', updatedAt: new Date().toISOString() } },
    )
    await logActivity({
      issueId: id,
      operatorId: issue.operatorId,
      actionType: 'started',
      previousStatus: issue.status,
      newStatus: 'in_progress',
      actor: actorFromReq(req),
    })
    return { ok: true }
  })

  // ── POST /disruptions/:id/resolve — mark resolved ──
  app.post('/disruptions/:id/resolve', async (req, reply) => {
    const parsed = resolveSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const { id } = req.params as { id: string }
    const issue = await DisruptionIssue.findById(id).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })
    const actor = actorFromReq(req)
    const now = new Date().toISOString()
    await DisruptionIssue.updateOne(
      { _id: id },
      {
        $set: {
          status: 'resolved',
          resolvedAt: now,
          resolvedBy: actor.userId,
          resolvedByName: actor.userName,
          resolutionType: parsed.data.resolutionType,
          resolutionNotes: parsed.data.resolutionNotes ?? null,
          updatedAt: now,
        },
      },
    )
    await logActivity({
      issueId: id,
      operatorId: issue.operatorId,
      actionType: 'resolved',
      actionDetail: parsed.data.resolutionType,
      previousStatus: issue.status,
      newStatus: 'resolved',
      actor,
    })
    return { ok: true }
  })

  // ── POST /disruptions/:id/close — resolved → closed ──
  app.post('/disruptions/:id/close', async (req, reply) => {
    const { id } = req.params as { id: string }
    const issue = await DisruptionIssue.findById(id).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })
    const actor = actorFromReq(req)
    const now = new Date().toISOString()
    await DisruptionIssue.updateOne(
      { _id: id },
      {
        $set: {
          status: 'closed',
          closedAt: now,
          closedBy: actor.userId,
          closedByName: actor.userName,
          updatedAt: now,
        },
      },
    )
    await logActivity({
      issueId: id,
      operatorId: issue.operatorId,
      actionType: 'closed',
      previousStatus: issue.status,
      newStatus: 'closed',
      actor,
    })
    return { ok: true }
  })

  // ── POST /disruptions/:id/hide — soft-dismiss ──
  app.post('/disruptions/:id/hide', async (req, reply) => {
    const { id } = req.params as { id: string }
    const issue = await DisruptionIssue.findById(id).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })
    await DisruptionIssue.updateOne({ _id: id }, { $set: { hidden: true, updatedAt: new Date().toISOString() } })
    await logActivity({
      issueId: id,
      operatorId: issue.operatorId,
      actionType: 'hidden',
      actor: actorFromReq(req),
    })
    return { ok: true }
  })

  // ── POST /disruptions/scan — run rule engine, upsert issues ──
  app.post('/disruptions/scan', async (req, reply) => {
    const parsed = scanSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const { operatorId, from, to, referenceTimeUtc, persist } = parsed.data
    const refStr = referenceTimeUtc?.trim() || null
    const parsedRef = refStr ? new Date(refStr.endsWith('Z') ? refStr : refStr + 'Z').getTime() : NaN
    const nowMs = !isNaN(parsedRef) ? parsedRef : Date.now()

    const [instances, maint, regs, acTypes, airports] = await Promise.all([
      FlightInstance.find({ operatorId, operatingDate: { $gte: from, $lte: to } }).lean(),
      MaintenanceEvent.find({
        operatorId,
        status: { $in: ['planned', 'confirmed', 'in_progress'] },
      }).lean(),
      AircraftRegistration.find({ operatorId, isActive: true }).lean(),
      AircraftType.find({ operatorId, isActive: true }).lean(),
      Airport.find({ operatorId, isActive: true }).lean(),
    ])

    const regByTail = new Map(regs.map((r) => [r.registration as string, r]))
    const regById = new Map(regs.map((r) => [r._id as string, r]))
    const acTypeById = new Map(acTypes.map((t) => [t._id, t]))

    const tatByAircraftType: Record<string, number> = {}
    for (const t of acTypes) {
      const tat = (t as { tat?: { defaultMinutes?: number } }).tat
      if (t.icaoType && tat?.defaultMinutes) tatByAircraftType[t.icaoType as string] = tat.defaultMinutes
    }

    const todayStr = new Date(nowMs).toISOString().slice(0, 10)
    const curfewByIata: Record<string, { startRelativeMs: number; endRelativeMs: number }> = {}
    for (const apt of airports) {
      const a = apt as unknown as {
        iataCode?: string
        utcOffsetHours?: number
        curfews?: Array<{
          startTime: string
          endTime: string
          effectiveFrom?: string | null
          effectiveUntil?: string | null
        }>
      }
      const active = a.curfews?.find((c) => {
        if (c.effectiveFrom && todayStr < c.effectiveFrom) return false
        if (c.effectiveUntil && todayStr > c.effectiveUntil) return false
        return true
      })
      if (!active || !a.iataCode) continue
      const offsetMs = (a.utcOffsetHours ?? 0) * 3_600_000
      curfewByIata[a.iataCode] = {
        startRelativeMs: timeStringToMs(active.startTime) - offsetMs,
        endRelativeMs: timeStringToMs(active.endTime) - offsetMs,
      }
    }

    const flights: DetectorFlight[] = instances.map((inst) => {
      const reg = inst.tail?.registration ? regByTail.get(inst.tail.registration as string) : null
      const acType = reg?.aircraftTypeId ? acTypeById.get(reg.aircraftTypeId as string) : null
      return {
        id: inst._id as string,
        flightNumber: inst.flightNumber as string,
        operatingDate: inst.operatingDate as string,
        depIata: (inst.dep?.iata as string) ?? null,
        arrIata: (inst.arr?.iata as string) ?? null,
        stdUtcMs: (inst.schedule?.stdUtc as number) ?? null,
        staUtcMs: (inst.schedule?.staUtc as number) ?? null,
        etdUtcMs: (inst.estimated?.etdUtc as number) ?? null,
        etaUtcMs: (inst.estimated?.etaUtc as number) ?? null,
        atdUtcMs: (inst.actual?.atdUtc as number) ?? null,
        ataUtcMs: (inst.actual?.ataUtc as number) ?? null,
        scheduledTail: null,
        actualTail: (inst.tail?.registration as string) ?? null,
        aircraftTypeIcao: (acType?.icaoType as string) ?? (inst.tail?.icaoType as string) ?? null,
        status: (inst.status as string) ?? 'scheduled',
        scheduledFlightId: (inst.scheduledFlightId as string) ?? null,
      }
    })

    const maintenance: DetectorMaintenanceEvent[] = maint.map((m) => {
      const reg = regById.get(m.aircraftId as string)
      return {
        aircraftId: m.aircraftId as string,
        tail: (reg?.registration as string) ?? null,
        plannedStartUtc: m.plannedStartUtc as string,
        plannedEndUtc: (m.plannedEndUtc as string) ?? null,
        status: m.status as string,
      }
    })

    const input: DetectorInput = {
      operatorId,
      nowMs,
      flights,
      maintenance,
      curfewByIata,
      tatByAircraftType,
    }
    const signals = detectSignals(input)

    if (!persist) return { signals }

    // Upsert into disruption_issues — reuses /sync logic
    const now = new Date().toISOString()
    let created = 0
    let updated = 0
    for (const s of signals) {
      const existing = await DisruptionIssue.findOne({ operatorId, sourceAlertId: s.sourceAlertId }).lean()
      const fields = mapSignalToIssueFields(s)
      if (existing) {
        await DisruptionIssue.updateOne({ _id: existing._id }, { $set: { ...fields, updatedAt: now } })
        updated++
      } else {
        const id = crypto.randomUUID()
        await DisruptionIssue.create({
          _id: id,
          operatorId,
          ...fields,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        })
        await logActivity({
          issueId: id,
          operatorId,
          actionType: 'created',
          newStatus: 'open',
          actor: actorFromReq(req),
        })
        created++
      }
    }

    return { signals, created, updated }
  })

  // ── POST /disruptions/:id/comment — append comment to activity log ──
  app.post('/disruptions/:id/comment', async (req, reply) => {
    const parsed = commentSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const { id } = req.params as { id: string }
    const issue = await DisruptionIssue.findById(id).lean()
    if (!issue) return reply.code(404).send({ error: 'Disruption issue not found' })
    await logActivity({
      issueId: id,
      operatorId: issue.operatorId,
      actionType: 'commented',
      actionDetail: parsed.data.text,
      actor: actorFromReq(req),
    })
    return { ok: true }
  })
}
