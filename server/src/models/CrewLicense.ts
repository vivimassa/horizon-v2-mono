import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewLicenseSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    number: { type: String, required: true },
    type: { type: String, required: true },
    country: { type: String, default: null },
    placeOfIssue: { type: String, default: null },
    issueDate: { type: String, default: null },
    temporary: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewLicenses' },
)

export type CrewLicenseDoc = InferSchemaType<typeof crewLicenseSchema>
export const CrewLicense = mongoose.model('CrewLicense', crewLicenseSchema)
