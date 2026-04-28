import crypto from 'node:crypto'
import { ScheduledTaskRun, type ScheduledTaskRunDoc } from '../models/ScheduledTaskRun.js'
import { ScheduledTask } from '../models/ScheduledTask.js'
import {
  runDailyCrewActivityLog,
  type DailyCrewActivityLogParams,
  type DailyCrewActivityLogStats,
  type RunLog,
} from './tasks/daily-crew-activity-log.js'

/**
 * Registry of background tasks the dispatcher can run.
 *
 * Adding a new task = export a runner with signature
 *   (operatorId, params, log) => Promise<stats>
 * and register it under a unique taskKey.
 */

export interface TaskRunContext {
  runId: string
  taskId: string
  operatorId: string
  /** Caller-supplied params at trigger time. Runner picks the keys it cares about. */
  params: Record<string, unknown>
  log: RunLog
  /** Returns true if the run was cancelled — runners should poll between phases. */
  cancelled: () => boolean
}

export type TaskRunner = (ctx: TaskRunContext) => Promise<Record<string, unknown>>

const registry = new Map<string, TaskRunner>()

registry.set('daily-crew-activity-log', async (ctx) => {
  const stats: DailyCrewActivityLogStats = await runDailyCrewActivityLog(
    ctx.operatorId,
    ctx.params as DailyCrewActivityLogParams,
    ctx.log,
    ctx.cancelled,
  )
  return stats as unknown as Record<string, unknown>
})

export function getTaskRunner(taskKey: string): TaskRunner | null {
  return registry.get(taskKey) ?? null
}

export function listTaskKeys(): string[] {
  return Array.from(registry.keys())
}

const LOG_CAP = 500

const cancelFlags = new Map<string, boolean>()

export function requestCancel(runId: string): void {
  cancelFlags.set(runId, true)
}

export function clearCancel(runId: string): void {
  cancelFlags.delete(runId)
}

/**
 * Dispatch a task runner. Creates a ScheduledTaskRun doc, streams progress to
 * the doc's `lastProgress*` fields (poll-friendly), captures errors. Mirrors
 * the auto-roster fire-and-forget pattern (server/src/routes/auto-roster.ts:773).
 */
export async function dispatchTaskRun(input: {
  taskKey: string
  taskId: string
  operatorId: string
  triggeredBy: 'cron' | 'manual'
  triggeredByUserId: string | null
  triggeredByUserName: string | null
  params: Record<string, unknown>
}): Promise<{ runId: string }> {
  const runner = getTaskRunner(input.taskKey)
  if (!runner) throw new Error(`Unknown taskKey: ${input.taskKey}`)

  const runId = crypto.randomUUID()
  const now = () => new Date().toISOString()

  await ScheduledTaskRun.create({
    _id: runId,
    operatorId: input.operatorId,
    taskKey: input.taskKey,
    taskId: input.taskId,
    status: 'queued',
    triggeredBy: input.triggeredBy,
    triggeredByUserId: input.triggeredByUserId,
    triggeredByUserName: input.triggeredByUserName,
    params: input.params,
    createdAt: now(),
    updatedAt: now(),
  })

  void executeRun(runner, runId, input).catch((err) => {
    console.error(`[task-scheduler] run ${runId} failed unexpectedly`, err)
  })

  return { runId }
}

async function executeRun(
  runner: TaskRunner,
  runId: string,
  input: {
    taskKey: string
    taskId: string
    operatorId: string
    params: Record<string, unknown>
  },
): Promise<void> {
  const now = () => new Date().toISOString()
  const startIso = now()

  await ScheduledTaskRun.updateOne(
    { _id: runId },
    {
      $set: {
        status: 'running',
        startedAt: startIso,
        lastProgressAt: startIso,
        lastProgressPct: 0,
        lastProgressMessage: 'Started',
        updatedAt: startIso,
      },
    },
  )
  await ScheduledTask.updateOne(
    { _id: input.taskId },
    { $set: { lastRunStatus: 'running', lastRunId: runId, updatedAt: startIso } },
  )

  const log: RunLog = async (level, message, pct) => {
    const tsUtc = now()
    const update: Record<string, unknown> = {
      lastProgressAt: tsUtc,
      lastProgressMessage: message,
      updatedAt: tsUtc,
    }
    if (typeof pct === 'number') update.lastProgressPct = Math.max(0, Math.min(100, Math.round(pct)))
    // Push log entry; cap the array at LOG_CAP via $slice on a parallel $push.
    await ScheduledTaskRun.updateOne(
      { _id: runId },
      {
        $set: update,
        $push: { logs: { $each: [{ tsUtc, level, message }], $slice: -LOG_CAP } },
      },
    )
  }

  const cancelled = (): boolean => cancelFlags.get(runId) === true

  try {
    const stats = await runner({
      runId,
      taskId: input.taskId,
      operatorId: input.operatorId,
      params: input.params,
      log,
      cancelled,
    })
    if (cancelled()) {
      const finishIso = now()
      await ScheduledTaskRun.updateOne(
        { _id: runId },
        {
          $set: {
            status: 'cancelled',
            completedAt: finishIso,
            lastProgressAt: finishIso,
            lastProgressPct: 100,
            lastProgressMessage: 'Cancelled by user',
            stats,
            updatedAt: finishIso,
          },
        },
      )
      await ScheduledTask.updateOne(
        { _id: input.taskId },
        {
          $set: {
            lastRunAt: finishIso,
            lastRunStatus: 'cancelled',
            updatedAt: finishIso,
          },
        },
      )
      return
    }
    const finishIso = now()
    await ScheduledTaskRun.updateOne(
      { _id: runId },
      {
        $set: {
          status: 'completed',
          completedAt: finishIso,
          lastProgressAt: finishIso,
          lastProgressPct: 100,
          lastProgressMessage: 'Completed',
          stats,
          updatedAt: finishIso,
        },
      },
    )
    await ScheduledTask.updateOne(
      { _id: input.taskId },
      {
        $set: {
          lastRunAt: finishIso,
          lastRunStatus: 'completed',
          updatedAt: finishIso,
        },
      },
    )
  } catch (err) {
    const finishIso = now()
    const message = err instanceof Error ? err.message : String(err)
    await ScheduledTaskRun.updateOne(
      { _id: runId },
      {
        $set: {
          status: 'failed',
          completedAt: finishIso,
          lastProgressAt: finishIso,
          lastProgressMessage: message,
          error: message,
          updatedAt: finishIso,
        },
        $push: { logs: { $each: [{ tsUtc: finishIso, level: 'error', message }], $slice: -LOG_CAP } },
      },
    )
    await ScheduledTask.updateOne(
      { _id: input.taskId },
      {
        $set: {
          lastRunAt: finishIso,
          lastRunStatus: 'failed',
          updatedAt: finishIso,
        },
      },
    )
    console.error(`[task-scheduler] run ${runId} (${input.taskKey}) failed:`, message)
  } finally {
    clearCancel(runId)
  }
}

export async function isTaskBusy(taskId: string): Promise<boolean> {
  const inflight = await ScheduledTaskRun.exists({ taskId, status: { $in: ['queued', 'running'] } })
  return inflight != null
}

export type { ScheduledTaskRunDoc }
