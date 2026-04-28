import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Per-crew rolling-window block/duty/sector totals at a given snapshot date.
 * Output of Task #1 "Daily Crew Activity Log" (jobs/tasks/daily-crew-activity-log.ts).
 *
 * Auto-roster pre-filter (server/src/services/auto-roster-orchestrator.ts)
 * loads the latest snapshot ≤ periodFrom-1 plus any small gap of raw
 * assignments between snapshot date and period start, then enforces
 * MAX_BH_28D / MAX_BH_90D / MAX_BH_365D against (prior + assigned).
 *
 * `snapshotIso` is the LAST day INCLUDED in the rolling window. The 28D
 * row at snapshotIso=2026-04-30 sums all block minutes whose flight STD
 * falls in [2026-04-03 00:00:00Z, 2026-04-30 23:59:59.999Z].
 *
 * Idempotent: the same (operatorId, crewId, snapshotIso) always upserts
 * to the same _id, so manual reruns of a date are safe.
 */
const crewRollingSnapshotSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },

    snapshotIso: { type: String, required: true }, // 'YYYY-MM-DD'
    snapshotMs: { type: Number, required: true }, // 23:59:59.999Z of snapshotIso

    bhMin28d: { type: Number, default: 0 },
    bhMin90d: { type: Number, default: 0 },
    bhMin365d: { type: Number, default: 0 },

    dutyMin28d: { type: Number, default: 0 },
    dutyMin90d: { type: Number, default: 0 },
    dutyMin365d: { type: Number, default: 0 },

    landings28d: { type: Number, default: 0 },
    landings90d: { type: Number, default: 0 },
    landings365d: { type: Number, default: 0 },

    sectors28d: { type: Number, default: 0 },
    sectors90d: { type: Number, default: 0 },
    sectors365d: { type: Number, default: 0 },

    /** Calendar-month totals — feeds YTD fairness target in auto-roster. */
    bhMonthMin: { type: Number, default: 0 },
    bhYtdMin: { type: Number, default: 0 },
    dutyMonthMin: { type: Number, default: 0 },
    dutyYtdMin: { type: Number, default: 0 },

    sourceVersion: { type: Number, default: 1 },
    computedAtUtc: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'crewRollingSnapshots',
  },
)

crewRollingSnapshotSchema.index({ operatorId: 1, crewId: 1, snapshotIso: -1 }, { unique: true })
crewRollingSnapshotSchema.index({ operatorId: 1, snapshotIso: -1 })

export type CrewRollingSnapshotDoc = InferSchemaType<typeof crewRollingSnapshotSchema>
export const CrewRollingSnapshot = mongoose.model('CrewRollingSnapshot', crewRollingSnapshotSchema)
