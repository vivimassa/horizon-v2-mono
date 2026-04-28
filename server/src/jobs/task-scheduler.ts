import { ScheduledTask } from '../models/ScheduledTask.js'
import { Operator } from '../models/Operator.js'
import { computeNextRunMs, type SchedulePolicy } from './schedule-utils.js'
import { dispatchTaskRun, isTaskBusy } from './task-registry.js'

/**
 * 7.1.6 dispatcher loop.
 *
 * Mirrors the cadence pattern from server/src/jobs/weather-poll.ts:75-104
 * (vanilla setInterval, no extra deps). Tick every TICK_MS:
 *   1. Load all ScheduledTask rows where active=true && auto=true.
 *   2. For each: compute nextRunAt from schedule + lastRunAt (or createdAt).
 *      Persist nextRunAt back to the doc so the UI shows the next instant.
 *   3. If now >= nextRunAt and the task isn't already busy, dispatch it.
 *
 * Stale-lock sweep: rows whose lastRunStatus='running' but whose run doc has
 * gone silent for STALE_AFTER_MS (e.g. process crashed mid-run) are flipped
 * to 'failed' on the next tick to unblock the next fire.
 */

const TICK_MS = 60_000
const STALE_AFTER_MS = 30 * 60_000

let timer: NodeJS.Timeout | null = null

export function startTaskScheduler(): void {
  if (process.env.ENABLE_TASK_SCHEDULER === 'false') {
    console.log('[task-scheduler] disabled via ENABLE_TASK_SCHEDULER=false')
    return
  }
  if (timer) return

  void tick().catch((err) => console.error('[task-scheduler] initial tick failed:', err))
  timer = setInterval(() => {
    void tick().catch((err) => console.error('[task-scheduler] tick failed:', err))
  }, TICK_MS)
  console.log(`[task-scheduler] started (tick every ${TICK_MS / 1000}s)`)
}

export function stopTaskScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function tick(): Promise<void> {
  await sweepStaleRuns()

  const due = await ScheduledTask.find({ active: true, auto: true }).lean()
  if (due.length === 0) return

  const operatorTzCache = new Map<string, string>()
  const resolveTz = async (operatorId: string): Promise<string> => {
    if (operatorTzCache.has(operatorId)) return operatorTzCache.get(operatorId) as string
    const op = await Operator.findById(operatorId, { timezone: 1 }).lean()
    const tz = (op as { timezone?: string } | null)?.timezone ?? 'UTC'
    operatorTzCache.set(operatorId, tz)
    return tz
  }

  const nowMs = Date.now()
  for (const task of due) {
    try {
      const explicitTz = (task.schedule as SchedulePolicy | undefined)?.timezone
      const tz = explicitTz && explicitTz !== 'UTC' ? explicitTz : await resolveTz(task.operatorId)
      const policy: SchedulePolicy = {
        frequency: (task.schedule?.frequency ?? 'daily') as SchedulePolicy['frequency'],
        daysOfWeek: task.schedule?.daysOfWeek ?? [],
        dayOfMonth: task.schedule?.dayOfMonth ?? null,
        timesOfDayLocal:
          task.schedule?.timesOfDayLocal && task.schedule.timesOfDayLocal.length > 0
            ? task.schedule.timesOfDayLocal
            : ['00:30'],
        timezone: tz,
      }
      const anchorMs = task.lastRunAt
        ? Date.parse(task.lastRunAt)
        : Date.parse(task.createdAt ?? new Date().toISOString())
      const nextRunMs = computeNextRunMs(policy, anchorMs)
      if (nextRunMs == null) continue

      const nextRunIso = new Date(nextRunMs).toISOString()
      if (task.nextRunAt !== nextRunIso) {
        await ScheduledTask.updateOne(
          { _id: task._id },
          { $set: { nextRunAt: nextRunIso, updatedAt: new Date().toISOString() } },
        )
      }
      if (nowMs < nextRunMs) continue
      if (await isTaskBusy(task._id as string)) continue

      console.log(`[task-scheduler] dispatching ${task.taskKey} for operator ${task.operatorId}`)
      await dispatchTaskRun({
        taskKey: task.taskKey,
        taskId: task._id as string,
        operatorId: task.operatorId,
        triggeredBy: 'cron',
        triggeredByUserId: null,
        triggeredByUserName: 'cron',
        params: (task.params as Record<string, unknown>) ?? {},
      })
    } catch (err) {
      console.error(`[task-scheduler] failed to evaluate task ${task._id}:`, err)
    }
  }
}

async function sweepStaleRuns(): Promise<void> {
  const { ScheduledTaskRun } = await import('../models/ScheduledTaskRun.js')
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString()
  const stale = await ScheduledTaskRun.find(
    { status: { $in: ['queued', 'running'] }, lastProgressAt: { $lt: cutoff } },
    { _id: 1, taskId: 1, operatorId: 1 },
  ).lean()
  if (stale.length === 0) return
  for (const r of stale) {
    const finishIso = new Date().toISOString()
    await ScheduledTaskRun.updateOne(
      { _id: r._id },
      {
        $set: {
          status: 'failed',
          completedAt: finishIso,
          error: 'Stale run — process appears to have died without completing',
          updatedAt: finishIso,
        },
      },
    )
    await ScheduledTask.updateOne(
      { _id: r.taskId },
      { $set: { lastRunStatus: 'failed', lastRunAt: finishIso, updatedAt: finishIso } },
    )
    console.warn(`[task-scheduler] swept stale run ${r._id}`)
  }
}
