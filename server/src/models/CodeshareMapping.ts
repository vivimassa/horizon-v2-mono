import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const codeshareMappingSchema = new Schema(
  {
    _id: { type: String, required: true },
    agreementId: { type: String, required: true, index: true },
    operatingFlightNumber: { type: String, required: true },
    marketingFlightNumber: { type: String, required: true },
    departureIata: { type: String, required: true },
    arrivalIata: { type: String, required: true },
    daysOfOperation: { type: String, default: '1234567' },
    effectiveFrom: { type: String, required: true },
    effectiveUntil: { type: String, default: null },
    seatAllocation: { type: Number, default: null },
    agreedAircraftType: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'pending', 'cancelled'],
      default: 'active',
      index: true,
    },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'codeshareMappings',
  },
)

codeshareMappingSchema.index({ agreementId: 1, operatingFlightNumber: 1 })

export type CodeshareMappingDoc = InferSchemaType<typeof codeshareMappingSchema>
export const CodeshareMapping = mongoose.model('CodeshareMapping', codeshareMappingSchema)
