import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * 4.1.6.1 Auto Roster — persisted run record.
 * _id doubles as the SSE stream ID so clients can resume or cancel.
 */

const autoRosterRunStatsSchema = new Schema(
  {
    pairingsTotal: { type: Number, required: true },
    crewTotal: { type: Number, required: true },
    assignedPairings: { type: Number, required: true },
    unassignedPairings: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    objectiveScore: { type: Number, required: true },
  },
  { _id: false },
)

const autoRosterRunSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    periodFrom: { type: String, required: true },
    periodTo: { type: String, required: true },

    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      required: true,
    },

    startedAt: { type: String, default: null },
    completedAt: { type: String, default: null },

    stats: { type: autoRosterRunStatsSchema, default: null },
    error: { type: String, default: null },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    collection: 'autoRosterRuns',
    timestamps: false,
  },
)

export type AutoRosterRunDoc = InferSchemaType<typeof autoRosterRunSchema>
export const AutoRosterRun = mongoose.model('AutoRosterRun', autoRosterRunSchema)
