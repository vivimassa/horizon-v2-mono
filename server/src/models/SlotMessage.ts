import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const slotMessageSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    messageType: { type: String, required: true },
    airportIata: { type: String, required: true },
    seasonCode: { type: String, required: true },
    rawText: { type: String, required: true },
    parseStatus: {
      type: String,
      enum: ['pending', 'parsed', 'error', 'partial'],
      default: 'pending',
    },
    parseErrors: { type: Schema.Types.Mixed, default: null },
    parsedSeriesCount: { type: Number, default: 0 },
    source: { type: String, default: null },
    reference: { type: String, default: null },
    createdAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'slotMessages',
  },
)

slotMessageSchema.index({ operatorId: 1, airportIata: 1, seasonCode: 1 })

export type SlotMessageDoc = InferSchemaType<typeof slotMessageSchema>
export const SlotMessage = mongoose.model('SlotMessage', slotMessageSchema)
