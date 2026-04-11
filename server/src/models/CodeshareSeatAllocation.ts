import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const codeshareSeatAllocationSchema = new Schema(
  {
    _id: { type: String, required: true },
    mappingId: { type: String, required: true, index: true },
    cabinCode: { type: String, required: true },
    allocatedSeats: { type: Number, required: true },
    releaseHours: { type: Number, default: 72 },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'codeshareSeatAllocations',
  },
)

codeshareSeatAllocationSchema.index({ mappingId: 1, cabinCode: 1 }, { unique: true })

export type CodeshareSeatAllocationDoc = InferSchemaType<typeof codeshareSeatAllocationSchema>
export const CodeshareSeatAllocation = mongoose.model('CodeshareSeatAllocation', codeshareSeatAllocationSchema)
