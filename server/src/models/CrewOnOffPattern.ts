import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewOnOffPatternSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    patternType: { type: String, required: true }, // DutyPattern code (e.g. "3/4")
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    startingDay: { type: Number, default: 0 },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewOnOffPatterns' },
)

export type CrewOnOffPatternDoc = InferSchemaType<typeof crewOnOffPatternSchema>
export const CrewOnOffPattern = mongoose.model('CrewOnOffPattern', crewOnOffPatternSchema)
