import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const aircraftCheckStatusSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    aircraftId: { type: String, required: true },
    checkTypeId: { type: String, required: true },
    lastCheckDate: { type: String, default: null },
    lastCheckHours: { type: Number, default: null },
    lastCheckCycles: { type: Number, default: null },
    lastCheckStation: { type: String, default: null },
    lastCheckNotes: { type: String, default: null },
    remainingHours: { type: Number, default: null },
    remainingCycles: { type: Number, default: null },
    remainingDays: { type: Number, default: null },
    forecastDueDate: { type: String, default: null },
    forecastDueTrigger: {
      type: String,
      enum: ['hours', 'cycles', 'calendar', null],
      default: null,
    },
    plannedDate: { type: String, default: null },
    plannedStation: { type: String, default: null },
    plannedEventId: { type: String, default: null },
    isDeferred: { type: Boolean, default: false },
    originalDueDate: { type: String, default: null },
    deferralReason: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'in_progress', 'completed', 'deferred'],
      default: 'active',
    },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'aircraftCheckStatuses',
  },
)

aircraftCheckStatusSchema.index({ operatorId: 1, aircraftId: 1, checkTypeId: 1 }, { unique: true })

export type AircraftCheckStatusDoc = InferSchemaType<typeof aircraftCheckStatusSchema>
export const AircraftCheckStatus = mongoose.model('AircraftCheckStatus', aircraftCheckStatusSchema)
