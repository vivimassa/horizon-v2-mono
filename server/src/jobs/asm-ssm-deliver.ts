import { ScheduleMessageLog } from '../models/ScheduleMessageLog.js'
import { AsmSsmConsumer, type AsmSsmConsumerDoc } from '../models/AsmSsmConsumer.js'
import { getSmtpAdapter, getSftpAdapter, type AsmSsmDeliveryAdapter } from '../services/asm-ssm-delivery.js'

/**
 * ASM/SSM delivery worker.
 *
 * Every MASTER_TICK_MS the job scans ScheduleMessageLog docs whose status is
 * pending|partial and who have at least one delivery in
 * deliveries[].status = 'pending' with deliveryMode in {smtp, sftp}.
 *
 * For each matching delivery we invoke the corresponding adapter and update
 * the delivery row in place. When all deliveries for a message terminate we
 * roll the message-level status up to sent / partial / failed.
 *
 * pull_api deliveries are NOT driven by this worker — they're drained
 * synchronously by the consumer's HTTP pull.
 *
 * Retry policy:
 *   - attemptCount < MAX_ATTEMPTS and result.transient=true → status='retrying'
 *   - attemptCount >= MAX_ATTEMPTS on failure              → status='failed'
 *   - result.transient=false                               → status='failed'
 *
 * The worker itself is best-effort — failures don't block; errors are logged.
 */

const MASTER_TICK_MS = 60_000
const MAX_ATTEMPTS = 3
const MIN_RETRY_DELAY_MS = 30_000 // 30s after first retry; grows exponentially

let timer: NodeJS.Timeout | null = null

interface DeliveryRow {
  consumerId: string
  consumerName?: string | null
  deliveryMode: 'pull_api' | 'sftp' | 'smtp'
  status: 'pending' | 'delivered' | 'failed' | 'retrying'
  attemptCount: number
  lastAttemptAtUtc?: string | null
  deliveredAtUtc?: string | null
  errorDetail?: string | null
  externalRef?: string | null
}

function shouldAttempt(delivery: DeliveryRow): boolean {
  if (delivery.status === 'pending') return true
  if (delivery.status !== 'retrying') return false
  if (delivery.attemptCount >= MAX_ATTEMPTS) return false
  const last = delivery.lastAttemptAtUtc ? Date.parse(delivery.lastAttemptAtUtc) : 0
  const delay = MIN_RETRY_DELAY_MS * Math.pow(2, delivery.attemptCount - 1)
  return Date.now() - last >= delay
}

function rollupStatus(deliveries: DeliveryRow[]): 'pending' | 'sent' | 'partial' | 'failed' {
  const all = deliveries.length
  if (all === 0) return 'sent'
  let delivered = 0
  let failed = 0
  let open = 0
  for (const d of deliveries) {
    if (d.status === 'delivered') delivered += 1
    else if (d.status === 'failed') failed += 1
    else open += 1
  }
  if (open > 0) return 'pending'
  if (delivered === all) return 'sent'
  if (failed === all) return 'failed'
  return 'partial'
}

async function processMessage(messageId: string): Promise<void> {
  const doc = await ScheduleMessageLog.findById(messageId).lean()
  if (!doc) return

  const deliveries = ((doc.deliveries as DeliveryRow[] | undefined) ?? []).slice()
  if (deliveries.length === 0) return

  const smtpAdapter = getSmtpAdapter()
  const sftpAdapter = getSftpAdapter()

  let touched = false

  for (let i = 0; i < deliveries.length; i += 1) {
    const d = deliveries[i]
    if (d.deliveryMode === 'pull_api') continue
    if (!shouldAttempt(d)) continue

    const adapter: AsmSsmDeliveryAdapter = d.deliveryMode === 'smtp' ? smtpAdapter : sftpAdapter

    const consumer = (await AsmSsmConsumer.findById(d.consumerId).lean()) as AsmSsmConsumerDoc | null
    if (!consumer || !consumer.active) {
      deliveries[i] = {
        ...d,
        status: 'failed',
        errorDetail: 'consumer_inactive_or_missing',
        lastAttemptAtUtc: new Date().toISOString(),
      }
      touched = true
      continue
    }

    const attemptAtUtc = new Date().toISOString()
    let result
    try {
      result = await adapter.send({
        messageId: doc._id as string,
        operatorId: doc.operatorId as string,
        family: doc.messageType as 'ASM' | 'SSM',
        type: doc.actionCode as string,
        rawMessage: (doc.rawMessage as string) ?? '',
        consumer,
      })
    } catch (e) {
      result = {
        ok: false,
        error: e instanceof Error ? e.message : 'adapter_threw',
        transient: true,
      }
    }

    const nextAttempt = d.attemptCount + 1
    if (result.ok) {
      deliveries[i] = {
        ...d,
        status: 'delivered',
        attemptCount: nextAttempt,
        lastAttemptAtUtc: attemptAtUtc,
        deliveredAtUtc: attemptAtUtc,
        errorDetail: null,
        externalRef: result.externalRef ?? null,
      }
      await AsmSsmConsumer.updateOne(
        { _id: consumer._id },
        {
          $set: { lastDeliveryAtUtc: attemptAtUtc, consecutiveFailures: 0 },
          $inc: { totalMessagesConsumed: 1 },
        },
      )
    } else {
      const terminal = !result.transient || nextAttempt >= MAX_ATTEMPTS
      deliveries[i] = {
        ...d,
        status: terminal ? 'failed' : 'retrying',
        attemptCount: nextAttempt,
        lastAttemptAtUtc: attemptAtUtc,
        errorDetail: result.error ?? 'unknown_error',
      }
      await AsmSsmConsumer.updateOne({ _id: consumer._id }, { $inc: { consecutiveFailures: 1 } })
    }
    touched = true
  }

  if (!touched) return

  const rollup = rollupStatus(deliveries)
  await ScheduleMessageLog.updateOne(
    { _id: messageId },
    {
      $set: {
        deliveries,
        status: rollup,
        updatedAtUtc: new Date().toISOString(),
      },
    },
  )
}

export async function runAsmSsmDeliveryTick(): Promise<void> {
  // Find messages with at least one open smtp/sftp delivery.
  const open = await ScheduleMessageLog.find(
    {
      status: { $in: ['pending', 'partial'] },
      direction: 'outbound',
      deliveries: {
        $elemMatch: {
          deliveryMode: { $in: ['smtp', 'sftp'] },
          status: { $in: ['pending', 'retrying'] },
        },
      },
    },
    { _id: 1 },
  )
    .limit(100)
    .lean()

  if (open.length === 0) return

  for (const m of open) {
    try {
      await processMessage(m._id as string)
    } catch (e) {
      console.error(`[asm-ssm-deliver] message ${m._id} failed:`, e instanceof Error ? e.message : e)
    }
  }
}

export function startAsmSsmDeliveryScheduler(): void {
  if (timer) return
  if (process.env.ENABLE_ASM_SSM_DELIVERY === 'false') {
    console.log('[asm-ssm-deliver] disabled via ENABLE_ASM_SSM_DELIVERY=false')
    return
  }

  const tick = () => {
    runAsmSsmDeliveryTick().catch((e) =>
      console.error('[asm-ssm-deliver] master tick error:', e instanceof Error ? e.message : e),
    )
  }

  void tick()
  timer = setInterval(tick, MASTER_TICK_MS)
  console.log('[asm-ssm-deliver] started (master tick every 60 s)')
}

export function stopAsmSsmDeliveryScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
