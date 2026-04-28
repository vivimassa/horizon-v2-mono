/**
 * Idempotent seed — ensures every active operator has the built-in
 * ScheduledTask rows (currently just Task #1 — Daily Crew Activity Log).
 *
 * Run once at deploy and after any ALTER to the built-in catalog.
 *
 *   pnpm --filter server tsx src/seed-scheduled-tasks.ts
 *
 * Existing rows are NOT overwritten — only missing rows are inserted.
 * Admin-edited fields (active, schedule, notifications) survive reseeds.
 */
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { Operator } from './models/Operator.js'
import { ScheduledTask } from './models/ScheduledTask.js'

interface BuiltinTask {
  taskKey: string
  displayNumber: number
  title: string
  description: string
  defaultSchedule: {
    frequency: 'daily' | 'weekly' | 'monthly'
    timesOfDayLocal: string[]
    timezone: string
  }
}

const BUILTIN_TASKS: BuiltinTask[] = [
  {
    taskKey: 'daily-crew-activity-log',
    displayNumber: 1,
    title: 'Daily Crew Activity Log',
    description:
      'Computes per-crew rolling 28D / 90D / 365D block & duty totals plus calendar MTD/YTD slices. Feeds auto-roster FDTL rolling-cap enforcement and YTD fairness target.',
    defaultSchedule: {
      frequency: 'daily',
      timesOfDayLocal: ['00:30'],
      timezone: 'UTC',
    },
  },
]

export async function seedScheduledTasksForOperator(
  operatorId: string,
  operatorTimezone: string,
): Promise<{ created: number }> {
  let created = 0
  const now = new Date().toISOString()
  for (const t of BUILTIN_TASKS) {
    const existing = await ScheduledTask.findOne({ operatorId, taskKey: t.taskKey }).lean()
    if (existing) continue
    await ScheduledTask.create({
      _id: crypto.randomUUID(),
      operatorId,
      taskKey: t.taskKey,
      title: t.title,
      description: t.description,
      displayNumber: t.displayNumber,
      active: false,
      auto: false,
      schedule: { ...t.defaultSchedule, timezone: operatorTimezone || 'UTC', daysOfWeek: [], dayOfMonth: null },
      notifications: { onMissedStart: false, onTerminated: false, onError: true, userIds: [] },
      params: {},
      createdAt: now,
      updatedAt: now,
    })
    created++
  }
  return { created }
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URI ?? process.env.MONGO_URL
  if (!mongoUrl) {
    console.error('Missing MONGODB_URI / MONGO_URL env')
    process.exit(2)
  }
  await mongoose.connect(mongoUrl)
  const operators = await Operator.find({ isActive: { $ne: false } }, { _id: 1, timezone: 1 }).lean()
  let totalCreated = 0
  for (const op of operators) {
    const opId = op._id as string
    const tz = (op as { timezone?: string }).timezone ?? 'UTC'
    const { created } = await seedScheduledTasksForOperator(opId, tz)
    totalCreated += created
    if (created > 0) console.log(`✓ ${opId}: seeded ${created} task(s)`)
  }
  console.log(`Done — ${totalCreated} new task(s) seeded across ${operators.length} operator(s)`)
  await mongoose.disconnect()
}

if (process.argv[1]?.endsWith('seed-scheduled-tasks.ts') || process.argv[1]?.endsWith('seed-scheduled-tasks.js')) {
  void main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
