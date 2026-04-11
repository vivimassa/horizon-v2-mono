import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const delayCodeSchema = new Schema(
  {
    _id: { type: String, required: true },
    operatorId: { type: String, required: true, index: true },

    // Legacy AHM 730/731
    code: { type: String, required: true },
    alphaCode: { type: String, default: null },

    // AHM 732 Triple-A
    ahm732Process: { type: String, default: null },
    ahm732Reason: { type: String, default: null },
    ahm732Stakeholder: { type: String, default: null },

    // Common
    category: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    color: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    isIataStandard: { type: Boolean, default: false },

    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
  },
  {
    _id: false,
    timestamps: false,
    collection: 'delayCodes',
  },
)

delayCodeSchema.index({ operatorId: 1, code: 1 }, { unique: true })

export type DelayCodeDoc = InferSchemaType<typeof delayCodeSchema>
export const DelayCode = mongoose.model('DelayCode', delayCodeSchema)
