import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewRulesetSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewRulesets' },
)

export type CrewRulesetDoc = InferSchemaType<typeof crewRulesetSchema>
export const CrewRuleset = mongoose.model('CrewRuleset', crewRulesetSchema)
