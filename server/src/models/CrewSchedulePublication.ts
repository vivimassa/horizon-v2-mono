import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Module 4.1.6 — a frozen snapshot of the crew schedule at the moment a
 * planner hits "Publish". Carries denormalised copies of assignments +
 * activities for the published period; these are the source of truth
 * for the "Compare to published" overlay (AIMS §4.3 / F10).
 *
 * We store snapshots rather than diff events so rendering the overlay
 * is a simple join — the client can always diff against the snapshot
 * at any future time without replaying history.
 */
const snapshotAssignmentSchema = new Schema(
  {
    assignmentId: { type: String, required: true },
    pairingId: { type: String, required: true },
    crewId: { type: String, required: true },
    seatPositionId: { type: String, required: true },
    seatIndex: { type: Number, required: true },
    startUtcIso: { type: String, required: true },
    endUtcIso: { type: String, required: true },
    status: { type: String, required: true },
  },
  { _id: false },
)

const snapshotActivitySchema = new Schema(
  {
    activityId: { type: String, required: true },
    crewId: { type: String, required: true },
    activityCodeId: { type: String, required: true },
    startUtcIso: { type: String, required: true },
    endUtcIso: { type: String, required: true },
    dateIso: { type: String, default: null },
  },
  { _id: false },
)

const crewSchedulePublicationSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    scenarioId: { type: String, default: null, index: true },

    periodFromIso: { type: String, required: true },
    periodToIso: { type: String, required: true },

    publishedAtUtc: { type: String, required: true },
    publishedByUserId: { type: String, default: null },
    note: { type: String, default: null },

    assignments: { type: [snapshotAssignmentSchema], default: [] },
    activities: { type: [snapshotActivitySchema], default: [] },

    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewSchedulePublications' },
)

crewSchedulePublicationSchema.index({ operatorId: 1, scenarioId: 1, publishedAtUtc: -1 })
crewSchedulePublicationSchema.index({ operatorId: 1, periodFromIso: 1, periodToIso: 1 })

export type CrewSchedulePublicationDoc = InferSchemaType<typeof crewSchedulePublicationSchema>
export const CrewSchedulePublication = mongoose.model('CrewSchedulePublication', crewSchedulePublicationSchema)
