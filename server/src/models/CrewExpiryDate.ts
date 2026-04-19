import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const crewExpiryDateSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    crewId: { type: String, required: true, index: true },
    expiryCodeId: { type: String, required: true }, // ExpiryCode._id
    aircraftType: { type: String, default: '' }, // '' = not type-specific
    lastDone: { type: String, default: null },
    baseMonth: { type: String, default: null },
    expiryDate: { type: String, default: null },
    nextPlanned: { type: String, default: null },
    notes: { type: String, default: null },
    // Tracks whether expiryDate is admin-overridden (manual). If true, sync won't overwrite.
    isManualOverride: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false, timestamps: false, collection: 'crewExpiryDates' },
)

crewExpiryDateSchema.index({ crewId: 1, expiryCodeId: 1, aircraftType: 1 }, { unique: true })

export type CrewExpiryDateDoc = InferSchemaType<typeof crewExpiryDateSchema>
export const CrewExpiryDate = mongoose.model('CrewExpiryDate', crewExpiryDateSchema)
