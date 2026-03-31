import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const flightServiceTypeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    color: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'flightServiceTypes',
  }
)

flightServiceTypeSchema.index({ operatorId: 1, code: 1 }, { unique: true })

export type FlightServiceTypeDoc = InferSchemaType<typeof flightServiceTypeSchema>
export const FlightServiceType = mongoose.model('FlightServiceType', flightServiceTypeSchema)
