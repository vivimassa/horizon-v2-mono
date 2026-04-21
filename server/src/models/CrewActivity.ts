import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Module 4.1.6 Crew Schedule — activity code assignment for a crew
 * member on a given date range. Distinct from `CrewAssignment`
 * (which links crew to a Pairing). Examples: STBY, LEAVE, DAY OFF,
 * SIM, TRAIN. The Activity Code metadata (color, flags, credit
 * ratios) lives in `ActivityCode` (5.4.4).
 */
const crewActivitySchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    scenarioId: { type: String, default: null, index: true }, // null = production
    crewId: { type: String, required: true, index: true },
    activityCodeId: { type: String, required: true, index: true },

    /** Start instant (denormalized from local midnight of the activity day). */
    startUtcIso: { type: String, required: true },
    /** End instant (denormalized; defaults to end-of-day when activity is all-day). */
    endUtcIso: { type: String, required: true },
    /** Optional YYYY-MM-DD — handy for all-day activity queries. */
    dateIso: { type: String, default: null, index: true },

    notes: { type: String, default: null },
    assignedByUserId: { type: String, default: null },
    assignedAtUtc: { type: String, default: () => new Date().toISOString() },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewActivities' },
)

crewActivitySchema.index({ operatorId: 1, scenarioId: 1, startUtcIso: 1, endUtcIso: 1 })
crewActivitySchema.index({ operatorId: 1, crewId: 1, startUtcIso: 1 })
crewActivitySchema.index({ operatorId: 1, activityCodeId: 1 })

export type CrewActivityDoc = InferSchemaType<typeof crewActivitySchema>
export const CrewActivity = mongoose.model('CrewActivity', crewActivitySchema)
