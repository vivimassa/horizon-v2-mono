import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Module 4.1.6 Crew Schedule — planner-authored notes attached to one of
 * three scopes: a **pairing**, a specific **day** for a crew member, or a
 * **crew member** overall. Surfaced on the Gantt as a small dot indicator
 * on the relevant bar/cell/row; full text in a memo sheet.
 *
 * Follows AIMS Alt+M "View/Edit memo" across §4.2 (duty memo), §4.3 (day
 * memo), §4.5 (crew memo). All three share this collection; `scope`
 * discriminates.
 */
const crewMemoSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    scenarioId: { type: String, default: null, index: true },

    scope: { type: String, enum: ['pairing', 'day', 'crew'], required: true },
    /** For scope='pairing': the Pairing._id.
     *  For scope='day':     the CrewMember._id (pair with `dateIso`).
     *  For scope='crew':    the CrewMember._id. */
    targetId: { type: String, required: true, index: true },
    /** Required only when scope === 'day'. */
    dateIso: { type: String, default: null, index: true },

    text: { type: String, required: true },
    /** Optional pinned state so a memo stays prominent on the Gantt. */
    pinned: { type: Boolean, default: false },

    authorUserId: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewMemos' },
)

crewMemoSchema.index({ operatorId: 1, scenarioId: 1, scope: 1, targetId: 1, dateIso: 1 })
crewMemoSchema.index({ operatorId: 1, updatedAt: -1 })

export type CrewMemoDoc = InferSchemaType<typeof crewMemoSchema>
export const CrewMemo = mongoose.model('CrewMemo', crewMemoSchema)
