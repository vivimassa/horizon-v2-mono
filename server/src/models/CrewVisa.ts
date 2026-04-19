import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewVisaSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    country: { type: String, required: true },
    type: { type: String, default: null },
    number: { type: String, default: null },
    issueDate: { type: String, default: null },
    expiry: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewVisas' },
)

crewVisaSchema.index({ crewId: 1, country: 1 })

export type CrewVisaDoc = InferSchemaType<typeof crewVisaSchema>
export const CrewVisa = mongoose.model('CrewVisa', crewVisaSchema)
