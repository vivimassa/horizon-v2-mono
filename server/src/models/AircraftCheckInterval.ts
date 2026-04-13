import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const aircraftCheckIntervalSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    aircraftId: { type: String, required: true },
    checkTypeId: { type: String, required: true },
    hoursInterval: { type: Number, default: null },
    cyclesInterval: { type: Number, default: null },
    daysInterval: { type: Number, default: null },
    preferredStation: { type: String, default: null },
    durationHours: { type: Number, default: null },
    notes: { type: String, default: null },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'aircraftCheckIntervals',
  },
)

aircraftCheckIntervalSchema.index({ operatorId: 1, aircraftId: 1, checkTypeId: 1 }, { unique: true })

export type AircraftCheckIntervalDoc = InferSchemaType<typeof aircraftCheckIntervalSchema>
export const AircraftCheckInterval = mongoose.model('AircraftCheckInterval', aircraftCheckIntervalSchema)
