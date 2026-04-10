import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const slotDateSchema = new Schema(
  {
    _id: { type: String, required: true },
    seriesId: { type: String, required: true, index: true },
    slotDate: { type: String, required: true },
    operationStatus: {
      type: String,
      enum: ['scheduled', 'operated', 'cancelled', 'no_show', 'jnus'],
      default: 'scheduled',
    },
    jnusReason: { type: String, default: null },
    jnusEvidence: { type: String, default: null },
    actualArrivalTime: { type: Number, default: null },
    actualDepartureTime: { type: Number, default: null },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'slotDates',
  }
)

slotDateSchema.index({ seriesId: 1, slotDate: 1 }, { unique: true })
slotDateSchema.index({ seriesId: 1, operationStatus: 1 })

export type SlotDateDoc = InferSchemaType<typeof slotDateSchema>
export const SlotDate = mongoose.model('SlotDate', slotDateSchema)
