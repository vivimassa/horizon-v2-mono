import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewGroupAssignmentSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    groupId: { type: String, required: true, index: true },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewGroupAssignments' },
)

crewGroupAssignmentSchema.index({ crewId: 1, groupId: 1 }, { unique: true })

export type CrewGroupAssignmentDoc = InferSchemaType<typeof crewGroupAssignmentSchema>
export const CrewGroupAssignment = mongoose.model('CrewGroupAssignment', crewGroupAssignmentSchema)
