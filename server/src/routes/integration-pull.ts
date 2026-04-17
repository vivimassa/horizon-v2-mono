import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { AsmSsmConsumer } from '../models/AsmSsmConsumer.js'
import { ScheduleMessageLog } from '../models/ScheduleMessageLog.js'

/**
 * 7.1.5.1 ASM/SSM outbox — external pull endpoint.
 *
 *   GET /integration/asm-ssm/outbox
 *     Header:  X-Consumer-Key: sh_<plaintext>
 *     Query:   ?format=iata|json (default iata), ?limit=100 (max 500)
 *
 * Public path (see middleware/authenticate.ts PUBLIC_PATHS). Authenticated
 * by the consumer's API key — looked up by SHA-256 hash. Returns pending
 * deliveries for that consumer's operator and marks them delivered.
 *
 * Consumer must be active and deliveryMode='pull_api'. Returns 401 on bad
 * key (no data leak). Rate limiting is handled at the edge / reverse proxy.
 */

function hashKey(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex')
}

interface DeliveryRow {
  consumerId: string
  deliveryMode: 'pull_api' | 'sftp' | 'smtp'
  status: 'pending' | 'delivered' | 'failed' | 'retrying'
  attemptCount: number
  lastAttemptAtUtc?: string | null
  deliveredAtUtc?: string | null
  errorDetail?: string | null
  externalRef?: string | null
}

export async function integrationPullRoutes(app: FastifyInstance) {
  app.get('/integration/asm-ssm/outbox', async (req, reply) => {
    const key = (req.headers['x-consumer-key'] as string | undefined)?.trim()
    if (!key) return reply.code(401).send({ error: 'Missing X-Consumer-Key' })

    const consumer = await AsmSsmConsumer.findOne({
      'pullApi.apiKeyHash': hashKey(key),
      deliveryMode: 'pull_api',
      active: true,
    }).lean()
    if (!consumer) return reply.code(401).send({ error: 'Invalid consumer key' })

    const q = req.query as { format?: string; limit?: string }
    const format = q.format === 'json' ? 'json' : 'iata'
    const limit = Math.min(Math.max(parseInt(q.limit ?? '100', 10) || 100, 1), 500)

    // Find messages that include a pending delivery for this consumer.
    const pendingMessages = await ScheduleMessageLog.find({
      operatorId: consumer.operatorId,
      direction: 'outbound',
      status: { $in: ['pending', 'partial'] },
      deliveries: {
        $elemMatch: { consumerId: consumer._id, status: 'pending' },
      },
    })
      .sort({ createdAtUtc: 1 })
      .limit(limit)
      .lean()

    if (pendingMessages.length === 0) {
      return format === 'json' ? { messages: [] } : { rawMessages: [] }
    }

    const now = new Date().toISOString()
    const responseMessages: Array<{
      messageId: string
      family: string
      type: string
      flightNumber: string | null
      flightDate: string | null
      rawMessage: string
      generatedAtUtc: string | null
    }> = []

    // Mark the pending delivery delivered on each doc; if this was the last
    // open delivery, the worker rollup on its next tick will finalize status.
    // We also do an immediate rollup here so the pull returns a clean state.
    for (const msg of pendingMessages) {
      const deliveries = ((msg.deliveries as DeliveryRow[] | undefined) ?? []).slice()
      let changed = false
      let open = 0
      let delivered = 0
      let failed = 0
      for (let i = 0; i < deliveries.length; i += 1) {
        const d = deliveries[i]
        if (d.consumerId === consumer._id && d.status === 'pending') {
          deliveries[i] = {
            ...d,
            status: 'delivered',
            attemptCount: d.attemptCount + 1,
            lastAttemptAtUtc: now,
            deliveredAtUtc: now,
            errorDetail: null,
            externalRef: `pull-${Date.now()}-${(consumer._id as string).slice(0, 8)}`,
          }
          changed = true
        }
        const dd = deliveries[i]
        if (dd.status === 'delivered') delivered += 1
        else if (dd.status === 'failed') failed += 1
        else open += 1
      }
      if (!changed) continue

      const rollup =
        open > 0
          ? 'pending'
          : delivered === deliveries.length
            ? 'sent'
            : failed === deliveries.length
              ? 'failed'
              : 'partial'

      await ScheduleMessageLog.updateOne({ _id: msg._id }, { $set: { deliveries, status: rollup, updatedAtUtc: now } })

      responseMessages.push({
        messageId: msg._id as string,
        family: msg.messageType as string,
        type: msg.actionCode as string,
        flightNumber: (msg.flightNumber as string) ?? null,
        flightDate: (msg.flightDate as string) ?? null,
        rawMessage: (msg.rawMessage as string) ?? '',
        generatedAtUtc: (msg.createdAtUtc as string) ?? null,
      })
    }

    await AsmSsmConsumer.updateOne(
      { _id: consumer._id },
      {
        $set: { lastDeliveryAtUtc: now, consecutiveFailures: 0 },
        $inc: { totalMessagesConsumed: responseMessages.length },
      },
    )

    if (format === 'json') {
      return { messages: responseMessages, count: responseMessages.length }
    }
    return {
      rawMessages: responseMessages.map((m) => m.rawMessage),
      count: responseMessages.length,
    }
  })
}
