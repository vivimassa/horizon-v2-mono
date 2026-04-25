import { HotelEmail } from '../models/HotelEmail.js'
import { OperatorHotacConfig } from '../models/OperatorHotacConfig.js'
import { getHotelEmailAdapter } from '../services/hotel-email-delivery.js'

/**
 * 4.1.8.1 Hotel Email — SMTP delivery worker.
 *
 * Every MASTER_TICK_MS the job scans HotelEmail docs whose status is
 * pending|partial and at least one delivery is pending|retrying. For each
 * matching delivery row the SMTP adapter is invoked; the result updates the
 * row in place. Once every delivery terminates, the email-level status rolls
 * up to sent / partial / failed.
 *
 * Mirrors the asm-ssm-deliver pattern but the transport is plain SMTP — no
 * Type-B telex semantics, no consumer fan-out logic.
 *
 * Disable in dev/CI with: ENABLE_HOTEL_EMAIL_DELIVERY=false
 */

const MASTER_TICK_MS = 60_000
const MAX_ATTEMPTS = 3
const MIN_RETRY_DELAY_MS = 30_000

let timer: NodeJS.Timeout | null = null

interface DeliveryRow {
  recipient: string
  status: 'pending' | 'delivered' | 'failed' | 'retrying'
  attemptCount: number
  lastAttemptAtUtcMs: number | null
  deliveredAtUtcMs: number | null
  errorDetail: string | null
  externalRef: string | null
}

function shouldAttempt(d: DeliveryRow): boolean {
  if (d.status === 'pending') return true
  if (d.status !== 'retrying') return false
  if (d.attemptCount >= MAX_ATTEMPTS) return false
  const last = d.lastAttemptAtUtcMs ?? 0
  const delay = MIN_RETRY_DELAY_MS * Math.pow(2, d.attemptCount - 1)
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

async function processEmail(emailId: string): Promise<void> {
  const doc = (await HotelEmail.findById(emailId).lean()) as Record<string, unknown> | null
  if (!doc) return

  const deliveries = ((doc.deliveries as DeliveryRow[] | undefined) ?? []).slice()
  if (deliveries.length === 0) return

  const adapter = getHotelEmailAdapter()
  const cfg = (await OperatorHotacConfig.findOne({ operatorId: doc.operatorId as string }).lean()) as Record<
    string,
    unknown
  > | null
  const email = (cfg?.email as { fromAddress?: string; replyTo?: string | null } | undefined) ?? {}
  const fromAddress = email.fromAddress ?? null
  const replyTo = email.replyTo ?? null

  let touched = false

  for (let i = 0; i < deliveries.length; i += 1) {
    const d = deliveries[i]
    if (!d) continue
    if (!shouldAttempt(d)) continue

    const attemptAtMs = Date.now()
    let result
    try {
      result = await adapter.send({
        emailId: doc._id as string,
        operatorId: doc.operatorId as string,
        recipient: d.recipient,
        subject: (doc.subject as string) ?? '',
        body: (doc.body as string) ?? '',
        fromAddress,
        replyTo,
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
        lastAttemptAtUtcMs: attemptAtMs,
        deliveredAtUtcMs: attemptAtMs,
        errorDetail: null,
        externalRef: result.externalRef ?? null,
      }
    } else {
      const terminal = !result.transient || nextAttempt >= MAX_ATTEMPTS
      deliveries[i] = {
        ...d,
        status: terminal ? 'failed' : 'retrying',
        attemptCount: nextAttempt,
        lastAttemptAtUtcMs: attemptAtMs,
        errorDetail: result.error ?? 'unknown_error',
      }
    }
    touched = true
  }

  if (!touched) return

  const rollup = rollupStatus(deliveries)
  await HotelEmail.updateOne(
    { _id: emailId },
    {
      $set: {
        deliveries,
        status: rollup,
        updatedAtUtcMs: Date.now(),
      },
    },
  )
}

export async function runHotelEmailDeliveryTick(): Promise<void> {
  const open = await HotelEmail.find(
    {
      direction: 'outbound',
      status: { $in: ['pending', 'partial'] },
      deliveries: {
        $elemMatch: {
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
      await processEmail(m._id as string)
    } catch (e) {
      console.error(`[hotel-email-deliver] email ${m._id} failed:`, e instanceof Error ? e.message : e)
    }
  }
}

export function startHotelEmailDeliveryScheduler(): void {
  if (timer) return
  if (process.env.ENABLE_HOTEL_EMAIL_DELIVERY === 'false') {
    console.log('[hotel-email-deliver] disabled via ENABLE_HOTEL_EMAIL_DELIVERY=false')
    return
  }

  const tick = () => {
    runHotelEmailDeliveryTick().catch((e) =>
      console.error('[hotel-email-deliver] master tick error:', e instanceof Error ? e.message : e),
    )
  }

  void tick()
  timer = setInterval(tick, MASTER_TICK_MS)
  console.log('[hotel-email-deliver] started (master tick every 60 s)')
}

export function stopHotelEmailDeliveryScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
