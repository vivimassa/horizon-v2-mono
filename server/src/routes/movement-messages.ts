import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { MovementMessageLog } from '../models/MovementMessageLog.js'
import { FlightInstance } from '../models/FlightInstance.js'
import { Operator } from '../models/Operator.js'
import { DelayCode } from '../models/DelayCode.js'
import { User } from '../models/User.js'
import { getTransmissionAdapter } from '../services/mvt-transmission.js'
import { buildMvtApplyDelta } from '../services/mvt-apply.js'
import { encodeMvtMessage, parseMessage } from '@skyhub/logic/src/iata/index'
import type { ParsedMvt } from '@skyhub/logic/src/iata/types'

// ── RBAC ──────────────────────────────────────────────────

const WRITE_ROLES = new Set(['administrator', 'manager', 'operator'])

async function requireOpsRole(req: FastifyRequest, reply: FastifyReply) {
  if (!WRITE_ROLES.has(req.userRole)) {
    return reply.code(403).send({ error: 'Forbidden — ops role required' })
  }
}

// ── Zod Schemas ────────────────────────────────────────────

const messageLogQuery = z.object({
  operatorId: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  actionCodes: z.string().optional(),
  messageTypes: z.string().optional(),
  stations: z.string().optional(),
  status: z.string().optional(),
  flightNumber: z.string().optional(),
  flightInstanceId: z.string().optional(),
  flightDateFrom: z.string().optional(),
  flightDateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const statsQuery = z.object({
  operatorId: z.string().optional(),
  flightDateFrom: z.string().optional(),
  flightDateTo: z.string().optional(),
})

const batchIdsSchema = z.object({
  messageIds: z.array(z.string().min(1)),
})

const delayInputSchema = z.object({
  code: z.string().min(1),
  duration: z.string().optional(),
  ahm732: z
    .object({
      process: z.string().length(1),
      reason: z.string().length(1),
      stakeholder: z.string().length(1),
    })
    .optional(),
})

const createMessageSchema = z.object({
  flightInstanceId: z.string().min(1),
  actionCode: z.enum(['AD', 'AA', 'ED', 'EA', 'NI', 'RR', 'FR']),
  offBlocks: z.string().optional(),
  airborne: z.string().optional(),
  touchdown: z.string().optional(),
  onBlocks: z.string().optional(),
  estimatedDeparture: z.string().optional(),
  nextInfoTime: z.string().optional(),
  returnTime: z.string().optional(),
  etas: z.array(z.object({ time: z.string().min(4), destination: z.string().length(3) })).optional(),
  delays: z.array(delayInputSchema).optional(),
  passengers: z
    .object({
      total: z.number().int().nonnegative(),
      noSeatHolders: z.number().int().nonnegative().optional(),
      sectors: z.array(z.number().int().nonnegative()).optional(),
    })
    .optional(),
  supplementaryInfo: z.array(z.string()).optional(),
  recipients: z.array(z.string().min(1)).optional(),
  envelope: z
    .object({
      priority: z.string().optional(),
      addresses: z.array(z.string()).optional(),
      originator: z.string().optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
  correction: z.boolean().optional(),
  // Duplicate-held resolution flags. If a held message with matching
  // (flightInstanceId, actionCode) already exists and neither flag is set,
  // the endpoint returns 409. `replaceExistingId` supersedes the named doc
  // (discarded, flagged with supersededByMessageId). `allowDuplicate` bypasses
  // the check entirely.
  replaceExistingId: z.string().min(1).optional(),
  allowDuplicate: z.boolean().optional(),
})

const inboundParseSchema = z.object({ rawMessage: z.string().min(3) })

const inboundApplySchema = z.object({
  rawMessage: z.string().min(3),
  flightInstanceId: z.string().min(1),
})

// ── Helpers ────────────────────────────────────────────────

/**
 * Resolve a user's display name for audit-trail denormalization.
 * Returns "First Last" when profile names exist, else the email,
 * else null. We cache the resolved name on every state transition
 * so the UI can show "Released by Alice Nguyen" without joining.
 */
async function resolveUserName(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  const user = await User.findOne({ _id: userId }, { profile: 1 }).lean()
  if (!user) return null
  const first = user.profile?.firstName?.trim() ?? ''
  const last = user.profile?.lastName?.trim() ?? ''
  const full = `${first} ${last}`.trim()
  return full || user.profile?.email || null
}

function makeSummary(parsed: ParsedMvt): string {
  const fid = parsed.flightId
  const head = `${fid.airline}${fid.flightNumber}/${fid.dayOfMonth}.${fid.station} ${parsed.actionCode}`
  const times: string[] = []
  if (parsed.offBlocks) times.push(`OUT ${parsed.offBlocks}`)
  if (parsed.airborne) times.push(`OFF ${parsed.airborne}`)
  if (parsed.touchdown) times.push(`ON ${parsed.touchdown}`)
  if (parsed.onBlocks) times.push(`IN ${parsed.onBlocks}`)
  if (parsed.estimatedDeparture) times.push(`ETD ${parsed.estimatedDeparture}`)
  if (parsed.nextInfoTime) times.push(`NI ${parsed.nextInfoTime}`)
  const delays =
    parsed.delays.length > 0
      ? ` / DL ${parsed.delays.map((d) => d.code + (d.duration ? '/' + d.duration : '')).join(',')}`
      : ''
  return `${head} ${times.join(' ')}${delays}`.trim()
}

// ── Routes ─────────────────────────────────────────────────

export async function movementMessageRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /movement-messages — Paginated message log ──
  app.get('/movement-messages', async (req) => {
    const q = messageLogQuery.parse(req.query)

    // operatorId is always taken from the JWT — never from query — to make tenant isolation
    // independent of the middleware's execution ordering.
    const filter: Record<string, unknown> = { operatorId: req.operatorId }
    if (q.direction) filter.direction = q.direction
    if (q.status) filter.status = { $in: q.status.split(',') }
    if (q.actionCodes) filter.actionCode = { $in: q.actionCodes.split(',') }
    if (q.messageTypes) filter.messageType = { $in: q.messageTypes.split(',') }
    if (q.stations) {
      const stations = q.stations.split(',').filter(Boolean)
      if (stations.length > 0) {
        filter.$or = [{ depStation: { $in: stations } }, { arrStation: { $in: stations } }]
      }
    }
    if (q.flightInstanceId) filter.flightInstanceId = q.flightInstanceId
    if (q.flightNumber) {
      filter.flightNumber = { $regex: q.flightNumber, $options: 'i' }
    }
    if (q.flightDateFrom || q.flightDateTo) {
      const range: Record<string, string> = {}
      if (q.flightDateFrom) range.$gte = q.flightDateFrom
      if (q.flightDateTo) range.$lte = q.flightDateTo
      filter.flightDate = range
    }

    const [messages, total] = await Promise.all([
      MovementMessageLog.find(filter).sort({ createdAtUtc: -1 }).skip(q.offset).limit(q.limit).lean(),
      MovementMessageLog.countDocuments(filter),
    ])

    return { messages, total }
  })

  // ── GET /movement-messages/stats ──
  app.get('/movement-messages/stats', async (req) => {
    const q = statsQuery.parse(req.query)

    const match: Record<string, unknown> = { operatorId: req.operatorId }
    if (q.flightDateFrom || q.flightDateTo) {
      const range: Record<string, string> = {}
      if (q.flightDateFrom) range.$gte = q.flightDateFrom
      if (q.flightDateTo) range.$lte = q.flightDateTo
      match.flightDate = range
    }

    const pipeline = [{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]
    const agg = await MovementMessageLog.aggregate(pipeline)
    const counts: Record<string, number> = {}
    for (const row of agg) counts[row._id as string] = row.count as number

    return {
      total: Object.values(counts).reduce((s, c) => s + c, 0),
      held: counts.held ?? 0,
      pending: counts.pending ?? 0,
      sent: counts.sent ?? 0,
      applied: counts.applied ?? 0,
      rejected: counts.rejected ?? 0,
      discarded: counts.discarded ?? 0,
      failed: counts.failed ?? 0,
    }
  })

  // ── GET /movement-messages/held ──
  app.get('/movement-messages/held', async (req) => {
    const messages = await MovementMessageLog.find({
      operatorId: req.operatorId,
      status: 'held',
      direction: 'outbound',
    })
      .sort({ createdAtUtc: -1 })
      .lean()

    return { messages }
  })

  // ── GET /movement-messages/:id — single detail ──
  app.get('/movement-messages/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params)
    const doc = await MovementMessageLog.findOne({ _id: id, operatorId: req.operatorId }).lean()
    if (!doc) return reply.code(404).send({ error: 'not_found' })
    return { message: doc }
  })

  // ── POST /movement-messages — create outbound, status: held ──
  app.post('/movement-messages', { preHandler: requireOpsRole }, async (req, reply) => {
    const body = createMessageSchema.parse(req.body)

    const flight = await FlightInstance.findOne({
      _id: body.flightInstanceId,
      operatorId: req.operatorId,
    }).lean()
    if (!flight) return reply.code(404).send({ error: 'flight_not_found' })

    // ── Duplicate-held detection ──
    // Two MVTs with the same (flightInstanceId, actionCode) both in `held`
    // would be transmitted as two separate outbound messages on release, and
    // downstream ACARS/SITA systems don't consistently last-wins. Surface the
    // conflict to the composer unless they've explicitly chosen Replace or Keep-both.
    if (!body.allowDuplicate && !body.replaceExistingId) {
      const existing = await MovementMessageLog.findOne(
        {
          operatorId: req.operatorId,
          flightInstanceId: body.flightInstanceId,
          actionCode: body.actionCode,
          status: 'held',
        },
        {
          _id: 1,
          actionCode: 1,
          flightNumber: 1,
          flightDate: 1,
          summary: 1,
          createdAtUtc: 1,
          createdBy: 1,
          createdByName: 1,
        },
      ).lean()
      if (existing) {
        return reply.code(409).send({
          error: 'duplicate_held',
          existing: {
            _id: existing._id,
            actionCode: existing.actionCode,
            flightNumber: existing.flightNumber ?? null,
            flightDate: existing.flightDate ?? null,
            summary: existing.summary ?? null,
            createdAtUtc: existing.createdAtUtc,
            createdBy: existing.createdBy ?? null,
            createdByName: existing.createdByName ?? null,
          },
        })
      }
    }

    // If the composer chose Replace, validate the target before any writes.
    let supersedeTarget: { _id: string } | null = null
    if (body.replaceExistingId) {
      const target = await MovementMessageLog.findOne({
        _id: body.replaceExistingId,
        operatorId: req.operatorId,
        flightInstanceId: body.flightInstanceId,
        actionCode: body.actionCode,
        status: 'held',
      }).lean()
      if (!target) {
        return reply.code(409).send({ error: 'replace_target_not_held', id: body.replaceExistingId })
      }
      supersedeTarget = { _id: target._id as string }
    }

    const operator = await Operator.findOne({ _id: req.operatorId }).lean()
    const delayStandard = (operator?.delayCodeAdherence ?? 'ahm730') as 'ahm730' | 'ahm732'

    // Hydrate delay metadata from the DelayCode master for cached display
    const cachedDelays = body.delays ? await hydrateDelayCodes(req.operatorId, body.delays, delayStandard) : []

    // Build encoder input from flight + request
    const dayOfMonth = (flight.operatingDate ?? '').slice(8, 10)
    const flightDigits = flight.flightNumber.replace(/^[A-Z]{2}/i, '')
    const airline = flight.flightNumber.match(/^([A-Z]{2})/i)?.[1]?.toUpperCase() ?? 'HZ'
    const station =
      body.actionCode === 'AA' || body.actionCode === 'FR'
        ? (flight.arr?.iata ?? flight.arr?.icao ?? '')
        : (flight.dep?.iata ?? flight.dep?.icao ?? '')

    const rawMessage = encodeMvtMessage({
      correction: body.correction,
      envelope: body.envelope as never,
      flightId: {
        airline,
        flightNumber: flightDigits,
        dayOfMonth: dayOfMonth || '01',
        registration: (flight.tail?.registration ?? '').replace(/-/g, '').toUpperCase(),
        station: station.toUpperCase(),
      },
      actionCode: body.actionCode,
      offBlocks: body.offBlocks,
      airborne: body.airborne,
      touchdown: body.touchdown,
      onBlocks: body.onBlocks,
      estimatedDeparture: body.estimatedDeparture,
      nextInfoTime: body.nextInfoTime,
      returnTime: body.returnTime,
      etas: body.etas,
      delayStandard,
      delays: body.delays?.map((d) => ({
        code: d.code,
        duration: d.duration,
        ahm732: d.ahm732,
      })),
      passengers: body.passengers,
      supplementaryInfo: body.supplementaryInfo,
    })

    const parsedForCache = parseMessage(rawMessage)
    const summary = parsedForCache.type === 'MVT' ? makeSummary(parsedForCache) : `${body.actionCode} (held)`

    const now = new Date().toISOString()
    const id = randomUUID()
    const createdByName = await resolveUserName(req.userId)

    const doc = await MovementMessageLog.create({
      _id: id,
      operatorId: req.operatorId,
      messageType: 'MVT',
      actionCode: body.actionCode,
      direction: 'outbound',
      status: 'held',
      flightNumber: flight.flightNumber,
      flightDate: flight.operatingDate,
      registration: flight.tail?.registration ?? null,
      depStation: flight.dep?.iata ?? flight.dep?.icao ?? null,
      arrStation: flight.arr?.iata ?? flight.arr?.icao ?? null,
      summary,
      rawMessage,
      delayStandard,
      delayCodes: cachedDelays,
      envelope: body.envelope ?? null,
      recipients: body.recipients ?? [],
      parsed: parsedForCache.type === 'MVT' ? parsedForCache : null,
      flightInstanceId: body.flightInstanceId,
      createdBy: req.userId,
      createdByName,
      supersedesMessageId: supersedeTarget?._id ?? null,
      createdAtUtc: now,
      updatedAtUtc: now,
    })

    // Supersede the replaced message last — after the new doc exists, so we
    // never leave the flight without any held MVT in flight.
    if (supersedeTarget) {
      await MovementMessageLog.updateOne(
        { _id: supersedeTarget._id, operatorId: req.operatorId, status: 'held' },
        {
          $set: {
            status: 'discarded',
            discardedBy: req.userId,
            discardedByName: createdByName,
            discardedAtUtc: now,
            supersededByMessageId: id,
            errorReason: `superseded_by:${id}`,
            updatedAtUtc: now,
          },
        },
      )
    }

    return reply.code(201).send({ message: doc.toObject() })
  })

  // ── POST /movement-messages/:id/transmit — transmit single message ──
  app.post('/movement-messages/:id/transmit', { preHandler: requireOpsRole }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params)
    const doc = await MovementMessageLog.findOne({ _id: id, operatorId: req.operatorId })
    if (!doc) return reply.code(404).send({ error: 'not_found' })
    if (doc.status !== 'held' && doc.status !== 'pending' && doc.status !== 'failed') {
      return reply.code(409).send({ error: 'invalid_state', status: doc.status })
    }

    const adapter = getTransmissionAdapter()
    const result = await adapter.send({
      envelope: (doc.envelope ?? undefined) as never,
      rawMessage: doc.rawMessage ?? '',
      recipients: doc.recipients ?? [],
      operatorId: req.operatorId,
      messageId: doc._id as string,
    })

    const now = new Date().toISOString()
    const releasedByName = await resolveUserName(req.userId)
    doc.releasedBy = req.userId
    doc.releasedByName = releasedByName
    doc.releasedAtUtc = now
    if (result.ok) {
      doc.status = 'sent'
      doc.sentAtUtc = now
      doc.externalMessageId = result.externalMessageId ?? null
      doc.errorReason = null
    } else {
      doc.status = 'failed'
      doc.errorReason = result.error ?? 'transmission_failed'
    }
    doc.updatedAtUtc = now
    await doc.save()

    return { message: doc.toObject() }
  })

  // ── POST /movement-messages/release — batch release held → pending → transmit ──
  app.post('/movement-messages/release', { preHandler: requireOpsRole }, async (req) => {
    const { messageIds } = batchIdsSchema.parse(req.body)
    const now = new Date().toISOString()
    const releasedByName = await resolveUserName(req.userId)

    const docs = await MovementMessageLog.find({
      _id: { $in: messageIds },
      operatorId: req.operatorId,
      status: 'held',
    })

    const adapter = getTransmissionAdapter()
    let sent = 0
    let failed = 0
    for (const doc of docs) {
      const result = await adapter.send({
        envelope: (doc.envelope ?? undefined) as never,
        rawMessage: doc.rawMessage ?? '',
        recipients: doc.recipients ?? [],
        operatorId: req.operatorId,
        messageId: doc._id as string,
      })
      doc.releasedBy = req.userId
      doc.releasedByName = releasedByName
      doc.releasedAtUtc = now
      if (result.ok) {
        doc.status = 'sent'
        doc.sentAtUtc = now
        doc.externalMessageId = result.externalMessageId ?? null
        doc.errorReason = null
        sent++
      } else {
        doc.status = 'failed'
        doc.errorReason = result.error ?? 'transmission_failed'
        failed++
      }
      doc.updatedAtUtc = now
      await doc.save()
    }

    return { released: docs.length, sent, failed }
  })

  // ── POST /movement-messages/discard — batch discard held ──
  app.post('/movement-messages/discard', { preHandler: requireOpsRole }, async (req) => {
    const { messageIds } = batchIdsSchema.parse(req.body)
    const now = new Date().toISOString()
    const discardedByName = await resolveUserName(req.userId)

    const result = await MovementMessageLog.updateMany(
      { _id: { $in: messageIds }, operatorId: req.operatorId, status: 'held' },
      {
        $set: {
          status: 'discarded',
          discardedBy: req.userId,
          discardedByName,
          discardedAtUtc: now,
          updatedAtUtc: now,
        },
      },
    )

    return { discarded: result.modifiedCount }
  })

  // ── POST /movement-messages/inbound/parse — decode raw telex + candidate match
  //    Read-only preview; any authenticated user may parse (no RBAC gate). Apply is guarded.
  app.post('/movement-messages/inbound/parse', async (req) => {
    const { rawMessage } = inboundParseSchema.parse(req.body)
    const parsed = parseMessage(rawMessage)

    if (parsed.type === 'UNKNOWN') {
      return { type: 'UNKNOWN', error: parsed.error, candidateFlights: [] }
    }

    const fid = 'flightId' in parsed ? parsed.flightId : null
    let candidateFlights: Array<{
      _id: string
      flightNumber: string
      operatingDate: string
      dep: unknown
      arr: unknown
    }> = []
    if (fid) {
      const flightNumberFull = `${fid.airline}${fid.flightNumber}`
      // Match flights whose operatingDate's day matches dayOfMonth (±1 day to handle rollover)
      const candidates = await FlightInstance.find({
        operatorId: req.operatorId,
        flightNumber: flightNumberFull,
      })
        .limit(20)
        .lean()
      candidateFlights = candidates
        .filter((f) => {
          const dd = (f.operatingDate ?? '').slice(8, 10)
          const target = parseInt(fid.dayOfMonth, 10)
          const fd = parseInt(dd, 10)
          return !Number.isNaN(target) && !Number.isNaN(fd) && Math.abs(fd - target) <= 1
        })
        .map((f) => ({
          _id: f._id as string,
          flightNumber: f.flightNumber,
          operatingDate: f.operatingDate,
          dep: f.dep,
          arr: f.arr,
        }))
    }

    return { type: parsed.type, parsed, candidateFlights }
  })

  // ── POST /movement-messages/inbound/apply — apply parsed MVT to flight ──
  app.post('/movement-messages/inbound/apply', { preHandler: requireOpsRole }, async (req, reply) => {
    const { rawMessage, flightInstanceId } = inboundApplySchema.parse(req.body)
    const parsed = parseMessage(rawMessage)
    if (parsed.type !== 'MVT') {
      return reply.code(422).send({ error: 'not_mvt', actualType: parsed.type })
    }

    const flight = await FlightInstance.findOne({
      _id: flightInstanceId,
      operatorId: req.operatorId,
    })
    if (!flight) return reply.code(404).send({ error: 'flight_not_found' })

    const delta = await buildMvtApplyDelta({
      operatorId: req.operatorId,
      parsed,
      flight: {
        operatingDate: flight.operatingDate,
        schedule: flight.schedule ?? { stdUtc: null, staUtc: null },
        delays: (flight.delays ?? []).map((d) => ({ code: d.code, minutes: d.minutes })),
      },
    })

    const update: Record<string, unknown> = {}
    if (Object.keys(delta.set).length > 0) update.$set = { ...delta.set, 'syncMeta.updatedAt': Date.now() }
    if (delta.pushDelays.length > 0) update.$push = { delays: { $each: delta.pushDelays } }

    if (Object.keys(update).length > 0) {
      await FlightInstance.updateOne({ _id: flightInstanceId, operatorId: req.operatorId }, update)
    }

    const now = new Date().toISOString()
    const id = randomUUID()

    const applied = await MovementMessageLog.create({
      _id: id,
      operatorId: req.operatorId,
      messageType: 'MVT',
      actionCode: parsed.actionCode,
      direction: 'inbound',
      status: 'applied',
      flightNumber: flight.flightNumber,
      flightDate: flight.operatingDate,
      registration: parsed.flightId.registration,
      depStation: flight.dep?.iata ?? flight.dep?.icao ?? null,
      arrStation: flight.arr?.iata ?? flight.arr?.icao ?? null,
      summary: delta.summary,
      rawMessage,
      parsed,
      flightInstanceId,
      appliedToFlight: {
        atdUtc: delta.set['actual.atdUtc'] ?? null,
        offUtc: delta.set['actual.offUtc'] ?? null,
        onUtc: delta.set['actual.onUtc'] ?? null,
        ataUtc: delta.set['actual.ataUtc'] ?? null,
        etdUtc: delta.set['estimated.etdUtc'] ?? null,
        etaUtc: delta.set['estimated.etaUtc'] ?? null,
        delaysAppended: delta.delaysAppended,
      },
      createdBy: req.userId,
      createdAtUtc: now,
      updatedAtUtc: now,
      appliedAtUtc: now,
    })

    return { message: applied.toObject(), delta }
  })
}

// ── Delay hydration helper ──────────────────────────────────

async function hydrateDelayCodes(
  operatorId: string,
  delays: Array<{ code: string; duration?: string; ahm732?: { process: string; reason: string; stakeholder: string } }>,
  standard: 'ahm730' | 'ahm732',
): Promise<
  Array<{
    code: string
    alphaCode: string | null
    ahm732Process: string | null
    ahm732Reason: string | null
    ahm732Stakeholder: string | null
    duration: string | null
    minutes: number | null
    reasonText: string | null
    category: string | null
  }>
> {
  const codesToFetch = Array.from(new Set(delays.map((d) => d.code).filter(Boolean)))
  const docs = codesToFetch.length > 0 ? await DelayCode.find({ operatorId, code: { $in: codesToFetch } }).lean() : []
  const byCode = new Map(docs.map((doc) => [doc.code, doc]))

  return delays.map((d) => {
    const master = byCode.get(d.code)
    const minutes = durationToMinutes(d.duration)
    return {
      code: d.code,
      alphaCode: master?.alphaCode ?? null,
      ahm732Process: d.ahm732?.process ?? (standard === 'ahm732' ? (master?.ahm732Process ?? null) : null),
      ahm732Reason: d.ahm732?.reason ?? (standard === 'ahm732' ? (master?.ahm732Reason ?? null) : null),
      ahm732Stakeholder: d.ahm732?.stakeholder ?? (standard === 'ahm732' ? (master?.ahm732Stakeholder ?? null) : null),
      duration: d.duration ?? null,
      minutes: minutes > 0 ? minutes : null,
      reasonText: master?.description ?? master?.name ?? null,
      category: master?.category ?? null,
    }
  })
}

function durationToMinutes(duration: string | undefined): number {
  if (!duration || duration.length < 4) return 0
  const h = parseInt(duration.slice(0, 2), 10)
  const m = parseInt(duration.slice(2, 4), 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}
