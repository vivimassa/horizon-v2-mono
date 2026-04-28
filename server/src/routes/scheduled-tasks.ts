import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ScheduledTask } from '../models/ScheduledTask.js'
import { ScheduledTaskRun } from '../models/ScheduledTaskRun.js'
import { Operator } from '../models/Operator.js'
import { updateScheduledTaskSchema, runScheduledTaskSchema } from '../schemas/scheduled-tasks.js'
import { dispatchTaskRun, isTaskBusy, requestCancel } from '../jobs/task-registry.js'
import { computeNextRunMs, summariseSchedule, type SchedulePolicy } from '../jobs/schedule-utils.js'

/**
 * 7.1.6 Task Scheduler Management — admin CRUD + manual trigger.
 *
 *   GET    /scheduled-tasks                          → list (operator-scoped)
 *   GET    /scheduled-tasks/:taskId                  → single
 *   PATCH  /scheduled-tasks/:taskId                  → update config (admin)
 *   POST   /scheduled-tasks/:taskId/run              → manual trigger (admin)
 *   POST   /scheduled-tasks/:taskId/runs/:runId/cancel
 *   GET    /scheduled-tasks/:taskId/runs             → run history (paginated)
 *   GET    /scheduled-tasks/:taskId/runs/:runId      → single run + logs
 *
 * Reads open to any authenticated tenant user; writes gated by
 * requireAdminRole because Task Scheduler is sysadmin territory.
 */

async function requireAdminRole(req: FastifyRequest, reply: FastifyReply) {
  if (req.userRole !== 'administrator') {
    return reply.code(403).send({ error: 'Forbidden — administrator role required' })
  }
}

async function resolveOperatorTimezone(operatorId: string): Promise<string> {
  const op = await Operator.findById(operatorId, { timezone: 1 }).lean()
  return (op as { timezone?: string } | null)?.timezone ?? 'UTC'
}

function policyFromTask(task: { schedule?: SchedulePolicy | null }, fallbackTz: string): SchedulePolicy {
  const s = task.schedule ?? {
    frequency: 'daily',
    timesOfDayLocal: ['00:30'],
    timezone: fallbackTz,
    daysOfWeek: [],
    dayOfMonth: null,
  }
  return {
    frequency: s.frequency ?? 'daily',
    daysOfWeek: s.daysOfWeek ?? [],
    dayOfMonth: s.dayOfMonth ?? null,
    timesOfDayLocal: s.timesOfDayLocal && s.timesOfDayLocal.length > 0 ? s.timesOfDayLocal : ['00:30'],
    timezone: s.timezone || fallbackTz,
  }
}

