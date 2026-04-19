import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewPhoneSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    priority: { type: Number, default: 1 },
    type: { type: String, default: 'Mobile' },
    number: { type: String, required: true },
    smsEnabled: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewPhones' },
)

crewPhoneSchema.index({ crewId: 1, priority: 1 })

export type CrewPhoneDoc = InferSchemaType<typeof crewPhoneSchema>
export const CrewPhone = mongoose.model('CrewPhone', crewPhoneSchema)
