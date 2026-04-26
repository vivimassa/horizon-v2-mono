import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewQualificationSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    base: { type: String, default: null }, // Airport._id
    aircraftType: { type: String, required: true }, // ICAO code e.g. A320
    position: { type: String, required: true }, // CrewPosition._id
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    isPrimary: { type: Boolean, default: false },
    acFamilyQualified: { type: Boolean, default: false },
    trainingQuals: [{ type: String }],
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewQualifications' },
)

crewQualificationSchema.index({ operatorId: 1, aircraftType: 1, position: 1 })
// 4.1.6 Crew Schedule aggregator hot path:
//   CrewQualification.find({ operatorId, crewId: { $in: [~133 ids] } }).
// Without this compound, the planner relied on the single-field `crewId`
// index, which forces Mongo to merge candidate sets and then filter by
// operatorId post-fetch. Compound (operatorId, crewId) lets the $in scan
// stay inside the index for the tenant.
crewQualificationSchema.index({ operatorId: 1, crewId: 1 })

export type CrewQualificationDoc = InferSchemaType<typeof crewQualificationSchema>
export const CrewQualification = mongoose.model('CrewQualification', crewQualificationSchema)
