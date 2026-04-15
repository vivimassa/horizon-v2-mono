import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Append-only audit trail for DisruptionIssue lifecycle events. Every
 * claim / start / resolve / close / comment writes one row. Feeds the
 * detail panel timeline and 2.1.3.1's training set (outcome labels).
 */
const disruptionIssueActivitySchema = new Schema(
  {
    _id: { type: String, required: true },
    issueId: { type: String, required: true, index: true },
    operatorId: { type: String, required: true, index: true },
    userId: { type: String, default: null },
    userName: { type: String, default: null },
    actionType: {
      type: String,
      required: true,
      enum: ['created', 'assigned', 'started', 'commented', 'resolved', 'closed', 'hidden', 'linked'],
    },
    actionDetail: { type: String, default: null },
    previousStatus: { type: String, default: null },
    newStatus: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'disruptionIssueActivity',
  },
)

disruptionIssueActivitySchema.index({ issueId: 1, createdAt: 1 })

export type DisruptionIssueActivityDoc = InferSchemaType<typeof disruptionIssueActivitySchema>
export const DisruptionIssueActivity = mongoose.model('DisruptionIssueActivity', disruptionIssueActivitySchema)
