import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 7.1.6 Task Scheduler — execution history for ScheduledTask rows.
 * Mirrors the AutoRosterRun shape (see server/src/models/AutoRosterRun.ts:8-88)
 * so SSE re-drive and stale-lock sweeps follow the same pattern.
 *
 * `_id` doubles as the SSE stream id so reconnecting clients can resume.
 */

const logEntrySchema = new Schema(
  {
    tsUtc: { type: String, required: true },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
  },
  { _id: false },
)

const scheduledTaskRunSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    taskKey: { type: String, required: true, index: true },
    taskId: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      required: true,
    },
    triggeredBy: {
      type: String,
      enum: ['cron', 'manual'],
      required: true,
    },
    triggeredByUserId: { type: String, default: null },
    triggeredByUserName: { type: String, default: null },

    startedAt: { type: String, default: null },
    completedAt: { type: String, default: null },

    /** Latest progress wall-clock — used by stale-lock sweep when the
     *  process dies without writing a terminal status. */
    lastProgressAt: { type: String, default: null },
    lastProgressPct: { type: Number, default: 0 },
    lastProgressMessage: { type: String, default: null },

    /** Trigger-time params. For Daily Crew Activity Log: {fromIso, toIso, crewIds?}. */
    params: { type: Schema.Types.Mixed, default: () => ({}) },
    /** Task-defined output (snapshotsWritten, crewProcessed, durationMs, ...). */
    stats: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },

    /** Ring-buffered tail of execution log lines (cap ~500). */
    logs: { type: [logEntrySchema], default: () => [] },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'scheduledTaskRuns',
  },
)

scheduledTaskRunSchema.index({ operatorId: 1, taskId: 1, createdAt: -1 })
scheduledTaskRunSchema.index({ operatorId: 1, status: 1 })

export type ScheduledTaskRunDoc = InferSchemaType<typeof scheduledTaskRunSchema>
export const ScheduledTaskRun = mongoose.model('ScheduledTaskRun', scheduledTaskRunSchema)
