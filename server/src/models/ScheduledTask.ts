import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 7.1.6 Task Scheduler Management — per-operator user-editable config
 * for a recurring background job. The dispatcher (`jobs/task-scheduler.ts`)
 * scans active+auto rows on a 60s tick and fires registered runners from
 * `jobs/task-registry.ts`.
 *
 * One doc per (operatorId, taskKey). Built-in tasks are seeded once per
 * operator with active=false; admins opt in via the 7.1.6 UI.
 */

const scheduleSchema = new Schema(
  {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    /** 0=Sun..6=Sat. Used when frequency='weekly'. */
    daysOfWeek: { type: [Number], default: () => [] },
    /** 1..31. Used when frequency='monthly'. */
    dayOfMonth: { type: Number, default: null },
    /** "HH:mm" entries in the operator's timezone. AIMS supports up to 6 slots. */
    timesOfDayLocal: { type: [String], default: () => ['00:30'] },
    /** IANA timezone (e.g. 'Asia/Ho_Chi_Minh'). Falls back to operator.timezone. */
    timezone: { type: String, default: 'UTC' },
  },
  { _id: false },
)

const notificationsSchema = new Schema(
  {
    onMissedStart: { type: Boolean, default: false },
    onTerminated: { type: Boolean, default: false },
    onError: { type: Boolean, default: true },
    /** User ids to notify. Notification delivery wires through existing channel. */
    userIds: { type: [String], default: () => [] },
  },
  { _id: false },
)

const scheduledTaskSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    /** Stable registry key. The dispatcher looks up the runner by this. */
    taskKey: { type: String, required: true },

    title: { type: String, required: true },
    description: { type: String, default: null },
    /** Task #1 etc. — user-facing display number, distinct from _id. */
    displayNumber: { type: Number, required: true },

    /** Master enable. When false the dispatcher ignores this row entirely. */
    active: { type: Boolean, default: false },
    /** When true the dispatcher fires on the cron schedule. When false the
     *  task only runs via manual trigger from the UI. */
    auto: { type: Boolean, default: false },

    schedule: { type: scheduleSchema, default: () => ({}) },
    notifications: { type: notificationsSchema, default: () => ({}) },

    /** Task-specific config (e.g. retention days, lookback overrides). */
    params: { type: Schema.Types.Mixed, default: () => ({}) },

    lastRunAt: { type: String, default: null },
    nextRunAt: { type: String, default: null, index: true },
    lastRunStatus: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled', null],
      default: null,
    },
    lastRunId: { type: String, default: null },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
    updatedByUserId: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'scheduledTasks',
  },
)

scheduledTaskSchema.index({ operatorId: 1, taskKey: 1 }, { unique: true })
scheduledTaskSchema.index({ operatorId: 1, active: 1, auto: 1, nextRunAt: 1 })

export type ScheduledTaskDoc = InferSchemaType<typeof scheduledTaskSchema>
export const ScheduledTask = mongoose.model('ScheduledTask', scheduledTaskSchema)