export async function scheduledTaskRoutes(app: FastifyInstance) {
  // ── GET list ───────────────────────────────────────────────────────────
  app.get('/scheduled-tasks', async (req) => {
    const operatorId = req.operatorId
    const tasks = await ScheduledTask.find({ operatorId }).sort({ displayNumber: 1 }).lean()
    const tz = await resolveOperatorTimezone(operatorId)
    const now = Date.now()
    return {
      tasks: tasks.map((t) => {
        const policy = policyFromTask(t as unknown as { schedule?: SchedulePolicy | null }, tz)
        const nextRunMs = computeNextRunMs(policy, t.lastRunAt ? Date.parse(t.lastRunAt) : now)
        return {
          ...t,
          schedule: policy,
          scheduleSummary: summariseSchedule(policy),
          nextRunAt: nextRunMs ? new Date(nextRunMs).toISOString() : null,
        }
      }),
    }
  })

  // ── GET single ─────────────────────────────────────────────────────────
  app.get('/scheduled-tasks/:taskId', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const task = await ScheduledTask.findOne({ _id: taskId, operatorId: req.operatorId }).lean()
    if (!task) return reply.code(404).send({ error: 'Task not found' })
    const tz = await resolveOperatorTimezone(req.operatorId)
    const policy = policyFromTask(task as unknown as { schedule?: SchedulePolicy | null }, tz)
    const nextRunMs = computeNextRunMs(policy, task.lastRunAt ? Date.parse(task.lastRunAt) : Date.now())
    return {
      task: {
        ...task,
        schedule: policy,
        scheduleSummary: summariseSchedule(policy),
        nextRunAt: nextRunMs ? new Date(nextRunMs).toISOString() : null,
      },
    }
  })

  // ── PATCH update ───────────────────────────────────────────────────────
  app.patch('/scheduled-tasks/:taskId', { preHandler: requireAdminRole }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const parsed = updateScheduledTaskSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }
    const d = parsed.data
    const existing = await ScheduledTask.findOne({ _id: taskId, operatorId: req.operatorId }).lean()
    if (!existing) return reply.code(404).send({ error: 'Task not found' })

    const update: Record<string, unknown> = { updatedAt: new Date().toISOString(), updatedByUserId: null }
    if (d.active !== undefined) update.active = d.active
    if (d.auto !== undefined) update.auto = d.auto
    if (d.schedule !== undefined) update.schedule = d.schedule
    if (d.notifications !== undefined) update.notifications = d.notifications
    if (d.params !== undefined) update.params = d.params

    await ScheduledTask.updateOne({ _id: taskId, operatorId: req.operatorId }, { $set: update })
    const fresh = await ScheduledTask.findOne({ _id: taskId, operatorId: req.operatorId }).lean()
    return { task: fresh }
  })

  // ── POST run (manual trigger) ──────────────────────────────────────────
  app.post('/scheduled-tasks/:taskId/run', { preHandler: requireAdminRole }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const parsedBody = runScheduledTaskSchema.safeParse(req.body ?? {})
    if (!parsedBody.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsedBody.error.issues })
    }
    const task = await ScheduledTask.findOne({ _id: taskId, operatorId: req.operatorId }).lean()
    if (!task) return reply.code(404).send({ error: 'Task not found' })
    if (await isTaskBusy(taskId)) {
      return reply.code(409).send({ error: 'Task is already running. Cancel the current run first.' })
    }

    const userParams = parsedBody.data ?? {}
    const mergedParams: Record<string, unknown> = {
      ...((task.params as Record<string, unknown>) ?? {}),
      ...userParams,
    }

    const { runId } = await dispatchTaskRun({
      taskKey: task.taskKey,
      taskId,
      operatorId: req.operatorId,
      triggeredBy: 'manual',
      triggeredByUserId: null,
      triggeredByUserName: null,
      params: mergedParams,
    })
    return { runId }
  })

  // ── POST cancel run ────────────────────────────────────────────────────
  app.post('/scheduled-tasks/:taskId/runs/:runId/cancel', { preHandler: requireAdminRole }, async (req, reply) => {
    const { taskId, runId } = req.params as { taskId: string; runId: string }
    const run = await ScheduledTaskRun.findOne({ _id: runId, taskId, operatorId: req.operatorId }).lean()
    if (!run) return reply.code(404).send({ error: 'Run not found' })
    if (run.status !== 'queued' && run.status !== 'running') {
      return reply.code(400).send({ error: `Cannot cancel run in status '${run.status}'` })
    }
    requestCancel(runId)
    return { ok: true }
  })

  // ── GET run history ────────────────────────────────────────────────────
  app.get('/scheduled-tasks/:taskId/runs', async (req) => {
    const { taskId } = req.params as { taskId: string }
    const q = req.query as { limit?: string }
    const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? '50', 10) || 50))
    const runs = await ScheduledTaskRun.find(
      { taskId, operatorId: req.operatorId },
      { logs: 0 }, // logs excluded from list view
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    return { runs }
  })

  // ── GET single run (with logs) ─────────────────────────────────────────
  app.get('/scheduled-tasks/:taskId/runs/:runId', async (req, reply) => {
    const { taskId, runId } = req.params as { taskId: string; runId: string }
    const run = await ScheduledTaskRun.findOne({ _id: runId, taskId, operatorId: req.operatorId }).lean()
    if (!run) return reply.code(404).send({ error: 'Run not found' })
    return { run }
  })
}
