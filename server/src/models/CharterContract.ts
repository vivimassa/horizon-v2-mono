import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const charterContractSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },
    contractNumber: { type: String, required: true },
    contractType: {
      type: String,
      enum: ['passenger', 'cargo', 'government', 'acmi', 'humanitarian', 'hajj', 'sports', 'other'],
      default: 'passenger',
    },
    clientName: { type: String, required: true },
    clientContactName: { type: String, default: null },
    clientContactEmail: { type: String, default: null },
    clientContactPhone: { type: String, default: null },
    aircraftTypeIcao: { type: String, default: null },
    aircraftRegistration: { type: String, default: null },
    paxCapacity: { type: Number, default: null },
    ratePerSector: { type: Number, default: null },
    ratePerBlockHour: { type: Number, default: null },
    currency: { type: String, default: 'USD' },
    fuelSurchargeIncluded: { type: Boolean, default: false },
    catering: {
      type: String,
      enum: ['operator', 'client', 'none'],
      default: 'operator',
    },
    cancelPenalty14d: { type: Number, default: 50 },
    cancelPenalty7d: { type: Number, default: 100 },
    cancelPenalty48h: { type: Number, default: 100 },
    contractStart: { type: String, required: true },
    contractEnd: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'proposed', 'confirmed', 'operating', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    seasonId: { type: String, default: null },
    notes: { type: String, default: null },
    internalNotes: { type: String, default: null },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'charterContracts',
  }
)

charterContractSchema.index({ operatorId: 1, status: 1 })
charterContractSchema.index({ operatorId: 1, contractStart: -1 })

export type CharterContractDoc = InferSchemaType<typeof charterContractSchema>
export const CharterContract = mongoose.model('CharterContract', charterContractSchema)
