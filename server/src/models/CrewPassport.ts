import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewPassportSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    number: { type: String, required: true },
    country: { type: String, required: true },
    nationality: { type: String, default: null },
    placeOfIssue: { type: String, default: null },
    issueDate: { type: String, default: null },
    expiry: { type: String, required: true },
    isActive: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewPassports' },
)

crewPassportSchema.index({ crewId: 1, isActive: 1 })

export type CrewPassportDoc = InferSchemaType<typeof crewPassportSchema>
export const CrewPassport = mongoose.model('CrewPassport', crewPassportSchema)
