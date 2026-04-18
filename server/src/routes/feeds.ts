import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FeedHeartbeat } from '../models/FeedHeartbeat.js'
import { Operator } from '../models/Operator.js'
import { WeatherObservation } from '../models/WeatherObservation.js'

const FEED_KEYS = ['acars', 'mvt', 'asmSsm'] as const
type FeedKey = (typeof FEED_KEYS)[number]

const heartbeatBody = z.object({
  feed: z.enum(FEED_KEYS),
  source: z.string().max(120).optional(),
})

type State = 'online' | 'stale' | 'offline' | 'unconfigured'

interface HeartbeatFeedStatus {
  state: State
  lastHeartbeatAtUtc: string | null
  source: string | null
  /** Expected heartbeat cadence — used to derive state thresholds. */
  expectedIntervalSec: number
}

interface WxFeedStatus {
  state: 'online' | 'stale' | 'offline'
  lastPollAtUtc: string | null
  pollIntervalMin: number
}

export interface FeedStatusResponse {
  acars: HeartbeatFeedStatus
  mvt: HeartbeatFeedStatus
  asmSsm: HeartbeatFeedStatus
  wx: WxFeedStatus
  computedAtUtc: string
}

/**
 * Typical operational cadence per feed (seconds). External gateways should
 * post a heartbeat at roughly this frequency. State is derived as:
 *   age <= interval*2  → online
 *   age <= interval*6  → stale
 *   else               → offline
 * Missing row → unconfigured (no gateway has ever pinged us).
 */
const EXPECTED_INTERVAL_SEC: Record<FeedKey, number> = {
  acars: 60,
  mvt: 60,
  asmSsm: 300,
}

function classifyHeartbeat(
  feed: FeedKey,
  lastHeartbeatAtUtc: string | null,
  source: string | null,
  nowMs: number,
): HeartbeatFeedStatus {
  const expectedIntervalSec = EXPECTED_INTERVAL_SEC[feed]
  if (!lastHeartbeatAtUtc) {
    return { state: 'unconfigured', lastHeartbeatAtUtc: null, source: null, expectedIntervalSec }
  }
  const ts = Date.parse(lastHeartbeatAtUtc)
  if (!Number.isFinite(ts)) {
    return { state: 'offline', lastHeartbeatAtUtc, source, expectedIntervalSec }
  }
  const ageSec = Math.max(0, (nowMs - ts) / 1000)
  const state: State =
    ageSec <= expectedIntervalSec * 2 ? 'online' : ageSec <= expectedIntervalSec * 6 ? 'stale' : 'offline'
  return { state, lastHeartbeatAtUtc, source, expectedIntervalSec }
}

function classifyWx(lastPollAtUtc: string | null, nowMs: number): WxFeedStatus {
  const raw = process.env.WEATHER_POLL_INTERVAL_MINUTES
  const parsed = raw ? parseInt(raw, 10) : 15
  const pollIntervalMin = Number.isFinite(parsed) && parsed > 0 ? parsed : 15

  if (!lastPollAtUtc) {
    return { state: 'offline', lastPollAtUtc: null, pollIntervalMin }
  }
  const ts = Date.parse(lastPollAtUtc)
  if (!Number.isFinite(ts)) {
    return { state: 'offline', lastPollAtUtc, pollIntervalMin }
  }
  const ageMin = Math.max(0, (nowMs - ts) / 60_000)
  const state: WxFeedStatus['state'] =
    ageMin <= pollIntervalMin * 2 ? 'online' : ageMin <= pollIntervalMin * 4 ? 'stale' : 'offline'
  return { state, lastPollAtUtc, pollIntervalMin }
}

export async function feedRoutes(app: FastifyInstance) {
  /**
   * POST /feeds/heartbeat — PUBLIC route (bypasses JWT, authenticates via
   * per-operator bearer token identical to /movement-messages/inbound).
   *
   * External gateways (SITA Type B, ACARS upstream, ASM/SSM transport) post
   * here at their operational cadence. Missing pings for > 6× expected
   * interval causes the feed to show OFFLINE in the OCC Dashboard.
   */
  app.post('/feeds/heartbeat', async (req, reply) => {
    const parsed = heartbeatBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const authHeader = req.headers['authorization'] ?? ''
    const m = /^Bearer\s+(.+)$/i.exec(typeof authHeader === 'string' ? authHeader : '')
    if (!m) return reply.code(401).send({ error: 'Missing Bearer token' })
    const presentedToken = m[1].trim()
    if (!presentedToken) return reply.code(401).send({ error: 'Empty token' })

    const op = (await Operator.findOne({ inboundMessageToken: presentedToken }, { _id: 1 }).lean()) as {
      _id: string
    } | null
    if (!op) return reply.code(401).send({ error: 'Invalid token' })

    const now = new Date().toISOString()
    await FeedHeartbeat.updateOne(
      { operatorId: op._id, feed: parsed.data.feed },
      {
        $set: {
          lastHeartbeatAtUtc: now,
          source: parsed.data.source ?? null,
          updatedAtUtc: now,
        },
        $setOnInsert: {
          _id: `${op._id}-${parsed.data.feed}`,
          operatorId: op._id,
          feed: parsed.data.feed,
          createdAtUtc: now,
        },
      },
      { upsert: true },
    )

    return { ok: true, receivedAtUtc: now, feed: parsed.data.feed }
  })

  /**
   * GET /feed-status — JWT-authed, scoped to the caller's operator.
   * Returns real-time health for the four OCC dashboard feeds.
   */
  app.get('/feed-status', async (req): Promise<FeedStatusResponse> => {
    const operatorId = req.operatorId
    const nowMs = Date.now()

    const heartbeats = (await FeedHeartbeat.find(
      { operatorId, feed: { $in: FEED_KEYS } },
      { feed: 1, lastHeartbeatAtUtc: 1, source: 1 },
    ).lean()) as Array<{ feed: FeedKey; lastHeartbeatAtUtc: string; source: string | null }>

    const byFeed = new Map<FeedKey, { lastHeartbeatAtUtc: string; source: string | null }>(
      heartbeats.map((h) => [h.feed, { lastHeartbeatAtUtc: h.lastHeartbeatAtUtc, source: h.source }]),
    )

    const latestWx = (await WeatherObservation.findOne({}, { createdAt: 1 }).sort({ createdAt: -1 }).lean()) as {
      createdAt: string
    } | null

    return {
      acars: classifyHeartbeat(
        'acars',
        byFeed.get('acars')?.lastHeartbeatAtUtc ?? null,
        byFeed.get('acars')?.source ?? null,
        nowMs,
      ),
      mvt: classifyHeartbeat(
        'mvt',
        byFeed.get('mvt')?.lastHeartbeatAtUtc ?? null,
        byFeed.get('mvt')?.source ?? null,
        nowMs,
      ),
      asmSsm: classifyHeartbeat(
        'asmSsm',
        byFeed.get('asmSsm')?.lastHeartbeatAtUtc ?? null,
        byFeed.get('asmSsm')?.source ?? null,
        nowMs,
      ),
      wx: classifyWx(latestWx?.createdAt ?? null, nowMs),
      computedAtUtc: new Date(nowMs).toISOString(),
    }
  })
}
