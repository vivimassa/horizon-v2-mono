import { Operator } from '../models/Operator.js'
import { OperatorMessagingConfig } from '../models/OperatorMessagingConfig.js'
import { MovementMessageLog } from '../models/MovementMessageLog.js'
import { getTransmissionAdapter } from '../services/mvt-transmission.js'

/**
 * Outbound auto-transmit scheduler.
 *
 * Master tick runs every 60 s. For each operator whose
 * OperatorMessagingConfig.autoTransmit.enabled is true AND whose
 * intervalMin has elapsed since lastRunAtUtc, we sweep Held outbound
 * messages whose actionCode is in the allowlist and whose held-age
 * is >= ageGateMin, then transmit each via the configured adapter
 * (currently the noop adapter — see server/src/services/mvt-transmission.ts).
 *
 * On any outcome we stamp lastRunAtUtc and the per-tick counters so
 * the Communication Deck armed banner can display fresh metrics.
 *
 * Failures are NOT retried automatically. Failed docs sit in
 * status='failed' awaiting manual release.
 */

const MASTER_TICK_MS = 60_000

let timer: NodeJS.Timeout | null = null

interface MinimalAutoTransmit {
  enabled?: boolean
  intervalMin?: number
  ageGateMin?: number
  actionAllow?: string[]
  lastRunAtUtc?: number | null
}

async function transmitOne(doc: {
  _id: string
  rawMessage?: string | null
  recipients?: string[] | null
  envelope?: unknown
  operatorId: string
}): Promise<{ ok: boolean; externalMessageId?: string; error?: string }> {
  const adapter = getTransmissionAdapter()
  try {
    return await adapter.send({
      envelope: (doc.envelope as never) ?? undefined,
      rawMessage: doc.rawMessage ?? '',
      recipients: doc.recipients ?? [],
      operatorId: doc.operatorId,
      messageId: doc._id,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'adapter_threw' }
  }
}

async function runForOperator(operatorId: string, auto: MinimalAutoTransmit): Promise<void> {
  const nowMs = Date.now()
  const ageGateMs = (auto.ageGateMin ?? 1) * 60_000
  const cutoffIso = new Date(nowMs - ageGateMs).toISOString()
  const allow = auto.actionAllow && auto.actionAllow.length > 0 ? auto.actionAllow : ['AD', 'AA']

  const candidates = await MovementMessageLog.find({
    operatorId,
    direction: 'outbound',
    status: 'held',
    actionCode: { $in: allow },
    createdAtUtc: { $lte: cutoffIso },
  })
    .limit(100) // hard cap per tick — avoid runaway sweep
    .lean()

  let sent = 0
  let failed = 0
  const matched = candidates.length

  for (const doc of candidates) {
    const result = await transmitOne({
      _id: doc._id as string,
      rawMessage: doc.rawMessage ?? '',
      recipients: (doc.recipients as string[]) ?? [],
      envelope: doc.envelope ?? undefined,
      operatorId,
    })
    const nowIso = new Date().toISOString()
    if (result.ok) {
      await MovementMessageLog.updateOne(
        { _id: doc._id, operatorId },
        {
          $set: {
            status: 'sent',
            externalMessageId: result.externalMessageId ?? null,
            errorReason: null,
            sentAtUtc: nowIso,
            updatedAtUtc: nowIso,
            releasedBy: 'auto-transmit',
            releasedByName: 'Auto-transmit scheduler',
            releasedAtUtc: nowIso,
          },
        },
      )
      sent += 1
    } else {
      await MovementMessageLog.updateOne(
        { _id: doc._id, operatorId },
        {
          $set: {
            status: 'failed',
            errorReason: result.error ?? 'transmission_failed',
            updatedAtUtc: nowIso,
            releasedBy: 'auto-transmit',
            releasedByName: 'Auto-transmit scheduler',
            releasedAtUtc: nowIso,
          },
        },
      )
      failed += 1
    }
  }

  await OperatorMessagingConfig.updateOne(
    { operatorId },
    {
      $set: {
        'autoTransmit.lastRunAtUtc': nowMs,
        'autoTransmit.lastMatched': matched,
        'autoTransmit.lastSent': sent,
        'autoTransmit.lastFailed': failed,
        updatedAt: new Date().toISOString(),
      },
    },
  )

  if (matched > 0) {
    console.log(`[auto-transmit] ${operatorId}: matched=${matched} sent=${sent} failed=${failed}`)
  }
}

export async function runAutoTransmitTick(): Promise<void> {
  const now = Date.now()
  const configs = (await OperatorMessagingConfig.find(
    { 'autoTransmit.enabled': true },
    { operatorId: 1, autoTransmit: 1 },
  ).lean()) as Array<{ operatorId: string; autoTransmit: MinimalAutoTransmit }>

  if (configs.length === 0) return

  // Only hit operators whose interval window has elapsed.
  const due = configs.filter((c) => {
    const intervalMs = (c.autoTransmit.intervalMin ?? 5) * 60_000
    const last = c.autoTransmit.lastRunAtUtc ?? 0
    return now - last >= intervalMs
  })

  for (const c of due) {
    try {
      await runForOperator(c.operatorId, c.autoTransmit)
    } catch (e) {
      console.error(`[auto-transmit] tick failed for ${c.operatorId}:`, e instanceof Error ? e.message : e)
    }
  }
}

export function startAutoTransmitScheduler(): void {
  if (timer) return
  if (process.env.ENABLE_AUTO_TRANSMIT === 'false') {
    console.log('[auto-transmit] disabled via ENABLE_AUTO_TRANSMIT=false')
    return
  }

  const tick = () => {
    runAutoTransmitTick().catch((e) =>
      console.error('[auto-transmit] master tick error:', e instanceof Error ? e.message : e),
    )
  }

  // Kick off immediately, then every minute.
  void tick()
  timer = setInterval(tick, MASTER_TICK_MS)
  console.log('[auto-transmit] started (master tick every 60 s)')
}

export function stopAutoTransmitScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// Operator is imported but referenced indirectly through OperatorMessagingConfig
// lookups. Keep the import in case we later want to cross-check active status.
void Operator
