import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ScheduledFlight } from '../models/ScheduledFlight.js'
import { ScheduleMessageLog } from '../models/ScheduleMessageLog.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { AircraftType } from '../models/AircraftType.js'
import { AsmSsmConsumer } from '../models/AsmSsmConsumer.js'
import { computeScheduleDiff } from '../utils/schedule-diff-engine.js'
import { computeAsmDiff, findNeutralizablePairs } from '@skyhub/logic/src/messaging/asm-diff-engine'
import { generateAsmMessage } from '@skyhub/logic/src/messaging/asm-parser'
import type { InstanceSnapshot, AsmDiffResult, HeldMessageRef } from '@skyhub/types'

// ── Zod Schemas ────────────────────────────────────────────

const operatorQuery = z.object({ operatorId: z.string().min(1) })

const messageLogQuery = z.object({
  operatorId: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']).optional(),
  actionCodes: z.string().optional(),
  messageTypes: z.string().optional(),
  status: z.string().optional(),
  flightNumber: z.string().optional(),
  flightDateFrom: z.string().optional(),
  flightDateTo: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const messageCreateSchema = z.object({
  operatorId: z.string().min(1),
  messageType: z.enum(['ASM', 'SSM']),
  actionCode: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  status: z.string().optional().default('pending'),
  flightNumber: z.string().nullable().optional(),
  flightDate: z.string().nullable().optional(),
  depStation: z.string().nullable().optional(),
  arrStation: z.string().nullable().optional(),
  seasonCode: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  rawMessage: z.string().nullable().optional(),
  changes: z.any().nullable().optional(),
  rejectReason: z.string().nullable().optional(),
})

const statusUpdateSchema = z.object({
  status: z.enum(['held', 'pending', 'sent', 'applied', 'rejected', 'discarded', 'neutralized']),
  rejectReason: z.string().nullable().optional(),
})

const holdBatchSchema = z.object({
  operatorId: z.string().min(1),
  before: z.array(
    z.object({
      id: z.string(),
      flightNumber: z.string(),
      instanceDate: z.string(),
      depStation: z.string(),
      arrStation: z.string(),
      stdUtc: z.string(),
      staUtc: z.string(),
      aircraftTypeIcao: z.string(),
      status: z.string(),
    }),
  ),
  after: z.array(
    z.object({
      id: z.string(),
      flightNumber: z.string(),
      instanceDate: z.string(),
      depStation: z.string(),
      arrStation: z.string(),
      stdUtc: z.string(),
      staUtc: z.string(),
      aircraftTypeIcao: z.string(),
      status: z.string(),
    }),
  ),
  operatorIataCode: z.string().min(1).max(3),
})

const batchIdsSchema = z.object({
  messageIds: z.array(z.string().min(1)),
})

const applyInboundSchema = z.object({
  messageId: z.string().min(1),
  actionCode: z.string().min(1),
  flightNumber: z.string().min(1),
  flightDate: z.string().min(1),
  changes: z.record(
    z.string(),
    z.object({
      from: z.string().optional(),
      to: z.string(),
    }),
  ),
})

// ── Routes ─────────────────────────────────────────────────

export async function scheduleMessageRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /schedule-messages — Paginated message log ──
  app.get('/schedule-messages', async (req, reply) => {
    const q = messageLogQuery.parse(req.query)

    const filter: Record<string, unknown> = {
      operatorId: q.operatorId,
      status: { $nin: ['neutralized'] },
    }

    if (q.direction) filter.direction = q.direction
    if (q.status) filter.status = q.status
    if (q.actionCodes) filter.actionCode = { $in: q.actionCodes.split(',') }
    if (q.messageTypes) {
      filter.messageType = { $in: q.messageTypes.split(',') }
    }
    if (q.flightNumber) {
      filter.flightNumber = { $regex: q.flightNumber, $options: 'i' }
    }
    if (q.flightDateFrom || q.flightDateTo) {
      const dateFilter: Record<string, string> = {}
      if (q.flightDateFrom) dateFilter.$gte = q.flightDateFrom
      if (q.flightDateTo) dateFilter.$lte = q.flightDateTo
      filter.flightDate = dateFilter
    }
    if (q.search) {
      filter.$or = [
        { summary: { $regex: q.search, $options: 'i' } },
        { flightNumber: { $regex: q.search, $options: 'i' } },
      ]
    }

    const [messages, total] = await Promise.all([
      ScheduleMessageLog.find(filter).sort({ createdAtUtc: -1 }).skip(q.offset).limit(q.limit).lean(),
      ScheduleMessageLog.countDocuments(filter),
    ])

    return { messages, total }
  })

  // ── GET /schedule-messages/stats — Aggregate counts ──
  app.get('/schedule-messages/stats', async (req, reply) => {
    const { operatorId } = operatorQuery.parse(req.query)

    const docs = await ScheduleMessageLog.find({ operatorId }, { status: 1, createdAtUtc: 1 }).lean()

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoIso = weekAgo.toISOString()

    return {
      total: docs.length,
      held: docs.filter((d) => d.status === 'held').length,
      pending: docs.filter((d) => d.status === 'pending').length,
      sent: docs.filter((d) => d.status === 'sent').length,
      applied: docs.filter((d) => d.status === 'applied').length,
      rejected: docs.filter((d) => d.status === 'rejected').length,
      thisWeek: docs.filter((d) => (d.createdAtUtc || '') > weekAgoIso).length,
    }
  })

  // ── GET /schedule-messages/held — All held outbound messages ──
  app.get('/schedule-messages/held', async (req, reply) => {
    const { operatorId } = operatorQuery.parse(req.query)

    const messages = await ScheduleMessageLog.find({
      operatorId,
      status: 'held',
      direction: 'outbound',
    })
      .sort({ createdAtUtc: -1 })
      .lean()

    return { messages }
  })

  // ── POST /schedule-messages — Create a single message ──
  app.post('/schedule-messages', async (req, reply) => {
    const data = messageCreateSchema.parse(req.body)
    const now = new Date().toISOString()

    const doc = await ScheduleMessageLog.create({
      _id: crypto.randomUUID(),
      ...data,
      createdAtUtc: now,
      updatedAtUtc: now,
    })

    return { id: doc._id }
  })

  // ── PATCH /schedule-messages/:id/status — Update status ──
  app.patch('/schedule-messages/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status, rejectReason } = statusUpdateSchema.parse(req.body)
    const now = new Date().toISOString()

    const update: Record<string, unknown> = { status, updatedAtUtc: now }
    if (rejectReason) update.rejectReason = rejectReason
    if (status === 'applied' || status === 'rejected') {
      update.processedAtUtc = now
    }

    const doc = await ScheduleMessageLog.findByIdAndUpdate(id, update, { new: true }).lean()
    if (!doc) return reply.code(404).send({ error: 'Message not found' })

    return { ok: true }
  })

  // ── POST /schedule-messages/hold-batch — Diff + hold + neutralize ──
  app.post('/schedule-messages/hold-batch', async (req, reply) => {
    const { operatorId, before, after, operatorIataCode } = holdBatchSchema.parse(req.body)
    const now = new Date().toISOString()

    // Compute diffs
    const diffs = computeAsmDiff(before, after)
    if (diffs.length === 0) return { held: 0 }

    // Generate IATA messages and store as held
    const docs = diffs.map((diff: AsmDiffResult) => {
      const fltNum = diff.flightNumber.replace(/^[A-Z]{2}/, '')
      const raw = generateAsmMessage({
        actionCode: diff.actionCode,
        airline: operatorIataCode,
        flightNumber: fltNum,
        flightDate: diff.flightDate,
        changes: diff.changes,
      })

      return {
        _id: crypto.randomUUID(),
        operatorId,
        messageType: 'ASM' as const,
        actionCode: diff.actionCode,
        direction: 'outbound' as const,
        status: 'held' as const,
        flightNumber: diff.flightNumber,
        flightDate: diff.flightDate,
        summary: diff.summary,
        rawMessage: raw,
        changes: diff.changes,
        createdAtUtc: now,
        updatedAtUtc: now,
      }
    })

    await ScheduleMessageLog.insertMany(docs)

    // Neutralization: find NEW+CNL pairs among all held messages
    const allHeld = await ScheduleMessageLog.find(
      {
        operatorId,
        status: 'held',
        direction: 'outbound',
      },
      { _id: 1, actionCode: 1, flightNumber: 1, flightDate: 1, changes: 1 },
    ).lean()

    const heldRefs: HeldMessageRef[] = allHeld.map((m) => ({
      id: m._id as string,
      actionCode: m.actionCode as string,
      flightNumber: m.flightNumber as string,
      flightDate: m.flightDate as string,
      changes: (m.changes || {}) as Record<string, unknown>,
    }))

    const toNeutralize = findNeutralizablePairs(heldRefs)
    if (toNeutralize.length > 0) {
      await ScheduleMessageLog.updateMany({ _id: { $in: toNeutralize } }, { status: 'neutralized', updatedAtUtc: now })
    }

    // Count remaining held (grouped by flight+action+changes)
    const remaining = await ScheduleMessageLog.find(
      {
        operatorId,
        status: 'held',
        direction: 'outbound',
      },
      { flightNumber: 1, actionCode: 1, changes: 1 },
    ).lean()

    const keys = new Set(remaining.map((m) => `${m.flightNumber}:${m.actionCode}:${JSON.stringify(m.changes || {})}`))

    return { held: keys.size, neutralized: toNeutralize.length }
  })

  // ── POST /schedule-messages/release — Release held messages ──
  //
  // Fans each message out to every active AsmSsmConsumer for the operator.
  // Each (message × consumer) pair becomes an entry in deliveries[].
  // Message status transitions:
  //   - 0 consumers:       held → sent         (release acts as a no-op fan-out)
  //   - ≥1 consumers:      held → pending      (worker drains SMTP/SFTP; pull_api
  //                                              drains when the consumer polls)
  app.post('/schedule-messages/release', async (req, reply) => {
    const { messageIds } = batchIdsSchema.parse(req.body)
    if (messageIds.length === 0) return { released: 0, pending: 0, sent: 0 }

    const now = new Date().toISOString()

    // Load held messages first so we know the operator(s) involved.
    const heldDocs = await ScheduleMessageLog.find({
      _id: { $in: messageIds },
      status: 'held',
    }).lean()

    if (heldDocs.length === 0) return { released: 0, pending: 0, sent: 0 }

    // Group by operator — typical release is same-operator but we don't assume.
    const byOperator = new Map<string, typeof heldDocs>()
    for (const d of heldDocs) {
      const key = d.operatorId as string
      const arr = byOperator.get(key)
      if (arr) arr.push(d)
      else byOperator.set(key, [d])
    }

    let pending = 0
    let sent = 0

    for (const [operatorId, docs] of byOperator) {
      const consumers = await AsmSsmConsumer.find({ operatorId, active: true }).lean()

      if (consumers.length === 0) {
        // No consumers → just mark sent (legacy behavior for tenants that
        // haven't configured delivery yet).
        const res = await ScheduleMessageLog.updateMany(
          { _id: { $in: docs.map((d) => d._id) }, status: 'held' },
          { $set: { status: 'sent', updatedAtUtc: now } },
        )
        sent += res.modifiedCount
        continue
      }

      // Build deliveries fan-out per message.
      const deliveries = consumers.map((c) => ({
        consumerId: c._id as string,
        consumerName: c.name as string,
        deliveryMode: c.deliveryMode as 'pull_api' | 'sftp' | 'smtp',
        status: 'pending' as const,
        attemptCount: 0,
        lastAttemptAtUtc: null,
        deliveredAtUtc: null,
        errorDetail: null,
        externalRef: null,
      }))

      const res = await ScheduleMessageLog.updateMany(
        { _id: { $in: docs.map((d) => d._id) }, status: 'held' },
        { $set: { status: 'pending', deliveries, updatedAtUtc: now } },
      )
      pending += res.modifiedCount
    }

    return { released: pending + sent, pending, sent }
  })

  // ── POST /schedule-messages/discard — Discard held messages ──
  app.post('/schedule-messages/discard', async (req, reply) => {
    const { messageIds } = batchIdsSchema.parse(req.body)
    if (messageIds.length === 0) return { discarded: 0 }

    const now = new Date().toISOString()
    const result = await ScheduleMessageLog.updateMany(
      { _id: { $in: messageIds }, status: 'held' },
      { status: 'discarded', updatedAtUtc: now },
    )

    return { discarded: result.modifiedCount }
  })

  // ── POST /schedule-messages/apply-inbound — Apply ASM to flight instances ──
  app.post('/schedule-messages/apply-inbound', async (req, reply) => {
    const data = applyInboundSchema.parse(req.body)
    const now = new Date().toISOString()

    // Find matching flight instance(s)
    const instances = await FlightInstance.find({
      flightNumber: data.flightNumber,
      operatingDate: data.flightDate,
    }).lean()

    if (!instances || instances.length === 0) {
      return reply.code(404).send({
        error: `No flight instance found: ${data.flightNumber} on ${data.flightDate}`,
      })
    }

    const instanceIds = instances.map((i) => i._id)

    switch (data.actionCode) {
      case 'CNL': {
        await FlightInstance.updateMany(
          { _id: { $in: instanceIds } },
          { status: 'cancelled', 'syncMeta.updatedAt': Date.now() },
        )
        break
      }
      case 'RIN': {
        await FlightInstance.updateMany(
          { _id: { $in: instanceIds } },
          { status: 'scheduled', 'syncMeta.updatedAt': Date.now() },
        )
        break
      }
      case 'TIM': {
        const update: Record<string, unknown> = { 'syncMeta.updatedAt': Date.now() }
        if (data.changes['std']?.to) {
          const t = data.changes['std'].to
          // Convert HHMM to minutes since midnight
          const mins = parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(2))
          update['schedule.stdUtc'] = mins
        }
        if (data.changes['sta']?.to) {
          const t = data.changes['sta'].to
          const mins = parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(2))
          update['schedule.staUtc'] = mins
        }
        await FlightInstance.updateMany({ _id: { $in: instanceIds } }, update)
        break
      }
      case 'EQT': {
        if (data.changes['aircraft_type']?.to) {
          const typeCode = data.changes['aircraft_type'].to
          const acType = await AircraftType.findOne({
            $or: [{ iataType: typeCode }, { icaoType: typeCode }],
          }).lean()
          if (!acType) {
            return reply.code(400).send({ error: `Unknown aircraft type: ${typeCode}` })
          }
          await FlightInstance.updateMany(
            { _id: { $in: instanceIds } },
            { 'tail.icaoType': acType.icaoType, 'syncMeta.updatedAt': Date.now() },
          )
        }
        break
      }
      case 'RRT': {
        const update: Record<string, unknown> = { 'syncMeta.updatedAt': Date.now() }
        if (data.changes['dep_station']?.to) update['dep.iata'] = data.changes['dep_station'].to
        if (data.changes['arr_station']?.to) update['arr.iata'] = data.changes['arr_station'].to
        if (data.changes['std']?.to) {
          const t = data.changes['std'].to
          update['schedule.stdUtc'] = parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(2))
        }
        if (data.changes['sta']?.to) {
          const t = data.changes['sta'].to
          update['schedule.staUtc'] = parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(2))
        }
        await FlightInstance.updateMany({ _id: { $in: instanceIds } }, update)
        break
      }
      default:
        return reply.code(400).send({ error: `Unsupported action code: ${data.actionCode}` })
    }

    // Mark message as applied
    await ScheduleMessageLog.findByIdAndUpdate(data.messageId, {
      status: 'applied',
      processedAtUtc: now,
      updatedAtUtc: now,
    })

    return { ok: true, instancesUpdated: instanceIds.length }
  })

  // ── POST /schedule-messages/generate — Compare scenarios (existing) ──
  app.post('/schedule-messages/generate', async (req, reply) => {
    const { operatorId, dateFrom, dateTo, targetScenarioId } = req.body as Record<string, string>
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })

    // Period filter — overlap: effectiveUntil >= dateFrom AND effectiveFrom <= dateTo
    const periodFilter: Record<string, unknown> = {}
    if (dateFrom) periodFilter.effectiveUntil = { $gte: dateFrom }
    if (dateTo) periodFilter.effectiveFrom = { $lte: dateTo }

    const baseFilter: Record<string, unknown> = {
      operatorId,
      isActive: { $ne: false },
      scenarioId: null,
      ...periodFilter,
    }

    const targetFilter: Record<string, unknown> = { operatorId, isActive: { $ne: false }, ...periodFilter }
    if (targetScenarioId) targetFilter.scenarioId = targetScenarioId
    else targetFilter.scenarioId = null

    const [baseFlights, targetFlights] = await Promise.all([
      ScheduledFlight.find(baseFilter).lean(),
      ScheduledFlight.find(targetFilter).lean(),
    ])

    const messages = computeScheduleDiff(
      baseFlights.map((f) => ({
        _id: f._id as string,
        flightNumber: `${f.airlineCode}${f.flightNumber}`,
        depStation: f.depStation as string,
        arrStation: f.arrStation as string,
        stdUtc: f.stdUtc as string,
        staUtc: f.staUtc as string,
        aircraftTypeIcao: f.aircraftTypeIcao as string | null,
        daysOfWeek: f.daysOfWeek as string,
        effectiveFrom: f.effectiveFrom as string,
        effectiveUntil: f.effectiveUntil as string,
        status: f.status as string,
      })),
      targetFlights.map((f) => ({
        _id: f._id as string,
        flightNumber: `${f.airlineCode}${f.flightNumber}`,
        depStation: f.depStation as string,
        arrStation: f.arrStation as string,
        stdUtc: f.stdUtc as string,
        staUtc: f.staUtc as string,
        aircraftTypeIcao: f.aircraftTypeIcao as string | null,
        daysOfWeek: f.daysOfWeek as string,
        effectiveFrom: f.effectiveFrom as string,
        effectiveUntil: f.effectiveUntil as string,
        status: f.status as string,
      })),
    )

    return { messages, baseCount: baseFlights.length, targetCount: targetFlights.length }
  })

  // ── POST /schedule-messages/generate-and-hold — Generate + persist as held ──
  //
  // Same inputs as /generate, but also builds IATA raw text for each diff and
  // stores a held ScheduleMessageLog doc. Used by the Movement Control 2.1.1
  // ASM dialog "Generate & Hold" button — generates from ScheduledFlight diff
  // (pattern-level) rather than FlightInstance diff (instance-level).
  app.post('/schedule-messages/generate-and-hold', async (req, reply) => {
    const { operatorId, dateFrom, dateTo, targetScenarioId, operatorIataCode } = req.body as {
      operatorId?: string
      dateFrom?: string
      dateTo?: string
      targetScenarioId?: string
      operatorIataCode?: string
    }
    if (!operatorId) return reply.code(400).send({ error: 'operatorId required' })
    if (!operatorIataCode) return reply.code(400).send({ error: 'operatorIataCode required' })

    const periodFilter: Record<string, unknown> = {}
    if (dateFrom) periodFilter.effectiveUntil = { $gte: dateFrom }
    if (dateTo) periodFilter.effectiveFrom = { $lte: dateTo }

    const baseFilter: Record<string, unknown> = {
      operatorId,
      isActive: { $ne: false },
      scenarioId: null,
      ...periodFilter,
    }
    const targetFilter: Record<string, unknown> = {
      operatorId,
      isActive: { $ne: false },
      ...periodFilter,
    }
    if (targetScenarioId) targetFilter.scenarioId = targetScenarioId
    else targetFilter.scenarioId = null

    const [baseFlights, targetFlights] = await Promise.all([
      ScheduledFlight.find(baseFilter).lean(),
      ScheduledFlight.find(targetFilter).lean(),
    ])

    const diffs = computeScheduleDiff(
      baseFlights.map((f) => ({
        _id: f._id as string,
        flightNumber: `${f.airlineCode}${f.flightNumber}`,
        depStation: f.depStation as string,
        arrStation: f.arrStation as string,
        stdUtc: f.stdUtc as string,
        staUtc: f.staUtc as string,
        aircraftTypeIcao: f.aircraftTypeIcao as string | null,
        daysOfWeek: f.daysOfWeek as string,
        effectiveFrom: f.effectiveFrom as string,
        effectiveUntil: f.effectiveUntil as string,
        status: f.status as string,
      })),
      targetFlights.map((f) => ({
        _id: f._id as string,
        flightNumber: `${f.airlineCode}${f.flightNumber}`,
        depStation: f.depStation as string,
        arrStation: f.arrStation as string,
        stdUtc: f.stdUtc as string,
        staUtc: f.staUtc as string,
        aircraftTypeIcao: f.aircraftTypeIcao as string | null,
        daysOfWeek: f.daysOfWeek as string,
        effectiveFrom: f.effectiveFrom as string,
        effectiveUntil: f.effectiveUntil as string,
        status: f.status as string,
      })),
    )

    if (diffs.length === 0) return { held: 0, neutralized: 0 }

    const now = new Date().toISOString()
    const docs = diffs.map((d) => {
      const fltNum = d.flightNumber.replace(/^[A-Z]{2}/, '')
      // Schedule-pattern diff uses effectiveFrom as the effective date for the
      // IATA header. Downstream consumers receiving ASM will key on this +
      // flight number to apply the change.
      const raw = generateAsmMessage({
        actionCode: d.actionCode,
        airline: operatorIataCode,
        flightNumber: fltNum,
        flightDate: d.effectiveFrom,
        changes: d.changes as Record<string, { from?: string; to: string }>,
      })

      return {
        _id: crypto.randomUUID(),
        operatorId,
        messageType: d.type,
        actionCode: d.actionCode,
        direction: 'outbound' as const,
        status: 'held' as const,
        flightNumber: d.flightNumber,
        flightDate: d.effectiveFrom,
        depStation: d.depStation,
        arrStation: d.arrStation,
        summary: d.summary,
        rawMessage: raw,
        changes: d.changes,
        createdAtUtc: now,
        updatedAtUtc: now,
      }
    })

    await ScheduleMessageLog.insertMany(docs)

    // Neutralization: NEW + CNL pairs across all held outbound for operator.
    const allHeld = await ScheduleMessageLog.find(
      { operatorId, status: 'held', direction: 'outbound' },
      { _id: 1, actionCode: 1, flightNumber: 1, flightDate: 1, changes: 1 },
    ).lean()

    const heldRefs: HeldMessageRef[] = allHeld.map((m) => ({
      id: m._id as string,
      actionCode: m.actionCode as string,
      flightNumber: m.flightNumber as string,
      flightDate: m.flightDate as string,
      changes: (m.changes || {}) as Record<string, unknown>,
    }))
    const toNeutralize = findNeutralizablePairs(heldRefs)
    if (toNeutralize.length > 0) {
      await ScheduleMessageLog.updateMany({ _id: { $in: toNeutralize } }, { status: 'neutralized', updatedAtUtc: now })
    }

    return { held: docs.length - toNeutralize.length, neutralized: toNeutralize.length }
  })

  // ── GET /schedule-messages/delivery-log — Per-consumer delivery audit ──
  //
  // Returns messages that have been released (status in pending|sent|partial)
  // along with their deliveries[] array, so 7.1.5.1 can render a per-consumer
  // status grid. Filters:
  //   - operatorId (required)
  //   - status         — filter by message-level status
  //   - consumerId     — only messages that include this consumer's delivery
  //   - deliveryStatus — any delivery in this status (pending/delivered/failed)
  //   - actionCode     — NEW,CNL,…
  //   - flightDateFrom/To
  //   - limit / offset
  app.get('/schedule-messages/delivery-log', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>
    if (!q.operatorId) return reply.code(400).send({ error: 'operatorId required' })

    const limit = Math.min(parseInt(q.limit ?? '50', 10) || 50, 200)
    const offset = parseInt(q.offset ?? '0', 10) || 0

    const filter: Record<string, unknown> = {
      operatorId: q.operatorId,
      direction: 'outbound',
      status: { $in: ['pending', 'sent', 'partial', 'failed'] },
    }
    if (q.status) filter.status = q.status
    if (q.actionCode) filter.actionCode = { $in: q.actionCode.split(',') }
    if (q.consumerId) filter['deliveries.consumerId'] = q.consumerId
    if (q.deliveryStatus) filter['deliveries.status'] = q.deliveryStatus
    if (q.flightDateFrom || q.flightDateTo) {
      const dateFilter: Record<string, string> = {}
      if (q.flightDateFrom) dateFilter.$gte = q.flightDateFrom
      if (q.flightDateTo) dateFilter.$lte = q.flightDateTo
      filter.flightDate = dateFilter
    }

    const [entries, total] = await Promise.all([
      ScheduleMessageLog.find(filter).sort({ updatedAtUtc: -1 }).skip(offset).limit(limit).lean(),
      ScheduleMessageLog.countDocuments(filter),
    ])

    return { entries, total }
  })
}
